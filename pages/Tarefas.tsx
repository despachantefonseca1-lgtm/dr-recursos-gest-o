import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Tarefa, PrioridadeTarefa, StatusTarefa, User, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Modal } from '../components/ui/Modal';

const Tarefas: React.FC = () => {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [concluirId, setConcluirId] = useState<string | null>(null);
  const [motivoConclusao, setMotivoConclusao] = useState('');
  const currentUser = api.getCurrentUser();

  const [formData, setFormData] = useState<Omit<Tarefa, 'id' | 'dataCriacao' | 'atribuidaPorId' | 'ultimaNotificacaoCobranca'>>({
    titulo: '',
    descricao: '',
    prioridade: PrioridadeTarefa.MEDIA,
    status: StatusTarefa.PENDENTE,
    atribuidaPara: '', // Agora armazenará o ID do usuário
    dataPrazo: '',
    observacoes: ''
  });

  const load = async () => {
    const [tData, uData] = await Promise.all([
      api.getTarefas(),
      api.getUsers()
    ]);
    setTarefas(tData);
    setUsuarios(uData);
  };

  useEffect(() => { load(); }, []);

  // Check 2-day rule
  useEffect(() => {
    if (!currentUser || tarefas.length === 0) return;

    const now = new Date();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    const overdueTasks = tarefas.filter(t => {
      // Only check tasks assigned to ME
      if (t.atribuidaPara !== currentUser.id) return false;
      // Statuses that require follow-up
      if (t.status !== StatusTarefa.AGUARDANDO_RESPOSTA && t.status !== StatusTarefa.EM_ANALISE) return false;

      // Check time
      const lastUpdate = t.ultimaNotificacaoCobranca ? new Date(t.ultimaNotificacaoCobranca) : new Date(t.dataCriacao);
      const diff = now.getTime() - lastUpdate.getTime();
      return diff > twoDaysMs;
    });

    if (overdueTasks.length > 0) {
      // Alert the user about overdue tasks
      const names = overdueTasks.map(t => t.titulo).join(', ');
      alert(`⚠️ ATENÇÃO: As seguintes tarefas estão sem interação há mais de 2 dias:\n${names}\n\nPor favor, atualize o status para "Em Análise" ou conclua.`);
    }
  }, [tarefas, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.atribuidaPara) {
      alert("Por favor, selecione um colaborador responsável.");
      return;
    }

    try {
      await api.createTarefa({
        ...formData,
        atribuidaPorId: currentUser?.id || 'admin-main'
      });

      setIsFormOpen(false);
      setFormData({
        titulo: '', descricao: '', prioridade: PrioridadeTarefa.MEDIA,
        status: StatusTarefa.PENDENTE, atribuidaPara: '', dataPrazo: '', observacoes: ''
      });
      await load();
      alert('Tarefa criada com sucesso!');
    } catch (error: any) {
      console.error('Error creating tarefa:', error);
      alert('Erro ao criar tarefa: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleAnalise = async (id: string) => {
    try {
      await api.colocarTarefaEmAnalise(id);
      await load();
    } catch (error: any) {
      console.error('Error updating tarefa:', error);
      alert('Erro ao atualizar tarefa: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleEspera = async (id: string) => {
    try {
      await api.colocarTarefaEmEspera(id);
      await load();
    } catch (error: any) {
      console.error('Error updating tarefa:', error);
      alert('Erro ao atualizar tarefa: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleConcluir = async () => {
    if (!concluirId || !motivoConclusao.trim()) return;
    try {
      await api.concluirTarefa(concluirId, motivoConclusao);
      setConcluirId(null);
      setMotivoConclusao('');
      await load();
      alert('Tarefa concluída com sucesso!');
    } catch (error: any) {
      console.error('Error concluding tarefa:', error);
      alert('Erro ao concluir tarefa: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleExcluir = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta tarefa permanentemente?')) {
      try {
        await api.deleteTarefa(id);
        alert('Tarefa excluída com sucesso!');
        await load();
      } catch (error: any) {
        console.error(error);
        alert('Erro ao excluir tarefa: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Gestão de Tarefa</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controle operacional e demandas internas</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} icon="➕">
          Nova Tarefa
        </Button>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Nova Tarefa"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Título da Demanda"
            required
            value={formData.titulo}
            onChange={e => setFormData({ ...formData, titulo: e.target.value })}
            placeholder="Ex: Protocolar recurso DETRAN"
          />
          <Select
            label="Colaborador Responsável"
            required
            value={formData.atribuidaPara}
            onChange={e => setFormData({ ...formData, atribuidaPara: e.target.value })}
          >
            <option value="">Selecione o colaborador...</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </Select>
          <Select
            label="Nível de Prioridade"
            value={formData.prioridade}
            onChange={e => setFormData({ ...formData, prioridade: e.target.value as any })}
          >
            <option value={PrioridadeTarefa.BAIXA}>Baixa</option>
            <option value={PrioridadeTarefa.MEDIA}>Média</option>
            <option value={PrioridadeTarefa.ALTA}>Alta</option>
          </Select>
          <Input
            label="Data Limite de Execução"
            type="date"
            required
            value={formData.dataPrazo}
            onChange={e => setFormData({ ...formData, dataPrazo: e.target.value })}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Instruções Detalhadas"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              className="h-28"
              placeholder="O que deve ser feito exatamente?"
            />
          </div>
          <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
              Descartar
            </Button>
            <Button type="submit" variant="secondary" className="px-10 py-3.5 rounded-2xl">
              Cadastrar Tarefa
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!concluirId}
        onClose={() => setConcluirId(null)}
        title="Finalizar Tarefa"
      >
        <p className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-wider">Descreva o resultado ou anexe observações finais:</p>
        <Textarea
          autoFocus
          value={motivoConclusao}
          onChange={e => setMotivoConclusao(e.target.value)}
          className="h-36 mb-6"
          placeholder="Descreva a conclusão..."
        />
        <div className="flex justify-end space-x-3">
          <Button variant="ghost" onClick={() => setConcluirId(null)} size="sm">
            Cancelar
          </Button>
          <Button
            variant="success"
            onClick={handleConcluir}
            disabled={!motivoConclusao.trim()}
            className="px-8 py-3 rounded-2xl"
          >
            Concluir Agora
          </Button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tarefas.sort((a, b) => a.status === StatusTarefa.CONCLUIDA ? 1 : -1).map(tar => {
          const resp = usuarios.find(u => u.id === tar.atribuidaPara);
          return (
            <div key={tar.id} className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-xl relative overflow-hidden ${tar.status === StatusTarefa.CONCLUIDA ? 'opacity-60 bg-slate-50' : ''
              }`}>
              <div className={`absolute top-0 left-0 w-2 h-full ${tar.prioridade === 'ALTA' ? 'bg-rose-500' : tar.prioridade === 'MEDIA' ? 'bg-amber-500' : 'bg-slate-300'
                }`} />

              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">ID: #{tar.id.slice(0, 6)}</span>
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${tar.status === StatusTarefa.EM_ANALISE ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                  {tar.status.replace('_', ' ')}
                </span>
              </div>

              <h4 className={`font-black text-lg mb-2 leading-tight ${tar.status === StatusTarefa.CONCLUIDA ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {tar.titulo}
              </h4>

              <p className="text-sm text-slate-500 mb-6 font-medium line-clamp-3">{tar.descricao}</p>

              {tar.motivoConclusao && (
                <div className="mb-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Motivo da Conclusão</p>
                  <p className="text-xs text-emerald-800 font-bold italic">"{tar.motivoConclusao}"</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-5 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsável</span>
                  <span className="text-xs font-black text-slate-800 uppercase">{resp ? resp.name : 'Não definido'}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencimento</span>
                  <span className="text-xs font-black text-slate-800">{new Date(tar.dataPrazo).toLocaleDateString()}</span>
                </div>
              </div>

              {tar.status !== StatusTarefa.CONCLUIDA && (
                <div className="flex flex-col gap-2 mt-6">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleEspera(tar.id)}
                      className="py-2.5 rounded-xl border border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold uppercase tracking-wide"
                      size="sm"
                    >
                      Aguardando ⏳
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleAnalise(tar.id)}
                      className="py-2.5 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold uppercase tracking-wide"
                      size="sm"
                    >
                      Em Análise 🔎
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setConcluirId(tar.id)}
                    className="w-full py-3 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold uppercase tracking-wide"
                    size="sm"
                  >
                    Concluir Tarefa ✅
                  </Button>
                </div>
              )}
              {tar.status === StatusTarefa.CONCLUIDA && (
                <div className="mt-6">
                  {currentUser?.role === UserRole.ADMIN && (
                    <Button
                      variant="ghost"
                      onClick={() => handleExcluir(tar.id)}
                      className="w-full py-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white"
                      size="sm"
                    >
                      Excluir Tarefa 🗑️
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tarefas;
