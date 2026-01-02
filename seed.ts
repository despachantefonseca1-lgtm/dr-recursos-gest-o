
import { DbService } from './services/db';
import { FaseRecursal, StatusInfracao, PrioridadeTarefa, StatusTarefa, UserRole } from './types';

export const seedData = () => {
  const adminId = '1';
  const secId = '2';

  const infracoes = [
    {
      id: crypto.randomUUID(),
      numeroAuto: 'A1234567',
      placa: 'ABC-1234',
      dataInfracao: '2023-10-15',
      dataLimiteProtocolo: '2023-12-30',
      faseRecursal: FaseRecursal.DEFESA_PREVIA,
      status: StatusInfracao.EM_JULGAMENTO,
      descricao: 'Excesso de velocidade acima de 20%.',
      acompanhamentoMensal: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      historicoStatus: []
    },
    {
      id: crypto.randomUUID(),
      numeroAuto: 'B9876543',
      placa: 'XYZ-9090',
      dataInfracao: '2023-09-20',
      dataLimiteProtocolo: '2023-11-15',
      faseRecursal: FaseRecursal.PRIMEIRA_INSTANCIA,
      status: StatusInfracao.INDEFERIDO,
      descricao: 'Avanço de sinal vermelho.',
      acompanhamentoMensal: false,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      historicoStatus: []
    }
  ];

  const tarefas = [
    {
      id: crypto.randomUUID(),
      titulo: 'Protocolar Defesa Prévia DETRAN',
      descricao: 'Levar documentos impressos e protocolar presencialmente no órgão.',
      prioridade: PrioridadeTarefa.ALTA,
      status: StatusTarefa.PENDENTE,
      atribuidaPara: secId,
      atribuidaPorId: adminId,
      dataCriacao: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      titulo: 'Verificar andamento JARI',
      descricao: 'Consultar portal para ver se saiu julgamento da 1ª instância.',
      prioridade: PrioridadeTarefa.MEDIA,
      status: StatusTarefa.EM_ANDAMENTO,
      atribuidaPara: secId,
      atribuidaPorId: adminId,
      dataCriacao: new Date().toISOString()
    }
  ];

  // Only seed if empty
  if (DbService.getInfracoes().length === 0) {
    infracoes.forEach(i => DbService.saveInfracao(i as any, adminId));
  }
  if (DbService.getTarefas().length === 0) {
    tarefas.forEach(t => DbService.saveTarefa(t as any, adminId));
  }
};

// Auto-run seed for demo purposes
seedData();
