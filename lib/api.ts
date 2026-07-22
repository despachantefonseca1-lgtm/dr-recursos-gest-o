
import { Infracao, Tarefa, StatusInfracao, User, UserRole, Notificacao, RecursoCliente, RecursoServico, RecursoVeiculo } from '../types';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Centralized Supabase credentials (used for the temp client workaround in createUser)
const SUPABASE_URL = 'https://tgybgghrleimeujjtbvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneWJnZ2hybGVpbWV1amp0YnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDkxNDQsImV4cCI6MjA4MjkyNTE0NH0.2TSCZpgijxF7ICzMOTN0BRj6qX6RjKVMegOJW9T9qFk';

// Helper to map DB profile to User type
const valOrNull = (v: any) => (v === '' ? null : v);

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
    await supabase.from('tarefas').update({ atribuida_para: null }).eq('atribuida_para', id);
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
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
    const dbPayload = {
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      atribuida_para: valOrNull(tarefa.atribuidaPara),
      data_prazo: valOrNull(tarefa.dataPrazo),
      observacoes: tarefa.observacoes,
      atribuida_por_id: valOrNull(tarefa.atribuidaPorId),
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

  async deleteInfracao(id: string): Promise<void> {
    const { error } = await supabase.from('infracoes').delete().eq('id', id);
    if (error) throw error;
  },

  async protocolarInfracao(id: string, dataProtocolo: string): Promise<void> {
    const dbPayload = {
      data_protocolo: dataProtocolo,
      status: 'PROTOCOLADO_PENDENTE_COMPROVANTE'
    };
    const { error } = await supabase.from('infracoes').update(dbPayload).eq('id', id);
    if (error) throw error;
  },

  async protocolarInfracoesEmMassa(ids: string[], dataProtocolo: string): Promise<void> {
    await Promise.all(ids.map(id => this.protocolarInfracao(id, dataProtocolo)));
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

  async getRelatorioDesempenho(dataInicio: string, dataFim: string): Promise<{
    userId: string;
    tarefas: number;
    servicos: number;
    recursos: number;
  }[]> {
    const { data: tarefasData } = await supabase
      .from('tarefas')
      .select('atribuida_para')
      .gte('created_at', `${dataInicio}T00:00:00.000Z`)
      .lte('created_at', `${dataFim}T23:59:59.999Z`);

    const { data: servicosData } = await supabase
      .from('despachante_servicos')
      .select('usuario_id')
      .gte('created_at', `${dataInicio}T00:00:00.000Z`)
      .lte('created_at', `${dataFim}T23:59:59.999Z`);

    const { data: infracoesData } = await supabase
      .from('infracoes')
      .select('usuario_id')
      .gte('created_at', `${dataInicio}T00:00:00.000Z`)
      .lte('created_at', `${dataFim}T23:59:59.999Z`);

    const map: Record<string, { tarefas: number; servicos: number; recursos: number }> = {};

    (tarefasData || []).forEach((row: any) => {
      const uid = row.atribuida_para;
      if (!uid) return;
      if (!map[uid]) map[uid] = { tarefas: 0, servicos: 0, recursos: 0 };
      map[uid].tarefas += 1;
    });

    (servicosData || []).forEach((row: any) => {
      const uid = row.usuario_id;
      if (!uid) return;
      if (!map[uid]) map[uid] = { tarefas: 0, servicos: 0, recursos: 0 };
      map[uid].servicos += 1;
    });

    (infracoesData || []).forEach((row: any) => {
      const uid = row.usuario_id;
      if (!uid) return;
      if (!map[uid]) map[uid] = { tarefas: 0, servicos: 0, recursos: 0 };
      map[uid].recursos += 1;
    });

    return Object.entries(map).map(([userId, counts]) => ({ userId, ...counts }));
  }
};



