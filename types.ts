
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
  AGUARDANDO_RESPOSTA = 'AGUARDANDO_RESPOSTA',
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

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  observacoes_cliente?: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistServico {
  vencimento_crv: boolean;
  autenticacoes_crv: boolean;
  selos: boolean;
  crlv: boolean;
  xerox_cpf_rg: boolean;
  documento_adicional: boolean;
  ipva_licenciamento: boolean;
  carteira_despachante: boolean;
  carimbo_despachante: boolean;
  laudo_vistoria: boolean;
  conferencia_veiculo: boolean;
}

export interface ServicoDespachante {
  id: string;
  cliente_id: string;
  data_servico: string;
  veiculo: string;
  placa: string;
  servico_descricao: string;
  pagamento_forma?: string;
  pagamento_valor: number;
  pagamento_obs?: string;
  melhor_horario_vistoria?: string;
  observacoes_servico?: string;
  complementacao?: string;
  checklist: ChecklistServico;
  caixa_lancamento_id?: string;
  created_at: string;
  updated_at: string;
}

export enum TipoLancamento {
  ENTRADA = 'ENTRADA',
  DESPESA = 'DESPESA'
}

export interface CaixaLancamento {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  forma_pagamento?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_id?: string;
  servico_id?: string;
  criado_por?: string; // name or id
  created_at: string;
  updated_at: string;
  deleted_at?: string; // Soft delete support
}
