
export enum FaseRecursal {
  DEFESA_PREVIA = 'DEFESA_PREVIA',
  PRIMEIRA_INSTANCIA = 'PRIMEIRA_INSTANCIA',
  SEGUNDA_INSTANCIA = 'SEGUNDA_INSTANCIA'
}

export enum StatusInfracao {
  EM_JULGAMENTO = 'EM_JULGAMENTO',
  DEFERIDO = 'DEFERIDO',
  INDEFERIDO = 'INDEFERIDO',
  RECURSO_A_FAZER = 'RECURSO_A_FAZER'
}

export enum PrioridadeTarefa {
  BAIXA = 'BAIXA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA'
}

export enum StatusTarefa {
  PENDENTE = 'PENDENTE',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  EM_ANALISE = 'EM_ANALISE',
  CONCLUIDA = 'CONCLUIDA'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SECRETARIA = 'SECRETARIA'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  responsavelAcompanhamento: boolean;
}

export interface AppConfig {
  googleSheetsId: string;
  alertaPrazosDias: number[];
  diaAcompanhamentoMensal: number;
}

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  userId: string;
  link: string;
  lida: boolean;
  data: string;
}

export interface SyncLog {
  id: string;
  tipo_evento: 'CREATE' | 'UPDATE' | 'DELETE';
  entidade: 'INFRACAO' | 'TAREFA';
  entidade_id: string;
  usuario_id: string;
  timestamp: string;
  origem: 'SHEETS' | 'SISTEMA';
}

export interface StatusLog {
  id: string;
  data: string;
  status_anterior: StatusInfracao;
  status_novo: StatusInfracao;
  fase_anterior: FaseRecursal;
  fase_nova: FaseRecursal;
  usuario_id: string;
  observacao: string;
}

export interface Infracao {
  id: string;
  dataLimiteProtocolo: string;
  numeroAuto: string;
  dataInfracao: string;
  descricao: string;
  placa: string;
  faseRecursal: FaseRecursal;
  acompanhamentoMensal: boolean;
  intervaloAcompanhamento: 0 | 15 | 30; // 0 = Nunca
  ultimaVerificacao?: string;
  status: StatusInfracao;
  observacoes: string;
  criadoEm: string;
  atualizadoEm: string;
  historicoStatus: StatusLog[];
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: PrioridadeTarefa;
  status: StatusTarefa;
  atribuidaPara: string;
  dataPrazo: string;
  observacoes: string;
  atribuidaPorId: string;
  dataCriacao: string;
  ultimaNotificacaoCobranca?: string;
  motivoConclusao?: string;
}
