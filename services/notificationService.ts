
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { StatusInfracao, FaseRecursal, User, Notificacao, isMasterAdmin } from '../types';

const MATRIZ_UUID = '3794fc79-d9ba-4f18-afe2-2086474a282c';
const isMatrizUnit = (id?: string | null) => !id || id === MATRIZ_UUID || id === 'matriz-bd';

const isSameUnit = (infUnidadeId?: string | null, userUnidadeId?: string | null): boolean => {
  if (isMatrizUnit(infUnidadeId)) {
    return isMatrizUnit(userUnidadeId);
  }
  return infUnidadeId === userUnidadeId;
};

export class NotificationService {
  private static isRunning = false;

  static async runCheckups() {
    // Throttle: evita rodar múltiplas vezes em paralelo ou em sequência na mesma sessão
    if (this.isRunning) return;

    const lastRun = sessionStorage.getItem('last_notification_checkup_ts');
    const now = Date.now();
    // Executa no máximo uma vez a cada 10 minutos por sessão
    if (lastRun && (now - parseInt(lastRun, 10)) < 10 * 60 * 1000) {
      return;
    }

    this.isRunning = true;
    try {
      console.log("Running notification checkups...");
      // 1. Limpa notificações órfãs de infrações finalizadas E notificações atribuídas a unidades divergentes
      await this.cleanupObsoleteNotifications();

      // 2. Executa checagens de acompanhamento e prescrição
      await this.checkCustomMonitoring();
      await this.checkPrescriptionAlerts();

      sessionStorage.setItem('last_notification_checkup_ts', now.toString());
    } catch (error) {
      console.error("Error running notification checkups", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Remove:
   * 1. Notificações de infrações DEFERIDAS ou INDEFERIDAS.
   * 2. Notificações atribuídas indevidamente a usuários de unidades divergentes
   *    (ex: colaboradora de Nova Serrana recebendo notificações de processos da Matriz).
   */
  private static async cleanupObsoleteNotifications() {
    try {
      const infracoes = await api.getInfracoes();
      const users = await api.getUsers();

      // 1. Limpar notificações de infrações finalizadas (DEFERIDO/INDEFERIDO)
      const finalizadas = infracoes.filter(
        inf => inf.status === StatusInfracao.DEFERIDO || inf.status === StatusInfracao.INDEFERIDO
      );

      for (const inf of finalizadas) {
        await supabase
          .from('notificacoes')
          .delete()
          .or(`link.ilike.%${inf.id}%,titulo.ilike.%${inf.numeroAuto}%`)
          .in('tipo', ['PRESCRICAO', 'ACOMPANHAMENTO']);
      }

      // 2. Limpar notificações cruzadas entre unidades para usuários restritos a uma filial
      for (const user of users) {
        if (!user.unidade_id || isMasterAdmin(user)) continue; // Master Admin pode ver tudo

        const userNotifs = await api.getNotifications(user.id);
        if (userNotifs.length === 0) continue;

        for (const notif of userNotifs) {
          // Extrair ID ou Auto da notificação
          let matchInfId: string | null = null;
          let matchAuto: string | null = null;

          if (notif.link) {
            const m = notif.link.match(/edit_infracao=([^&]+)/);
            if (m && m[1]) matchInfId = m[1];
          }

          if (!matchInfId && notif.titulo) {
            const mAuto = notif.titulo.match(/(?:Acompanhamento|ALERTA DE PRESCRIÇÃO|Cobrança|Auto)[:\s]+([^\s\[\]]+)/i);
            if (mAuto && mAuto[1]) matchAuto = mAuto[1];
          }

          // Localiza a infração correspondente no sistema
          const targetInf = infracoes.find(i => 
            (matchInfId && i.id === matchInfId) || 
            (matchAuto && i.numeroAuto && i.numeroAuto.trim().toLowerCase() === matchAuto.trim().toLowerCase())
          );

          // Se a infração pertence a outra unidade (ou se a filial do usuário ainda não possui essa infração),
          // remove a notificação do banco e limpa a trava de envio do localStorage
          const deveRemover = targetInf 
            ? !isSameUnit(targetInf.unidade_id, user.unidade_id)
            : (notif.tipo === 'PRESCRICAO' || notif.tipo === 'ACOMPANHAMENTO'); // Órfã ou sem auto correspondente na unidade

          if (deveRemover) {
            console.log(`Limpando notificação indevida de outra unidade para usuário ${user.name}:`, notif.titulo);
            await supabase.from('notificacoes').delete().eq('id', notif.id);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao limpar notificações obsoletas ou divergentes de unidade:', e);
    }
  }

  /**
   * Verifica o acompanhamento periódico (15 ou 30 dias) das infrações em julgamento.
   * Dispara SOMENTE UMA VEZ para cada ciclo de acompanhamento e apenas para usuários da mesma unidade.
   */
  private static async checkCustomMonitoring() {
    const infracoes = await api.getInfracoes();
    const now = new Date();
    const users = await api.getUsers();
    const responsaveis = users.filter(u => u.responsavelAcompanhamento);

    if (responsaveis.length === 0) return;

    for (const inf of infracoes) {
      // REGRA ESTREITA: Apenas infrações em julgamento ativo com intervalo configurado
      if (inf.status !== StatusInfracao.EM_JULGAMENTO || !inf.intervaloAcompanhamento) {
        continue;
      }

      // Base: data do último acompanhamento registrado (ou data do protocolo / criação)
      const baseDateStr = inf.ultimaVerificacao || inf.dataProtocolo || inf.criadoEm;
      if (!baseDateStr) continue;

      const baseDate = new Date(baseDateStr);
      const diffDays = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));

      // Se atingiu o marco de dias configurado
      if (diffDays >= inf.intervaloAcompanhamento) {
        const cicloId = `${inf.id}_ciclo_${baseDateStr.split('T')[0]}_${inf.intervaloAcompanhamento}d`;

        // Notifica apenas os responsáveis que pertencem estritamente à mesma unidade desta infração (ou Master Admin)
        const destinatarios = responsaveis.filter(u => {
          if (isMasterAdmin(u)) return true;
          return isSameUnit(inf.unidade_id, u.unidade_id);
        });

        if (destinatarios.length > 0) {
          await this.notifyUsersOnce(
            destinatarios,
            `ACOMPANHAMENTO_${cicloId}`,
            {
              titulo: `Acompanhamento: ${inf.numeroAuto}`,
              mensagem: `Termo de ${inf.intervaloAcompanhamento} dias alcançado (desde ${new Date(baseDateStr).toLocaleDateString()}). Verifique o andamento do processo.`,
              tipo: 'ACOMPANHAMENTO',
              link: `/recursos?tab=PROCESSOS&edit_infracao=${inf.id}`
            }
          );
        }
      }
    }
  }

  /**
   * Alerta de Prescrição:
   * - Defesa Prévia: 361 dias a contar da dataInfracao.
   * - 1ª ou 2ª Instância: 24 meses sem alteração desde dataProtocolo.
   * 
   * REGRA CRÍTICA:
   * - JAMAIS notifica infrações DEFERIDAS ou INDEFERIDAS.
   * - Dispara ESTRITAMENTE UMA ÚNICA VEZ por infração.
   * - Notifica SOMENTE usuários pertencentes à mesma unidade da infração ou Master Admin.
   */
  private static async checkPrescriptionAlerts() {
    const infracoes = await api.getInfracoes();
    const now = new Date();
    const users = await api.getUsers();

    for (const inf of infracoes) {
      // 1. REGRA CRÍTICA: Se já foi DEFERIDO ou INDEFERIDO, o processo já concluiu; NUNCA alertar prescrição!
      if (inf.status === StatusInfracao.DEFERIDO || inf.status === StatusInfracao.INDEFERIDO) {
        continue;
      }

      // Destinatários da notificação de prescrição desta infração (estritamente mesma unidade ou Master Admin)
      const destinatarios = users.filter(u => {
        if (isMasterAdmin(u)) return true;
        return isSameUnit(inf.unidade_id, u.unidade_id);
      });
      if (destinatarios.length === 0) continue;

      // Case 1: Defesa Prévia (361 dias da data da infração sem resolução)
      if (inf.faseRecursal === FaseRecursal.DEFESA_PREVIA && inf.dataInfracao) {
        const dataInfracao = new Date(inf.dataInfracao);
        const diffDays = Math.floor((now.getTime() - dataInfracao.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= 361) {
          const uniqueKey = `PRESCRICAO_DP_${inf.id}`;
          await this.notifyUsersOnce(
            destinatarios,
            uniqueKey,
            {
              titulo: `ALERTA DE PRESCRIÇÃO: ${inf.numeroAuto}`,
              mensagem: `Infração (Defesa Prévia) sem decisão há ${diffDays} dias (Prescrita).`,
              tipo: 'PRESCRICAO',
              link: `/recursos?tab=PROCESSOS&edit_infracao=${inf.id}`
            }
          );
        }
      }

      // Case 2: 1ª ou 2ª Instância (24 meses desde dataProtocolo em julgamento)
      if (
        (inf.faseRecursal === FaseRecursal.PRIMEIRA_INSTANCIA || inf.faseRecursal === FaseRecursal.SEGUNDA_INSTANCIA) &&
        inf.dataProtocolo &&
        inf.status === StatusInfracao.EM_JULGAMENTO // Só conta se ainda estiver em julgamento
      ) {
        const dataProtocolo = new Date(inf.dataProtocolo);
        const diffMonths = (now.getFullYear() - dataProtocolo.getFullYear()) * 12 + (now.getMonth() - dataProtocolo.getMonth());

        if (diffMonths >= 24) {
          const uniqueKey = `PRESCRICAO_INST_${inf.id}_${inf.faseRecursal}`;
          await this.notifyUsersOnce(
            destinatarios,
            uniqueKey,
            {
              titulo: `ALERTA DE PRESCRIÇÃO: ${inf.numeroAuto}`,
              mensagem: `Infração (${inf.faseRecursal === FaseRecursal.PRIMEIRA_INSTANCIA ? '1ª Instância' : '2ª Instância'}) em julgamento há mais de ${diffMonths} meses sem conclusão.`,
              tipo: 'PRESCRICAO',
              link: `/recursos?tab=PROCESSOS&edit_infracao=${inf.id}`
            }
          );
        }
      }
    }
  }

  /**
   * Garante que uma notificação seja disparada SOMENTE UMA VEZ na história daquela infração/marco.
   * Não recria a notificação mesmo se o usuário a marcar como lida ou a excluir do sininho.
   */
  private static async notifyUsersOnce(
    users: User[],
    uniqueKey: string,
    notification: Omit<Notificacao, 'userId' | 'id' | 'lida' | 'data'>
  ) {
    for (const user of users) {
      const storageKey = `notif_sent_${user.id}_${uniqueKey}`;

      // 1. Verificação local persistente (impede recriação mesmo se a notificação foi excluída do sininho)
      if (localStorage.getItem(storageKey) === 'true') {
        continue;
      }

      // 2. Verificação no banco de dados (se já existe qualquer notificação com este tipo e link/título, lida ou não lida)
      const existing = await api.getNotifications(user.id);
      const alreadyExistsInDb = existing.some(n =>
        n.tipo === notification.tipo &&
        (n.link === notification.link || n.titulo === notification.titulo)
      );

      if (alreadyExistsInDb) {
        // Marca no localStorage para não precisar consultar o banco repetidamente
        localStorage.setItem(storageKey, 'true');
        continue;
      }

      // 3. Dispara a notificação de forma única
      try {
        await api.createNotification({
          ...notification,
          userId: user.id
        });
        localStorage.setItem(storageKey, 'true');
      } catch (err) {
        console.error(`Erro ao criar notificação única (${uniqueKey}) para usuário ${user.id}:`, err);
      }
    }
  }
}
