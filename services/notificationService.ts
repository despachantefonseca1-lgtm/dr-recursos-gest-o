
import { DbService } from './db';
import { StatusTarefa, StatusInfracao, UserRole } from '../types';

export class NotificationService {
  static runCheckups() {
    console.log("Running notification checkups...");
    this.checkInfracaoDeadlines();
    this.checkTaskFollowups();
    this.checkCustomMonitoring();
  }

  private static checkInfracaoDeadlines() {
    const infracoes = DbService.getInfracoes();
    const config = DbService.getConfig();
    const now = new Date();
    
    // Todos os Admins e responsáveis recebem prazos de protocolo
    const targets = DbService.getUsers().filter(u => u.role === UserRole.ADMIN || u.responsavelAcompanhamento);

    infracoes.forEach(inf => {
      if (inf.status === StatusInfracao.DEFERIDO) return;

      const deadline = new Date(inf.dataLimiteProtocolo);
      const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (config.alertaPrazosDias.includes(diffDays)) {
        targets.forEach(user => {
          DbService.addNotification({
            titulo: `Prazo Próximo: ${inf.numeroAuto}`,
            mensagem: `O prazo para protocolo vence em ${diffDays} dia(s). Placa: ${inf.placa}`,
            tipo: 'PRAZO',
            userId: user.id,
            link: `/infracoes`
          });
        });
      }
    });
  }

  private static checkTaskFollowups() {
    const tarefas = DbService.getTarefas();
    const now = new Date();

    tarefas.forEach(task => {
      if (task.status === StatusTarefa.CONCLUIDA) return;

      const lastNotify = task.ultimaNotificacaoCobranca ? new Date(task.ultimaNotificacaoCobranca) : new Date(task.dataCriacao);
      const diffDays = Math.floor((now.getTime() - lastNotify.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 2) {
        // Envia notificação para o ID do usuário atribuído
        DbService.addNotification({
          titulo: `Cobrança: ${task.titulo}`,
          mensagem: `Esta tarefa (${task.status.replace('_', ' ')}) aguarda atualização há mais de 2 dias.`,
          tipo: 'TAREFA',
          userId: task.atribuidaPara, // Aqui usamos o ID que foi selecionado no dropdown
          link: '/tarefas'
        });
        
        const updatedTask = { ...task, ultimaNotificacaoCobranca: now.toISOString() };
        DbService.saveTarefa(updatedTask, 'SYSTEM');
      }
    });
  }

  private static checkCustomMonitoring() {
    const infracoes = DbService.getInfracoes();
    const now = new Date();
    
    // Filtra apenas os usuários que são marcados como responsáveis pelo acompanhamento
    const responsaveis = DbService.getUsers().filter(u => u.responsavelAcompanhamento);

    infracoes.forEach(inf => {
      if (inf.status !== StatusInfracao.EM_JULGAMENTO || inf.intervaloAcompanhamento === 0) return;

      const lastCheck = inf.ultimaVerificacao ? new Date(inf.ultimaVerificacao) : new Date(inf.criadoEm);
      const diffDays = Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= inf.intervaloAcompanhamento) {
        responsaveis.forEach(user => {
          DbService.addNotification({
            titulo: `Acompanhamento: ${inf.numeroAuto}`,
            mensagem: `Termo de ${inf.intervaloAcompanhamento} dias alcançado. Verifique o status.`,
            tipo: 'ACOMPANHAMENTO',
            userId: user.id,
            link: `/infracoes?tab=ACOMPANHAMENTO`
          });
        });
      }
    });
  }
}
