import React, { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { Infracao, Tarefa, StatusTarefa, StatusInfracao, FaseRecursal } from '../types';
import { Link, useNavigate } from 'react-router-dom';

// Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
const formatDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const Dashboard: React.FC = () => {
  const [infracoes, setInfracoes] = useState<Infracao[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [infData, tarData] = await Promise.all([
        api.getInfracoes(),
        api.getTarefas()
      ]);
      setInfracoes(infData);
      setTarefas(tarData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProtocolar = async (id: string) => {
    if (confirm('Confirmar protocolo? O processo será movido para a aba de acompanhamento.')) {
      const infracao = infracoes.find(i => i.id === id);
      if (infracao) {
        const updated = {
          status: StatusInfracao.EM_JULGAMENTO,
          dataProtocolo: new Date().toISOString().split('T')[0],
          faseRecursal: FaseRecursal.PRIMEIRA_INSTANCIA // Move to next logic? keeping simple
        };
        try {
          await api.updateInfracao(id, updated);
          await loadData();
          // Redireciona para a aba de acompanhamento conforme solicitado
          navigate('/infracoes?tab=ACOMPANHAMENTO');
        } catch (e) {
          console.error(e);
          alert('Erro ao atualizar infração');
        }
      }
    }
  };

  const protocolosUrgentes = infracoes.filter(i =>
    i.status === StatusInfracao.RECURSO_A_FAZER ||
    i.status === StatusInfracao.INDEFERIDO
  );

  const proximosPrazos = [...protocolosUrgentes].sort((a, b) =>
    new Date(a.dataLimiteProtocolo).getTime() - new Date(b.dataLimiteProtocolo).getTime()
  ).slice(0, 10);

  const tarefasPendentes = tarefas.filter(t => t.status !== StatusTarefa.CONCLUIDA);

  if (loading) return <div className="p-8 text-center font-black text-slate-400 uppercase tracking-widest animate-pulse">Sincronizando Dados...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recursos para Protocolar</p>
          <p className="text-4xl font-black text-slate-900 mt-2">{protocolosUrgentes.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarefas na Agenda</p>
          <p className="text-4xl font-black text-indigo-600 mt-2">{tarefasPendentes.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimentos (5 dias)</p>
          <p className="text-4xl font-black text-rose-600 mt-2">
            {protocolosUrgentes.filter(i => {
              const diff = new Date(i.dataLimiteProtocolo).getTime() - new Date().getTime();
              return diff > 0 && diff < 5 * 24 * 60 * 60 * 1000;
            }).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Próximos Protocolos</h3>
            <Link to="/infracoes" className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Ver Todos</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {proximosPrazos.length > 0 ? proximosPrazos.map(inf => (
              <div key={inf.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                <div className="flex-1">
                  <p className="font-black text-slate-900 text-lg leading-none mb-1">{inf.numeroAuto}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{inf.placa} • {inf.faseRecursal.replace('_', ' ')} • <span className="text-indigo-600">{inf.status.replace('_', ' ')}</span></p>
                  <p className="text-[9px] text-rose-500 mt-2 font-black uppercase">Limite: {formatDateString(inf.dataLimiteProtocolo)}</p>
                </div>
                <div className="flex gap-2">
                  {inf.cliente_id && (
                    <button
                      onClick={() => navigate(`/recursos?tab=CLIENTES&cliente_id=${inf.cliente_id}`)}
                      className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                    >
                      👤 VER CLIENTE
                    </button>
                  )}
                  <button
                    onClick={() => handleProtocolar(inf.id)}
                    className="bg-emerald-600 text-white text-[10px] font-black px-4 py-2.5 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                  >
                    PROTOCOLADO ✅
                  </button>
                </div>
              </div>
            )) : <div className="p-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest opacity-50 italic">Nenhum protocolo para hoje</div>}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Gestão de Tarefa</h3>
            <Link to="/tarefas" className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Gerenciar Tarefa</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {tarefasPendentes.slice(0, 6).map(tar => (
              <div key={tar.id} className="p-5 flex items-center space-x-4 hover:bg-slate-50 transition-colors">
                <div className={`w-2 h-12 rounded-full ${tar.prioridade === 'ALTA' ? 'bg-rose-500' : tar.prioridade === 'MEDIA' ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                <div className="flex-1">
                  <p className="font-black text-slate-900 leading-tight mb-1">{tar.titulo}</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{tar.atribuidaPara} • {formatDateString(tar.dataPrazo)}</p>
                </div>
                <span className={`text-[9px] px-2.5 py-1.5 rounded-xl font-black uppercase ${tar.status === StatusTarefa.EM_ANALISE ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                  {tar.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {tarefasPendentes.length === 0 && <div className="p-16 text-center text-slate-400 font-black uppercase text-xs tracking-widest opacity-50">Tudo em ordem na agenda!</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
