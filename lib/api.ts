
import { Infracao, Tarefa, StatusInfracao, User, UserRole, Notificacao, RecursoCliente, RecursoServico, RecursoVeiculo } from '../types';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Centralized Supabase credentials (used for the temp client workaround in createUser)
const SUPABASE_URL = 'https://tgybgghrleimeujjtbvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneWJnZ2hybGVpbWV1amp0YnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDkxNDQsImV4cCI6MjA4MjkyNTE0NH0.2TSCZpgijxF7ICzMOTN0BRj6qX6RjKVMegOJW9T9qFk';

// Helper to map DB profile to User type
const valOrNull = (v: any) => (v === '' ? null : v);
const isValidUUID = (uuid: any): boolean => {
  return typeof uuid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid.trim());
};

const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.name || '',
  email: profile.email || '',
  role: (profile.role as UserRole) || UserRole.SECRETARIA,
  responsavelAcompanhamento: profile.responsavel_acompanhamento || false,
  responsavelProtocolar: profile.responsavel_protocolar || false,
  password: ''
});

const mapDbTarefa = (row: any): Tarefa => ({
  id: row.id,
  titulo: row.titulo,
  descricao: row.descricao,
  prioridade: row.prioridade as any,
  status: row.status as any,
  atribuidaPara: row.atribuida_para,
  dataPrazo: row.data_prazo,
  observacoes: row.observacoes,
  atribuidaPorId: row.atribuida_por_id,
  dataCriacao: row.created_at,
  ultimaNotificacaoCobranca: row.ultima_notificacao_cobranca,
  motivoConclusao: row.motivo_conclusao,
  imagemUrl: row.imagem_url,
  archivedAt: row.archived_at ?? undefined
});

// Helper to map DB infraction to Infracao type
const mapDbInfracao = (row: any): Infracao => ({
  id: row.id,
  cliente_id: row.cliente_id,
  veiculo_id: row.veiculo_id,
  usuario_id: row.usuario_id,
  orgao_responsavel: row.orgao_responsavel,
  numeroAuto: row.numero_auto,
  placa: row.placa,
  dataInfracao: row.data_infracao,
  descricao: row.descricao,
  dataLimiteProtocolo: row.data_limite_protocolo,
  faseRecursal: row.fase_recursal,
  acompanhamentoMensal: row.acompanhamento_mensal,
  intervaloAcompanhamento: row.intervalo_acompanhamento,
  dataProtocolo: row.data_protocolo,
  status: row.status,
  recursoElaborado: row.recurso_elaborado || false,
  ultimaVerificacao: row.ultima_verificacao,
  observacoes: row.observacoes,
  historicoStatus: row.historico_status || [],
  criadoEm: row.created_at || new Date().toISOString(),
  atualizadoEm: row.updated_at || new Date().toISOString()
});

const mapInfracaoToDb = (infracao: Partial<Infracao>): any => {
  const dbObj: any = {};

  if (infracao.cliente_id !== undefined) dbObj.cliente_id = valOrNull(infracao.cliente_id);
  if (infracao.veiculo_id !== undefined) dbObj.veiculo_id = valOrNull(infracao.veiculo_id);
  if (infracao.usuario_id !== undefined) dbObj.usuario_id = valOrNull(infracao.usuario_id);
  if (infracao.orgao_responsavel !== undefined) dbObj.orgao_responsavel = valOrNull(infracao.orgao_responsavel);
  if (infracao.numeroAuto !== undefined) dbObj.numero_auto = valOrNull(infracao.numeroAuto);
  if (infracao.placa !== undefined) dbObj.placa = valOrNull(infracao.placa);
  if (infracao.dataInfracao !== undefined) dbObj.data_infracao = valOrNull(infracao.dataInfracao);
  if (infracao.descricao !== undefined) dbObj.descricao = valOrNull(infracao.descricao);
  if (infracao.dataLimiteProtocolo !== undefined) dbObj.data_limite_protocolo = valOrNull(infracao.dataLimiteProtocolo);
  if (infracao.faseRecursal !== undefined) dbObj.fase_recursal = infracao.faseRecursal;
  if (infracao.acompanhamentoMensal !== undefined) dbObj.acompanhamento_mensal = infracao.acompanhamentoMensal;
  if (infracao.intervaloAcompanhamento !== undefined) dbObj.intervalo_acompanhamento = infracao.intervaloAcompanhamento;
  if (infracao.dataProtocolo !== undefined) dbObj.data_protocolo = valOrNull(infracao.dataProtocolo);
  if (infracao.status !== undefined) dbObj.status = infracao.status;
  if (infracao.ultimaVerificacao !== undefined) dbObj.ultima_verificacao = valOrNull(infracao.ultimaVerificacao);
  if (infracao.recursoElaborado !== undefined) dbObj.recurso_elaborado = infracao.recursoElaborado;
  if (infracao.observacoes !== undefined) dbObj.observacoes = valOrNull(infracao.observacoes);
  if (infracao.historicoStatus !== undefined) dbObj.historico_status = infracao.historicoStatus;

  return dbObj;
};


const DB_KEYS = {
  AUTH: 'dr_recursos_current_user'
};

export const api = {
  // Auth Helpers
  getCurrentUser(): User | null {
    const userData = localStorage.getItem(DB_KEYS.AUTH);
    if (!userData) return null;
    try {
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  },

  async logout(): Promise<void> {
    localStorage.removeItem(DB_KEYS.AUTH);
    await supabase.auth.signOut();
  },

  // Users Management
  async getUsers(): Promise<User[]> {

    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data.map(mapProfileToUser);
  },

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    // WORKAROUND: Create a temporary client to sign up the new user without logging out the current admin
    const tempSupabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );

    // 1. SignUp the user in Auth (using temp client)
    const { data: authData, error: authError } = await tempSupabase.auth.signUp({
      email: user.email,
      password: user.password || 'mudar123',
      options: {
        data: {
          name: user.name,
          role: user.role
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Falha ao criar usuário de autenticação");

    // 2. Create Profile
    const { data: profileData, error: profileError } = await tempSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        name: user.name,
        role: user.role,
        responsavel_acompanhamento: user.responsavelAcompanhamento,
        responsavel_protocolar: user.responsavelProtocolar
      })
      .select()
      .single();

    if (profileError) {
      if (profileError.code === '23505') {
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update({
            name: user.name,
            role: user.role,
            responsavel_acompanhamento: user.responsavelAcompanhamento,
            responsavel_protocolar: user.responsavelProtocolar
          })
          .eq('id', authData.user.id)
          .select()
          .single();
        if (updateError) throw updateError;
        return mapProfileToUser(updated);
      }
      throw profileError;
    }

    return mapProfileToUser(profileData);
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
        role: updates.role,
        responsavel_acompanhamento: updates.responsavelAcompanhamento,
        responsavel_protocolar: updates.responsavelProtocolar
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapProfileToUser(data);
  },

  async deleteUser(id: string): Promise<void> {
    // Limpa referências de tarefas e notificações do usuário
    await supabase.from('tarefas').update({ atribuida_para: null }).eq('atribuida_para', id);
    await supabase.from('notificacoes').delete().eq('user_id', id);
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
    // NOTA: A conta de autenticação do Supabase Auth permanece ativa após esta operação.
    // Para removê-la completamente, é necessário usar a service role key via Edge Function
    // (supabase.auth.admin.deleteUser). Por ora, o perfil é removido impedindo o acesso
    // às funcionalidades que dependem da tabela profiles.
  },

  // --- TAREFAS ---
  async getTarefas(): Promise<Tarefa[]> {
    // Only return non-archived tasks
    const { data, error } = await supabase.from('tarefas').select('*').is('archived_at', null);
    if (error) {
      console.error('Error fetching tarefas:', error);
      alert(`Erro ao carregar tarefas: ${error.message || JSON.stringify(error)}`);
      return [];
    }
    if (!data) {
      console.log('No data returned from tarefas');
      return [];
    }
    console.log(`Loaded ${data.length} tarefas from database`);
    return data.map(mapDbTarefa);
  },

  async getTarefasArquivadas(): Promise<Tarefa[]> {
    const { data, error } = await supabase
      .from('tarefas')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });
    if (error) {
      console.error('Error fetching archived tarefas:', error);
      return [];
    }
    return (data || []).map(mapDbTarefa);
  },

  async arquivarTarefa(id: string): Promise<void> {
    const { error } = await supabase
      .from('tarefas')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async desarquivarTarefa(id: string): Promise<void> {
    const { error } = await supabase
      .from('tarefas')
      .update({ archived_at: null })
      .eq('id', id);
    if (error) throw error;
  },

  async createTarefa(tarefa: Partial<Tarefa>): Promise<void> {
    const rawAtribuidaPor = tarefa.atribuidaPorId || api.getCurrentUser()?.id;
    const atribuidaPorId = isValidUUID(rawAtribuidaPor) ? rawAtribuidaPor : null;
    const atribuidaPara = isValidUUID(tarefa.atribuidaPara) ? tarefa.atribuidaPara : valOrNull(tarefa.atribuidaPara);

    const dbPayload = {
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      atribuida_para: atribuidaPara,
      data_prazo: valOrNull(tarefa.dataPrazo),
      observacoes: tarefa.observacoes,
      atribuida_por_id: atribuidaPorId,
      imagem_url: valOrNull(tarefa.imagemUrl)
    };
    const { error } = await supabase.from('tarefas').insert(dbPayload);
    if (error) throw error;
  },

  async colocarTarefaEmAnalise(id: string): Promise<void> {
    const { error } = await supabase.from('tarefas').update({ status: 'EM_ANALISE' }).eq('id', id);
    if (error) throw error;
  },

  async colocarTarefaEmEspera(id: string): Promise<void> {
    const { error } = await supabase.from('tarefas').update({ status: 'AGUARDANDO_RESPOSTA' }).eq('id', id);
    if (error) throw error;
  },

  async concluirTarefa(id: string, motivo: string): Promise<void> {
    const { error } = await supabase.from('tarefas').update({
      status: 'CONCLUIDA',
      motivo_conclusao: motivo
    }).eq('id', id);
    if (error) throw error;
  },

  async deleteTarefa(id: string): Promise<void> {
    const { error } = await supabase.from('tarefas').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteAllTarefas(): Promise<void> {
    // Deleta todas as tarefas não arquivadas
    const { error } = await supabase.from('tarefas').delete().is('archived_at', null);
    if (error) throw error;
  },

  async deleteAllArquivadas(): Promise<void> {
    // Exclui permanentemente todas as tarefas arquivadas
    const { error } = await supabase.from('tarefas').delete().not('archived_at', 'is', null);
    if (error) throw error;
  },

  // --- NOTIFICAÇÕES ---
  async getNotifications(userId: string): Promise<Notificacao[]> {
    const { data, error } = await supabase.from('notificacoes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return data.map((n: any) => ({
      id: n.id,
      titulo: n.titulo,
      mensagem: n.mensagem,
      tipo: n.tipo,
      userId: n.user_id,
      link: n.link,
      lida: n.lida,
      data: n.created_at
    }));
  },

  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase.from('notificacoes').delete().eq('id', id);
    if (error) throw error;
  },

  async markNotificationAsRead(id: string): Promise<void> {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('user_id', userId).eq('lida', false);
    if (error) throw error;
  },

  // --- RECURSOS (CRM & FINANCEIRO) ---

  // Clientes
  async getRecursosClientes(): Promise<RecursoCliente[]> {
    const { data, error } = await supabase.from('recursos_clientes').select('*').order('nome', { ascending: true });
    if (error) {
      console.error('Error fetching clientes:', error);
      return [];
    }
    return data as RecursoCliente[];
  },

  async createRecursoCliente(cliente: Omit<RecursoCliente, 'id'>): Promise<RecursoCliente> {
    const sanitized = { ...cliente, cpf: valOrNull(cliente.cpf), rg: valOrNull(cliente.rg) }; // CPF/RG often unique
    const { data, error } = await supabase.from('recursos_clientes').insert(sanitized).select().single();
    if (error) throw error;
    return data as RecursoCliente;
  },

  async updateRecursoCliente(id: string, updates: Partial<RecursoCliente>): Promise<RecursoCliente> {
    const { data, error } = await supabase.from('recursos_clientes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as RecursoCliente;
  },

  async deleteRecursoCliente(id: string): Promise<void> {
    const { error } = await supabase.from('recursos_clientes').delete().eq('id', id);
    if (error) throw error;
  },

  // Veículos
  async getRecursosVeiculos(clienteId: string): Promise<RecursoVeiculo[]> {
    const { data, error } = await supabase.from('recursos_veiculos').select('*').eq('cliente_id', clienteId);
    if (error) {
      console.error('Error fetching veiculos:', error);
      return [];
    }
    return data as RecursoVeiculo[];
  },

  async createRecursoVeiculo(veiculo: Omit<RecursoVeiculo, 'id'>): Promise<RecursoVeiculo> {
    const sanitized = { ...veiculo, cliente_id: valOrNull(veiculo.cliente_id) };
    const { data, error } = await supabase.from('recursos_veiculos').insert(sanitized).select().single();
    if (error) throw error;
    return data as RecursoVeiculo;
  },

  async deleteRecursoVeiculo(id: string): Promise<void> {
    const { error } = await supabase.from('recursos_veiculos').delete().eq('id', id);
    if (error) throw error;
  },

  // Serviços
  async getRecursosServicos(): Promise<RecursoServico[]> {
    const { data, error } = await supabase.from('recursos_servicos').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching servicos:', error);
      return [];
    }
    return data as RecursoServico[];
  },

  async createRecursoServico(servico: Omit<RecursoServico, 'id' | 'created_at'>): Promise<RecursoServico> {
    const sanitized = {
      ...servico,
      cliente_id: valOrNull(servico.cliente_id),
      veiculo_id: valOrNull(servico.veiculo_id)
    };
    const { data, error } = await supabase.from('recursos_servicos').insert(sanitized).select().single();
    if (error) throw error;
    return data as RecursoServico;
  },

  async updateRecursoServico(id: string, updates: Partial<RecursoServico>): Promise<RecursoServico> {
    const { data, error } = await supabase.from('recursos_servicos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as RecursoServico;
  },

  async deleteRecursoServico(id: string): Promise<void> {
    const { error } = await supabase.from('recursos_servicos').delete().eq('id', id);
    if (error) throw error;
  },

  // Infrações
  async getInfracoes(): Promise<Infracao[]> {
    // FIX: Ordered by data_infracao because created_at might be missing in DB
    const { data, error } = await supabase.from('infracoes').select('*').order('data_infracao', { ascending: false });
    if (error) {
      console.error('Error fetching infracoes:', error);
      // alert("Erro ao buscar infrações: " + error.message); // Commented out to reduce noise
      return [];
    }
    return data.map(mapDbInfracao);
  },

  async createInfracao(infracao: Infracao): Promise<Infracao> {
    const dbPayload = mapInfracaoToDb(infracao);
    const { data, error } = await supabase.from('infracoes').insert(dbPayload).select().single();
    if (error) throw error;
    return mapDbInfracao(data);
  },

  async updateInfracao(id: string, updates: Partial<Infracao>): Promise<Infracao> {
    const dbPayload = mapInfracaoToDb(updates);
    const { data, error } = await supabase.from('infracoes').update(dbPayload).eq('id', id).select().single();
    if (error) throw error;
    return mapDbInfracao(data);
  },

  /**
   * Atualiza a infração e, se houver um usuário responsável atribuído,
   * gera automaticamente uma notificação e uma tarefa correspondente
   * à mudança de status ou fase recursal detectada.
   */
  async updateInfracaoComNotificacao(
    id: string,
    updates: Partial<Infracao>,
    executadoPorId?: string
  ): Promise<Infracao> {
    // 1. Buscar estado atual ANTES de salvar
    const { data: anterior, error: fetchError } = await supabase
      .from('infracoes')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const infAnterior = mapDbInfracao(anterior);

    // 2. Salvar as alterações normalmente
    const resultado = await this.updateInfracao(id, updates);

    // 3. Verificar se há responsável atribuído
    const responsavelId = resultado.usuario_id || infAnterior.usuario_id;
    if (!responsavelId) return resultado;

    // 4. Detectar mudança de status ou fase recursal
    const statusMudou = updates.status !== undefined && updates.status !== infAnterior.status;
    const faseMudou = updates.faseRecursal !== undefined && updates.faseRecursal !== infAnterior.faseRecursal;

    if (!statusMudou && !faseMudou) return resultado;

    const novoStatus = resultado.status;
    const novaFase = resultado.faseRecursal;
    const autoNum = resultado.numeroAuto || infAnterior.numeroAuto || 'N/A';
    const placa = resultado.placa || infAnterior.placa || 'N/A';

    const labelFase: Record<string, string> = {
      DEFESA_PREVIA: 'Defesa Prévia',
      PRIMEIRA_INSTANCIA: '1ª Instância (JARI)',
      SEGUNDA_INSTANCIA: '2ª Instância (CETRAN)',
    };
    const nomeFase = labelFase[novaFase] || novaFase;

    // Se o novo status NÃO for RECURSO_A_FAZER (ex: foi para julgamento, deferido, protocolado),
    // conclui qualquer tarefa de elaboração aberta anterior desta infração e NÃO gera nova tarefa
    if (novoStatus !== 'RECURSO_A_FAZER' || resultado.recursoElaborado) {
      try {
        const { data: tarefasAbertas } = await supabase
          .from('tarefas')
          .select('id, titulo')
          .eq('atribuida_para', responsavelId)
          .is('archived_at', null)
          .neq('status', 'CONCLUIDA');

        if (tarefasAbertas && tarefasAbertas.length > 0) {
          for (const t of tarefasAbertas) {
            if (t.titulo.includes(`Auto ${autoNum}`)) {
              await supabase
                .from('tarefas')
                .update({ status: 'CONCLUIDA', updated_at: new Date().toISOString() })
                .eq('id', t.id);
            }
          }
        }
      } catch (e) {
        console.error('Erro ao concluir tarefas de infração não pendente:', e);
      }
      return resultado;
    }

    // Se o status É RECURSO_A_FAZER e ainda não foi elaborado: gera a tarefa de elaboração
    const tituloTarefa = `Elaborar ${nomeFase} — Auto ${autoNum}`;
    const descricaoTarefa =
      `A infração Auto Nº ${autoNum} (Placa: ${placa}) está na fase de ${nomeFase} ` +
      `e o recurso deve ser elaborado e protocolado.`;
    const prazo = resultado.dataLimiteProtocolo || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    })();

    try {
      // 5. Finalizar tarefas pendentes anteriores deste mesmo auto
      const { data: tarefasAntigas } = await supabase
        .from('tarefas')
        .select('id, titulo, status')
        .eq('atribuida_para', responsavelId)
        .is('archived_at', null)
        .neq('status', 'CONCLUIDA');

      if (tarefasAntigas && tarefasAntigas.length > 0) {
        for (const t of tarefasAntigas) {
          if (t.titulo.includes(`Auto ${autoNum}`) && t.titulo !== tituloTarefa) {
            await supabase
              .from('tarefas')
              .update({ status: 'CONCLUIDA', updated_at: new Date().toISOString() })
              .eq('id', t.id);
          }
        }
      }

      // 6. Anti-duplicata: verificar se já existe tarefa ATIVA idêntica para este usuário
      const jaExiste = (tarefasAntigas || []).some(t => t.titulo === tituloTarefa);

      if (!jaExiste) {
        // 7. Criar nova tarefa para o responsável
        await this.createTarefa({
          titulo: tituloTarefa,
          descricao: descricaoTarefa,
          prioridade: 'ALTA' as any,
          status: 'PENDENTE' as any,
          atribuidaPara: responsavelId,
          dataPrazo: prazo,
          observacoes: `Gerado automaticamente para recurso a protocolar da infração Auto ${autoNum}.`,
          atribuidaPorId: executadoPorId || undefined
        });
      }
    } catch (notifError) {
      console.error('Erro ao gerar tarefa de mudança de status:', notifError);
    }

    return resultado;
  },

  async deleteInfracao(id: string): Promise<void> {
    const { error } = await supabase.from('infracoes').delete().eq('id', id);
    if (error) throw error;
  },

  async protocolarInfracao(id: string, dataProtocolo: string, executadoPorId?: string): Promise<void> {
    await this.updateInfracaoComNotificacao(
      id,
      {
        dataProtocolo,
        status: StatusInfracao.PROTOCOLADO_PENDENTE_COMPROVANTE,
        recursoElaborado: true
      },
      executadoPorId
    );
  },

  async protocolarInfracoesEmMassa(ids: string[], dataProtocolo: string, executadoPorId?: string): Promise<void> {
    await Promise.all(ids.map(id => this.protocolarInfracao(id, dataProtocolo, executadoPorId)));
  },

  // --- NOTIFICAÇÕES (criação) ---
  async createNotification(notification: Omit<Notificacao, 'id' | 'lida' | 'data'>): Promise<void> {
    const { error } = await supabase.from('notificacoes').insert({
      titulo: notification.titulo,
      mensagem: notification.mensagem,
      tipo: notification.tipo,
      user_id: notification.userId,
      link: notification.link,
      lida: false
    });
    if (error) throw error;
  },

  // --- TAREFAS (update) ---
  async removerAtribuicaoTarefa(id: string): Promise<void> {
    const { error } = await supabase.from('tarefas').update({ atribuida_para: null }).eq('id', id);
    if (error) throw error;
  },

  async updateTarefa(id: string, updates: Partial<Tarefa>): Promise<void> {
    const dbPayload: Record<string, any> = {};
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.ultimaNotificacaoCobranca !== undefined) dbPayload.ultima_notificacao_cobranca = updates.ultimaNotificacaoCobranca;
    if (updates.motivoConclusao !== undefined) dbPayload.motivo_conclusao = updates.motivoConclusao;
    if (updates.atribuidaPara !== undefined) dbPayload.atribuida_para = updates.atribuidaPara;
    if (updates.dataPrazo !== undefined) dbPayload.data_prazo = updates.dataPrazo;
    if (updates.observacoes !== undefined) dbPayload.observacoes = updates.observacoes;
    if (updates.imagemUrl !== undefined) dbPayload.imagem_url = valOrNull(updates.imagemUrl);
    const { error } = await supabase.from('tarefas').update(dbPayload).eq('id', id);
    if (error) throw error;
  },

  // --- IMAGENS DE TAREFAS (Storage) ---
  async uploadTarefaImagem(file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `tarefas/${fileName}`;

    const { error } = await supabase.storage
      .from('tarefa-imagens')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('tarefa-imagens')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  },

  async deleteTarefaImagem(url: string): Promise<void> {
    // Extract file path from URL
    const match = url.match(/tarefa-imagens\/(.+)$/);
    if (!match) return;
    const filePath = match[1];
    await supabase.storage.from('tarefa-imagens').remove([filePath]);
  },

  // --- TESES DE RECURSO ---
  async getTeses(): Promise<import('../types').TeseRecurso[]> {
    const { data, error } = await supabase
      .from('teses_recurso')
      .select('*')
      .eq('ativo', true)
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });
    if (error) { console.error('Error fetching teses:', error); return []; }
    return data as import('../types').TeseRecurso[];
  },

  async getAllTeses(): Promise<import('../types').TeseRecurso[]> {
    const { data, error } = await supabase
      .from('teses_recurso')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });
    if (error) { console.error('Error fetching teses:', error); return []; }
    return data as import('../types').TeseRecurso[];
  },

  async createTese(tese: Omit<import('../types').TeseRecurso, 'id' | 'created_at' | 'updated_at'>): Promise<import('../types').TeseRecurso> {
    const { data, error } = await supabase.from('teses_recurso').insert(tese).select().single();
    if (error) throw error;
    return data as import('../types').TeseRecurso;
  },

  async updateTese(id: string, updates: Partial<import('../types').TeseRecurso>): Promise<import('../types').TeseRecurso> {
    const { data, error } = await supabase
      .from('teses_recurso')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data as import('../types').TeseRecurso;
  },

  async deleteTese(id: string): Promise<void> {
    const { error } = await supabase.from('teses_recurso').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Sincroniza processos existentes e limpa tarefas indevidas:
   * 1. Remove/conclui tarefas geradas para autos que NÃO estão nos Próximos Protocolos (RECURSO_A_FAZER pendentes de elaboração).
   * 2. Cria/renova tarefas APENAS para os recursos a protocolar que possuem responsável atribuído.
   */
  async sincronizarTarefasInfracoesExistentes(): Promise<{ sincronizadas: number; limpas: number; totalRecursosAProtocolar: number }> {
    const infracoes = await this.getInfracoes();
    const { data: todasTarefas } = await supabase
      .from('tarefas')
      .select('id, titulo, status, atribuida_para, observacoes')
      .is('archived_at', null);

    const labelFase: Record<string, string> = {
      DEFESA_PREVIA: 'Defesa Prévia',
      PRIMEIRA_INSTANCIA: '1ª Instância (JARI)',
      SEGUNDA_INSTANCIA: '2ª Instância (CETRAN)',
    };

    // Apenas infrações nos Próximos Protocolos (RECURSO_A_FAZER que ainda não foram elaboradas)
    const infracoesAProtocolar = infracoes.filter(i =>
      i.status === 'RECURSO_A_FAZER' && !i.recursoElaborado
    );

    const autosValidosMap = new Map<string, Infracao>();
    infracoesAProtocolar.forEach(i => {
      if (i.numeroAuto) {
        autosValidosMap.set(i.numeroAuto.trim().toLowerCase(), i);
      }
    });

    let limpas = 0;
    let sincronizadas = 0;

    // 1. Limpeza de tarefas indevidas (tarefas de acompanhamento/indeferimento ou de autos que não estão a protocolar)
    for (const t of (todasTarefas || [])) {
      const match = (t.titulo || '').match(/Auto\s+([A-Za-z0-9\-\/]+)/i);
      const isAutoTask = !!(match && match[1]);
      const autoKey = isAutoTask ? match[1].trim().toLowerCase() : '';
      const infAtiva = autoKey ? autosValidosMap.get(autoKey) : undefined;

      const isAcompanhamentoOuIndevida =
        t.titulo.includes('Acompanhar Julgamento') ||
        t.titulo.includes('Indeferida — Avaliar') ||
        t.titulo.includes('Infração Deferida') ||
        t.titulo.includes('Anexar Comprovante de Protocolo') ||
        (t.observacoes && t.observacoes.includes('Sincronizado automaticamente'));

      // Se a tarefa pertencer a uma infração que NÃO está nos próximos protocolos, ou for de acompanhamento
      if (t.status !== 'CONCLUIDA' && (isAcompanhamentoOuIndevida || (isAutoTask && !infAtiva))) {
        await supabase.from('tarefas').delete().eq('id', t.id);
        limpas++;
      }
    }

    // 2. Recarregar tarefas para garantir estado limpo
    const { data: tarefasRestantes } = await supabase
      .from('tarefas')
      .select('id, titulo, status, atribuida_para')
      .is('archived_at', null);

    // 3. Gerar/renovar tarefas APENAS para as infrações nos Próximos Protocolos que possuem responsável
    for (const inf of infracoesAProtocolar) {
      if (!inf.usuario_id) continue;

      const autoNum = inf.numeroAuto || 'N/A';
      const placa = inf.placa || 'N/A';
      const nomeFase = labelFase[inf.faseRecursal] || inf.faseRecursal || 'Defesa Prévia';
      const tituloEsperado = `Elaborar ${nomeFase} — Auto ${autoNum}`;
      const descricaoEsperada = `A infração Auto Nº ${autoNum} (Placa: ${placa}) está nos Recursos a Protocolar (${nomeFase}) e deve ser elaborada.`;

      const tarefasDoUsuario = (tarefasRestantes || []).filter(t => t.atribuida_para === inf.usuario_id);
      const jaExisteTarefaAtiva = tarefasDoUsuario.some(t =>
        t.titulo === tituloEsperado && t.status !== 'CONCLUIDA'
      );

      if (!jaExisteTarefaAtiva) {
        // Concluir qualquer tarefa divergente anterior deste mesmo auto
        for (const t of tarefasDoUsuario) {
          if (t.titulo.includes(`Auto ${autoNum}`) && t.titulo !== tituloEsperado && t.status !== 'CONCLUIDA') {
            await supabase
              .from('tarefas')
              .update({ status: 'CONCLUIDA', updated_at: new Date().toISOString() })
              .eq('id', t.id);
          }
        }

        await this.createTarefa({
          titulo: tituloEsperado,
          descricao: descricaoEsperada,
          prioridade: 'ALTA' as any,
          status: 'PENDENTE' as any,
          atribuidaPara: inf.usuario_id,
          dataPrazo: inf.dataLimiteProtocolo || new Date().toISOString().split('T')[0],
          observacoes: `Recurso a protocolar da infração Auto ${autoNum} (${nomeFase}).`
        });

        sincronizadas++;
      }
    }

    return {
      sincronizadas,
      limpas,
      totalRecursosAProtocolar: infracoesAProtocolar.length
    };
  },

  async getRelatorioDesempenho(dataInicio: string, dataFim: string): Promise<{
    userId: string;
    tarefas: number;
    servicos: number;
    recursos: number;
    detalhes: Array<{
      id: string;
      tipo: 'RECURSO' | 'SERVICO' | 'TAREFA';
      titulo: string;
      data: string;
      status: string;
    }>;
  }[]> {
    // 1. Buscar todas as tarefas
    const { data: tarefasData } = await supabase
      .from('tarefas')
      .select('id, titulo, descricao, atribuida_para, data_prazo, status, created_at')
      .is('archived_at', null);

    // 2. Buscar serviços de despachante
    const { data: servicosData, error: servError } = await supabase
      .from('despachante_servicos')
      .select('id, cliente_id, usuario_id, data_servico, servico_descricao, veiculo, placa_veiculo, pagamento_valor, created_at');
    if (servError) {
      console.error('Erro ao buscar despachante_servicos no relatorio:', servError);
    }

    // 3. Buscar infrações
    const { data: infracoesData, error: infError } = await supabase
      .from('infracoes')
      .select('id, numero_auto, placa, fase_recursal, status, usuario_id, data_limite_protocolo, created_at');
    if (infError) {
      console.error('Erro ao buscar infracoes no relatorio:', infError);
    }

    const map: Record<string, {
      tarefas: number;
      servicos: number;
      recursos: number;
      detalhes: Array<{
        id: string;
        tipo: 'RECURSO' | 'SERVICO' | 'TAREFA';
        titulo: string;
        data: string;
        status: string;
      }>;
    }> = {};

    // Helper para identificar tarefas relacionadas a recursos de infração
    const isRecursoTask = (titulo: string): boolean => {
      if (!titulo) return false;
      const lower = titulo.toLowerCase();
      return (
        lower.startsWith('elaborar') ||
        lower.startsWith('responsável por infração') ||
        lower.startsWith('responsavel por infracao') ||
        lower.includes('defesa prévia') ||
        lower.includes('defesa previa') ||
        lower.includes('1ª instância') ||
        lower.includes('1a instancia') ||
        lower.includes('2ª instância') ||
        lower.includes('2a instancia') ||
        lower.includes('jari') ||
        lower.includes('cetran') ||
        lower.includes('auto ')
      );
    };

    // Helper para verificar se ao menos uma das datas está dentro do período selecionado
    const checkDateInPeriod = (date1?: string | null, date2?: string | null): boolean => {
      const d1 = date1 ? date1.slice(0, 10) : '';
      const d2 = date2 ? date2.slice(0, 10) : '';
      return (d1 >= dataInicio && d1 <= dataFim) || (d2 >= dataInicio && d2 <= dataFim);
    };

    const processedAutos = new Set<string>();

    (tarefasData || []).forEach((row: any) => {
      const uid = row.atribuida_para;
      if (!uid) return;
      if (!map[uid]) map[uid] = { tarefas: 0, servicos: 0, recursos: 0, detalhes: [] };

      // Se a data de criação OU a data do prazo para realização estiver no período
      if (checkDateInPeriod(row.created_at, row.data_prazo)) {
        if (isRecursoTask(row.titulo)) {
          map[uid].recursos += 1;
          map[uid].detalhes.push({
            id: row.id,
            tipo: 'RECURSO',
            titulo: row.titulo,
            data: row.data_prazo || (row.created_at ? row.created_at.slice(0, 10) : ''),
            status: row.status || 'PENDENTE'
          });

          const match = (row.titulo || '').match(/Auto\s+([A-Za-z0-9\-\/]+)/i);
          if (match && match[1]) {
            processedAutos.add(`${uid}_${match[1].trim().toLowerCase()}`);
          }
        } else {
          map[uid].tarefas += 1;
          map[uid].detalhes.push({
            id: row.id,
            tipo: 'TAREFA',
            titulo: row.titulo,
            data: row.data_prazo || (row.created_at ? row.created_at.slice(0, 10) : ''),
            status: row.status || 'PENDENTE'
          });
        }
      }
    });

    (servicosData || []).forEach((row: any) => {
      const uid = row.usuario_id;
      if (!uid) return;
      if (!map[uid]) map[uid] = { tarefas: 0, servicos: 0, recursos: 0, detalhes: [] };

      if (checkDateInPeriod(row.created_at, row.data_servico)) {
        map[uid].servicos += 1;
        const desc = row.servico_descricao || 'Serviço de Despachante';
        const veiculo = row.placa_veiculo ? ` (Placa: ${row.placa_veiculo})` : (row.veiculo ? ` (${row.veiculo})` : '');
        map[uid].detalhes.push({
          id: row.id,
          tipo: 'SERVICO',
          titulo: `${desc}${veiculo}`,
          data: row.data_servico || (row.created_at ? row.created_at.slice(0, 10) : ''),
          status: 'REALIZADO'
        });
      }
    });

    (infracoesData || []).forEach((row: any) => {
      const uid = row.usuario_id;
      if (!uid) return;
      if (!map[uid]) map[uid] = { tarefas: 0, servicos: 0, recursos: 0, detalhes: [] };

      if (checkDateInPeriod(row.created_at, row.data_limite_protocolo)) {
        const auto = row.numero_auto ? row.numero_auto.trim().toLowerCase() : '';
        if (!auto || !processedAutos.has(`${uid}_${auto}`)) {
          map[uid].recursos += 1;
          map[uid].detalhes.push({
            id: row.id,
            tipo: 'RECURSO',
            titulo: `Recurso ${row.fase_recursal || 'Defesa'} — Auto ${row.numero_auto || 'N/A'} (Placa: ${row.placa || 'N/A'})`,
            data: row.data_limite_protocolo || (row.created_at ? row.created_at.slice(0, 10) : ''),
            status: row.status || 'RECURSO_A_FAZER'
          });
        }
      }
    });

    return Object.entries(map).map(([userId, counts]) => ({ userId, ...counts }));
  },

  // ============================================================
  // NOTAS PROMISSÓRIAS
  // ============================================================

  async getNotasPromissorias(clienteId: string): Promise<import('../types').NotaPromissoria[]> {
    const { data, error } = await supabase
      .from('notas_promissorias')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching notas:', error); return []; }
    return (data || []) as import('../types').NotaPromissoria[];
  },

  async getNotasParcelas(notaId: string): Promise<import('../types').NotaParcela[]> {
    const { data, error } = await supabase
      .from('notas_parcelas')
      .select('*')
      .eq('nota_id', notaId)
      .order('numero_parcela', { ascending: true });
    if (error) { console.error('Error fetching parcelas:', error); return []; }
    return (data || []) as import('../types').NotaParcela[];
  },

  async getTodasParcelasCliente(clienteId: string): Promise<import('../types').NotaParcela[]> {
    const { data, error } = await supabase
      .from('notas_parcelas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_vencimento', { ascending: true });
    if (error) { console.error('Error fetching parcelas cliente:', error); return []; }
    return (data || []) as import('../types').NotaParcela[];
  },

  async createNotaComParcelas(
    nota: Omit<import('../types').NotaPromissoria, 'id' | 'created_at' | 'updated_at' | 'parcelas'>,
    parcelas: Omit<import('../types').NotaParcela, 'id' | 'nota_id' | 'created_at' | 'updated_at'>[]
  ): Promise<import('../types').NotaPromissoria> {
    // 1. Criar a nota
    const { data: notaData, error: notaError } = await supabase
      .from('notas_promissorias')
      .insert({ ...nota, avalistas: nota.avalistas || [] })
      .select()
      .single();
    if (notaError) throw notaError;

    // 2. Criar as parcelas vinculadas
    const parcelasPayload = parcelas.map(p => ({
      ...p,
      nota_id: notaData.id,
      cliente_id: nota.cliente_id,
      valor_pago: 0,
      situacao: 'A_VENCER'
    }));
    const { error: parcelasError } = await supabase
      .from('notas_parcelas')
      .insert(parcelasPayload);
    if (parcelasError) throw parcelasError;

    return notaData as import('../types').NotaPromissoria;
  },

  async registrarPagamentoParcela(payload: import('../types').RegistroPagamentoPayload): Promise<void> {
    // Buscar parcela atual
    const { data: parcela, error: fetchError } = await supabase
      .from('notas_parcelas')
      .select('*')
      .eq('id', payload.parcelaId)
      .single();
    if (fetchError) throw fetchError;

    const valorTotal = parcela.valor as number;
    const valorPago = payload.valor_pago;
    let novaSituacao: string;

    if (valorPago >= valorTotal) {
      novaSituacao = 'PAGA';
    } else if (valorPago > 0) {
      novaSituacao = 'PARCIALMENTE_PAGA';
    } else {
      novaSituacao = parcela.situacao;
    }

    const { error: updateError } = await supabase
      .from('notas_parcelas')
      .update({
        valor_pago: valorPago,
        data_pagamento: payload.data_pagamento,
        forma_pagamento: payload.forma_pagamento,
        obs_pagamento: payload.obs_pagamento || null,
        pago_por: payload.pago_por,
        situacao: novaSituacao
      })
      .eq('id', payload.parcelaId);
    if (updateError) throw updateError;

    // Verificar se todas as parcelas da nota estão pagas → atualizar situação da nota
    const { data: todasParcelas } = await supabase
      .from('notas_parcelas')
      .select('situacao')
      .eq('nota_id', parcela.nota_id);

    if (todasParcelas && todasParcelas.every((p: any) => p.situacao === 'PAGA')) {
      await supabase
        .from('notas_promissorias')
        .update({ situacao: 'QUITADA' })
        .eq('id', parcela.nota_id);
    }
  },

  async cancelarNota(notaId: string, motivo: string, canceladoPor: string): Promise<void> {
    const { error } = await supabase
      .from('notas_promissorias')
      .update({
        situacao: 'CANCELADA',
        motivo_cancelamento: motivo,
        cancelado_por: canceladoPor,
        cancelado_em: new Date().toISOString()
      })
      .eq('id', notaId);
    if (error) throw error;

    // Cancelar também as parcelas que ainda não foram pagas (evita cancelar parcelas já quitadas)
    await supabase
      .from('notas_parcelas')
      .update({ situacao: 'CANCELADA' })
      .eq('nota_id', notaId)
      .in('situacao', ['A_VENCER', 'VENCIDA', 'RENEGOCIADA']);
  },

  async marcarPdfGerado(parcelaIds: string[], geradoPor: string): Promise<void> {
    const now = new Date().toISOString();
    await supabase
      .from('notas_parcelas')
      .update({ pdf_gerado_em: now, pdf_gerado_por: geradoPor })
      .in('id', parcelaIds);
  },

  async atualizarSituacoesParcelas(clienteId: string): Promise<void> {
    // Atualiza parcelas A_VENCER vencidas para VENCIDA
    const hoje = new Date().toISOString().split('T')[0];
    await supabase
      .from('notas_parcelas')
      .update({ situacao: 'VENCIDA' })
      .eq('cliente_id', clienteId)
      .eq('situacao', 'A_VENCER')
      .lt('data_vencimento', hoje);
  }
};



