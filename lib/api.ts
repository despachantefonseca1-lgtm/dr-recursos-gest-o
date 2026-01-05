
import { Infracao, Tarefa, StatusTarefa, StatusInfracao, User, UserRole, Notificacao, RecursoCliente, RecursoServico, RecursoVeiculo } from '../types';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { DbService } from '../services/db';

// Helper to map DB profile to User type
const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.name || '',
  email: profile.email || '', // Email might need to be fetched separately if not in profile, but we'll try to join or just use what we have
  role: (profile.role as UserRole) || UserRole.SECRETARIA,
  responsavelAcompanhamento: profile.responsavel_acompanhamento || false,
  password: '' // We don't return passwords
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
  criadoEm: row.criado_em,
  atualizadoEm: row.atualizado_em
});

// Helper to map DB tarefa to Tarefa type
const mapDbTarefa = (row: any): Tarefa => ({
  id: row.id,
  titulo: row.titulo,
  descricao: row.descricao,
  prioridade: row.prioridade,
  status: row.status,
  atribuidaPara: row.atribuida_para,
  atribuidaPorId: row.atribuida_por_id,
  dataPrazo: row.data_prazo,
  observacoes: row.observacoes,
  motivoConclusao: row.motivo_conclusao,
  ultimaNotificacaoCobranca: row.ultima_notificacao_cobranca,
  dataCriacao: row.data_criacao
});

export const api = {
  // Users Management
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data.map(mapProfileToUser);
  },

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    // WORKAROUND: Create a temporary client to sign up the new user
    // This prevents the current admin from being logged out
    const tempSupabase = createClient(
      'https://tgybgghrleimeujjtbvz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneWJnZ2hybGVpbWV1amp0YnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDkxNDQsImV4cCI6MjA4MjkyNTE0NH0.2TSCZpgijxF7ICzMOTN0BRj6qX6RjKVMegOJW9T9qFk',
      {
        auth: {
          persistSession: false, // Critical: Do not persist this session
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
    // We insert using tempSupabase so the user creates THEIR OWN profile (satisfying standard RLS: id = auth.uid())
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
      // Duplicate handling
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
    // Note: This only updates the profile. Email/Password changes require User Management API (Admin) or user strictly changing their own.
    // We will silently ignore password changes here for now or we could warn.
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
    // 1. Unlink tasks
    await supabase.from('tarefas').update({ atribuida_para: null }).eq('atribuida_para', id);

    // 2. Delete profile
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;

    // Note: The Auth User remains in Supabase Auth (cannot delete without Service Key), 
    // but without a profile, the app should treat them as non-existent/blocked.
  },

  // --- RECURSOS (CRM & FINANCEIRO) ---

  // Clientes
  async getRecursosClientes(): Promise<RecursoCliente[]> {
    const list = DbService.getRecursosClientes();
    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  },

  async createRecursoCliente(cliente: Omit<RecursoCliente, 'id'>): Promise<RecursoCliente> {
    const newCliente = { ...cliente, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    DbService.saveRecursoCliente(newCliente);
    return newCliente as RecursoCliente;
  },

  async updateRecursoCliente(id: string, updates: Partial<RecursoCliente>): Promise<RecursoCliente> {
    const list = DbService.getRecursosClientes();
    const current = list.find(c => c.id === id);
    if (!current) throw new Error('Cliente não encontrado');
    const updated = { ...current, ...updates };
    DbService.saveRecursoCliente(updated);
    return updated as RecursoCliente;
  },

  async deleteRecursoCliente(id: string): Promise<void> {
    DbService.deleteRecursoCliente(id);
  },

  // Veículos
  async getRecursosVeiculos(clienteId: string): Promise<RecursoVeiculo[]> {
    const all = DbService.getRecursosVeiculos();
    return all.filter(v => v.cliente_id === clienteId);
  },

  async createRecursoVeiculo(veiculo: Omit<RecursoVeiculo, 'id'>): Promise<RecursoVeiculo> {
    const newVeiculo = { ...veiculo, id: crypto.randomUUID() };
    DbService.saveRecursoVeiculo(newVeiculo);
    return newVeiculo as RecursoVeiculo;
  },

  async deleteRecursoVeiculo(id: string): Promise<void> {
    DbService.deleteRecursoVeiculo(id);
  },

  // Serviços
  async getRecursosServicos(): Promise<RecursoServico[]> {
    const all = DbService.getRecursosServicos();
    return all.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  },

  async createRecursoServico(servico: Omit<RecursoServico, 'id' | 'created_at'>): Promise<RecursoServico> {
    const newServico = { ...servico, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    DbService.saveRecursoServico(newServico);
    return newServico as RecursoServico;
  },

  async updateRecursoServico(id: string, updates: Partial<RecursoServico>): Promise<RecursoServico> {
    const list = DbService.getRecursosServicos();
    const current = list.find(s => s.id === id);
    if (!current) throw new Error('Serviço não encontrado');
    const updated = { ...current, ...updates };
    DbService.saveRecursoServico(updated);
    return updated as RecursoServico;
  },

  async deleteRecursoServico(id: string): Promise<void> {
    DbService.deleteRecursoServico(id);
  },

  // Infrações (Proxy to existing DbService)
  async getInfracoes(): Promise<Infracao[]> {
    return DbService.getInfracoes();
  },

  async createInfracao(infracao: Infracao): Promise<Infracao> {
    const user = DbService.getCurrentUser();
    const newInfracao = { ...infracao, id: crypto.randomUUID() };
    DbService.saveInfracao(newInfracao, user?.id || 'admin');
    return newInfracao;
  },

  async updateInfracao(id: string, updates: Partial<Infracao>): Promise<Infracao> {
    const list = DbService.getInfracoes();
    const current = list.find(i => i.id === id);
    if (!current) throw new Error('Infração não encontrada');
    const updated = { ...current, ...updates };
    const user = DbService.getCurrentUser();
    DbService.saveInfracao(updated, user?.id || 'admin');
    return updated;
  },

  async deleteInfracao(id: string): Promise<void> {
    const user = DbService.getCurrentUser();
    DbService.deleteInfracao(id, user?.id || 'admin');
  }
};

