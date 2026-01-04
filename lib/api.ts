
import { Infracao, Tarefa, StatusTarefa, StatusInfracao, User, UserRole, Notificacao } from '../types';
import { supabase } from './supabase';

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
    // We get profiles. Ideally we also want emails.
    // Since profiles has 1:1 with auth.users, and we can't easily query auth.users from client without admin key,
    // we might have to rely on profiles having the data we need or just listing profiles.
    // For now, let's assume valid profiles exist.
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;

    // Note: Email is officially in auth.users. 
    // If we need to show email, we might need a stored procedure or just store email in profiles as well (redundant but easier for client view).
    // For this refactor, I'll return profiles. 
    return data.map(mapProfileToUser);
  },

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    // 1. SignUp the user in Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: user.email,
      password: user.password || 'mudar123', // Default or provided password
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
    // Note: If you have a trigger on auth.users -> profiles, this might be duplicate or needed update.
    // Assuming no trigger for now, we insert.
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        name: user.name,
        role: user.role,
        responsavel_acompanhamento: user.responsavelAcompanhamento
        // email is not in profiles schema yet, strictly speaking, but helpful.
      })
      .select()
      .single();

    if (profileError) {
      // If it exists (trigger), update it
      if (profileError.code === '23505') { // Unique violation
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


  async getNotifications(userId: string): Promise<Notificacao[]> {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(row => ({
      id: row.id,
      titulo: row.titulo,
      mensagem: row.mensagem,
      tipo: row.tipo,
      userId: row.user_id,
      link: row.link,
      lida: row.lida,
      data: row.created_at
    }));
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    if (error) throw error;
  },

  async createNotification(notificacao: Omit<Notificacao, 'id' | 'lida' | 'data'>): Promise<void> {
    const { error } = await supabase.from('notificacoes').insert({
      titulo: notificacao.titulo,
      mensagem: notificacao.mensagem,
      tipo: notificacao.tipo,
      user_id: notificacao.userId,
      link: notificacao.link
    });
    if (error) console.error('Error creating notification:', error);
  },

  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase.from('notificacoes').delete().eq('id', id);
    if (error) throw error;
  },

  // Infractions
  async getInfracoes(): Promise<Infracao[]> {
    const { data, error } = await supabase.from('infracoes').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    return data.map(mapDbInfracao);
  },

  async createInfracao(infracao: Omit<Infracao, 'id' | 'criadoEm' | 'atualizadoEm' | 'historicoStatus'>): Promise<Infracao> {
    const { data, error } = await supabase.from('infracoes').insert({
      numero_auto: infracao.numeroAuto,
      placa: infracao.placa,
      data_infracao: infracao.dataInfracao,
      descricao: infracao.descricao,
      data_limite_protocolo: infracao.dataLimiteProtocolo,
      fase_recursal: infracao.faseRecursal,
      acompanhamento_mensal: infracao.acompanhamentoMensal,
      intervalo_acompanhamento: infracao.intervaloAcompanhamento,
      data_protocolo: infracao.dataProtocolo,
      status: infracao.status,
      // ultima_verificacao: infracao.ultimaVerificacao,
      observacoes: infracao.observacoes,
      historico_status: []
    }).select().single();

    if (error) throw error;
    return mapDbInfracao(data);
  },

  async updateInfracao(id: string, updates: Partial<Infracao>): Promise<Infracao> {
    // Map updates to snake_case
    const dbUpdates: any = {};
    if (updates.numeroAuto) dbUpdates.numero_auto = updates.numeroAuto;
    if (updates.placa) dbUpdates.placa = updates.placa;
    if (updates.dataInfracao) dbUpdates.data_infracao = updates.dataInfracao;
    if (updates.descricao) dbUpdates.descricao = updates.descricao;
    if (updates.dataLimiteProtocolo) dbUpdates.data_limite_protocolo = updates.dataLimiteProtocolo;
    if (updates.faseRecursal) dbUpdates.fase_recursal = updates.faseRecursal;
    if (updates.acompanhamentoMensal !== undefined) dbUpdates.acompanhamento_mensal = updates.acompanhamentoMensal;
    if (updates.intervaloAcompanhamento) dbUpdates.intervalo_acompanhamento = updates.intervaloAcompanhamento;
    if (updates.dataProtocolo) dbUpdates.data_protocolo = updates.dataProtocolo;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.ultimaVerificacao) dbUpdates.ultima_verificacao = updates.ultimaVerificacao;
    if (updates.observacoes) dbUpdates.observacoes = updates.observacoes;
    if (updates.historicoStatus) dbUpdates.historico_status = updates.historicoStatus;

    const { data, error } = await supabase
      .from('infracoes')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapDbInfracao(data);
  },

  async protocolarInfracao(id: string): Promise<Infracao> {
    return this.updateInfracao(id, {
      status: StatusInfracao.EM_JULGAMENTO,
      ultimaVerificacao: new Date().toISOString()
    });
  },

  async deleteInfracao(id: string): Promise<void> {
    const { error } = await supabase.from('infracoes').delete().eq('id', id);
    if (error) throw error;
  },

  // Tasks
  async getTarefas(): Promise<Tarefa[]> {
    const { data, error } = await supabase.from('tarefas').select('*').order('data_prazo', { ascending: true });
    if (error) throw error;
    return data.map(mapDbTarefa);
  },

  async createTarefa(tarefa: Omit<Tarefa, 'id' | 'dataCriacao'>): Promise<Tarefa> {
    const { data, error } = await supabase.from('tarefas').insert({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      atribuida_para: tarefa.atribuidaPara,
      atribuida_por_id: tarefa.atribuidaPorId,
      data_prazo: tarefa.dataPrazo,
      observacoes: tarefa.observacoes
    }).select().single();

    if (error) throw error;

    // Notify Assignee
    if (tarefa.atribuidaPara) {
      await this.createNotification({
        titulo: 'Nova Tarefa Atribuída',
        mensagem: `Foi atribuída a você: ${tarefa.titulo}`,
        tipo: 'assigned',
        userId: tarefa.atribuidaPara,
        link: '/tarefas'
      });
    }

    return mapDbTarefa(data);
  },

  async updateTarefa(id: string, updates: Partial<Tarefa>): Promise<Tarefa> {
    const dbUpdates: any = {};
    if (updates.titulo) dbUpdates.titulo = updates.titulo;
    if (updates.descricao) dbUpdates.descricao = updates.descricao;
    if (updates.prioridade) dbUpdates.prioridade = updates.prioridade;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.atribuidaPara) dbUpdates.atribuida_para = updates.atribuidaPara;
    if (updates.dataPrazo) dbUpdates.data_prazo = updates.dataPrazo;
    if (updates.observacoes) dbUpdates.observacoes = updates.observacoes;
    if (updates.motivoConclusao) dbUpdates.motivo_conclusao = updates.motivoConclusao;
    if (updates.ultimaNotificacaoCobranca) dbUpdates.ultima_notificacao_cobranca = updates.ultimaNotificacaoCobranca;

    const { data, error } = await supabase
      .from('tarefas')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapDbTarefa(data);
  },

  async colocarTarefaEmAnalise(id: string): Promise<Tarefa> {
    return this.updateTarefa(id, {
      status: StatusTarefa.EM_ANALISE,
      ultimaNotificacaoCobranca: new Date().toISOString()
    });
  },

  async colocarTarefaEmEspera(id: string): Promise<Tarefa> {
    return this.updateTarefa(id, {
      status: StatusTarefa.AGUARDANDO_RESPOSTA,
      ultimaNotificacaoCobranca: new Date().toISOString()
    });
  },

  async concluirTarefa(id: string, motivo: string): Promise<Tarefa> {
    const t = await this.updateTarefa(id, {
      status: StatusTarefa.CONCLUIDA,
      motivoConclusao: motivo
    });

    // Notify All Admins
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', UserRole.ADMIN);
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await this.createNotification({
          titulo: 'Tarefa Concluída',
          mensagem: `A tarefa "${t.titulo}" foi concluída por um colaborador.`,
          tipo: 'completed',
          userId: admin.id, // Notify each admin
          link: '/tarefas'
        });
      }
    } else if (t.atribuidaPorId) {
      // Fallback to creator if no admin found (unlikely)
      await this.createNotification({
        titulo: 'Tarefa Concluída',
        mensagem: `A tarefa "${t.titulo}" foi concluída.`,
        tipo: 'completed',
        userId: t.atribuidaPorId,
        link: '/tarefas'
      });
    }

    return t;
  },

  async deleteTarefa(id: string): Promise<void> {
    const { data, error } = await supabase.from('tarefas').delete().eq('id', id).select();
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Tarefa não encontrada ou já excluída.");
    }
  },

  async deleteUser(id: string): Promise<void> {
    // 1. Unlink tasks
    await supabase.from('tarefas').update({ atribuida_para: null }).eq('atribuida_para', id);

    // 2. Delete profile
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
  }
};
