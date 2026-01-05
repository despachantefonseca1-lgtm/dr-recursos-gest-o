
import { Infracao, Tarefa, StatusTarefa, StatusInfracao, User, UserRole, Notificacao, RecursoCliente, RecursoServico, RecursoVeiculo } from '../types';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Helper to map DB profile to User type
const valOrNull = (v: any) => (v === '' ? null : v);

const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.name || '',
  email: profile.email || '',
  role: (profile.role as UserRole) || UserRole.SECRETARIA,
  responsavelAcompanhamento: profile.responsavel_acompanhamento || false,
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
  motivoConclusao: row.motivo_conclusao
});

// Helper to map DB infraction to Infracao type
const mapDbInfracao = (row: any): Infracao => ({
  id: row.id,
  cliente_id: row.cliente_id,
  veiculo_id: row.veiculo_id,
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
    // WORKAROUND: Create a temporary client to sign up the new user
    const tempSupabase = createClient(
      'https://tgybgghrleimeujjtbvz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneWJnZ2hybGVpbWV1amp0YnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDkxNDQsImV4cCI6MjA4MjkyNTE0NH0.2TSCZpgijxF7ICzMOTN0BRj6qX6RjKVMegOJW9T9qFk',
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
        responsavel_acompanhamento: user.responsavelAcompanhamento
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
            responsavel_acompanhamento: user.responsavelAcompanhamento
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
        responsavel_acompanhamento: updates.responsavelAcompanhamento
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapProfileToUser(data);
  },

  async deleteUser(id: string): Promise<void> {
    await supabase.from('tarefas').update({ atribuida_para: null }).eq('atribuida_para', id);
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  },

  // --- TAREFAS ---
  async getTarefas(): Promise<Tarefa[]> {
    const { data, error } = await supabase.from('tarefas').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching tarefas:', error);
      return [];
    }
    return data.map(mapDbTarefa);
  },

  async createTarefa(tarefa: Partial<Tarefa>): Promise<void> {
    const dbPayload = {
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      atribuida_para: valOrNull(tarefa.atribuidaPara),
      data_prazo: valOrNull(tarefa.dataPrazo),
      observacoes: tarefa.observacoes,
      atribuida_por_id: valOrNull(tarefa.atribuidaPorId)
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
    await supabase.from('notificacoes').delete().eq('id', id);
  },

  async markNotificationAsRead(id: string): Promise<void> {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
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

  async deleteInfracao(id: string): Promise<void> {
    const { error } = await supabase.from('infracoes').delete().eq('id', id);
    if (error) throw error;
  }
};



