import React, { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { Infracao, Tarefa, StatusTarefa, StatusInfracao, FaseRecursal, User } from '../types';
import { Link } from 'react-router-dom';
import { useGlobalModal } from '../contexts/GlobalModalContext';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

// Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
const formatDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

// Helper function to translate StatusInfracao enum to display label
const translateStatus = (status: string): string => {
  const map: Record<string, string> = {
    'RECURSO_A_FAZER': 'Recurso a Protocolar',
    'PROTOCOLADO_PENDENTE_COMPROVANTE': 'Pendente de Comprovante',
    'EM_JULGAMENTO': 'Em Julgamento',
    'DEFERIDO': 'Deferido',
    'INDEFERIDO': 'Indeferido',
  };
  return map[status] || status.replace(/_/g, ' ');
};

const Dashboard: React.FC = () => {
  const [infracoes, setInfracoes] = useState<Infracao[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const { openInfracaoModal, openClienteModal } = useGlobalModal();

  // Seleção em massa e Protocolo
  const [modoSelecaoInfracoes, setModoSelecaoInfracoes] = useState(false);
  const [infracoesSelecionadas, setInfracoesSelecionadas] = useState<Set<string>>(new Set());
  const [protocoloModalOpen, setProtocoloModalOpen] = useState(false);
  const [protocoloTargetIds, setProtocoloTargetIds] = useState<string[]>([]);
  const [protocoloData, setProtocoloData] = useState('');
  const [isProtocolando, setIsProtocolando] = useState(false);

  const loadData = async () => {
    try {
      const [infData, tarData, usrData] = await Promise.all([
        api.getInfracoes(),
        api.getTarefas(),
        api.getUsers()
      ]);
      setInfracoes(infData);
      setTarefas(tarData);
      setUsuarios(usrData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmarComprovante = async (id: string) => {
    if (confirm('Confirmar o recebimento do comprovante? O processo será movido para a aba de acompanhamento.')) {
      try {
        await api.updateInfracao(id, { status: StatusInfracao.EM_JULGAMENTO });
        await loadData();
        alert('Comprovante confirmado! Processo movido para acompanhamento.');
      } catch (e) {
        console.error(e);
        alert('Erro ao atualizar infração');
      }
    }
  };

  const getLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  };

  const abrirProtocolo = (ids: string[]) => {
    setProtocoloTargetIds(ids);
    setProtocoloData(getLocalDate());
    setProtocoloModalOpen(true);
  };

  const handleConfirmarProtocolo = async () => {
    if (!protocoloData) { alert('Selecione a data de protocolo.'); return; }
    try {
      setIsProtocolando(true);
      await api.protocolarInfracoesEmMassa(protocoloTargetIds, protocoloData);
      setProtocoloModalOpen(false);
      setModoSelecaoInfracoes(false);
      setInfracoesSelecionadas(new Set());
      await loadData();
      alert(`${protocoloTargetIds.length} infração(ões) protocolada(s) com sucesso!`);
    } catch (error: any) {
      alert('Erro ao protocolar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsProtocolando(false);
    }
  };

  const toggleSelecaoInfracao = (id: string) => {
    setInfracoesSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleElaborado = async (id: string, currentValue: boolean) => {
    try {
      await api.updateInfracao(id, { recursoElaborado: !currentValue });
      // Update local state instantly for responsiveness
      setInfracoes(prev => prev.map(inf =>
        inf.id === id ? { ...inf, recursoElaborado: !currentValue } : inf
      ));
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar status de elaboração');
    }
  };

  // Show only resources with status RECURSO_A_FAZER
  const recursosParaProtocolar = infracoes.filter(i =>
    i.status === StatusInfracao.RECURSO_A_FAZER
  );

  // Show only resources with status PROTOCOLADO_PENDENTE_COMPROVANTE
  const aguardandoConfirmacao = infracoes.filter(i =>
    i.status === StatusInfracao.PROTOCOLADO_PENDENTE_COMPROVANTE
  );

  // Sort by deadline, handling missing/invalid dates, and show all items (no slice limit)
  const proximosPrazos = [...recursosParaProtocolar].sort((a, b) => {
    const dateA = a.dataLimiteProtocolo ? new Date(a.dataLimiteProtocolo).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.dataLimiteProtocolo ? new Date(b.dataLimiteProtocolo).getTime() : Number.MAX_SAFE_INTEGER;
    return dateA - dateB;
  });

  const pendentesConfirmacao = [...aguardandoConfirmacao].sort((a, b) => {
    const dateA = a.dataLimiteProtocolo ? new Date(a.dataLimiteProtocolo).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.dataLimiteProtocolo ? new Date(b.dataLimiteProtocolo).getTime() : Number.MAX_SAFE_INTEGER;
    return dateA - dateB;
  });

  const tarefasPendentes = tarefas.filter(t => t.status !== StatusTarefa.CONCLUIDA);

  if (loading) return <div className="p-8 text-center font-black text-slate-400 uppercase tracking-widest animate-pulse">Sincronizando Dados...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recursos a Protocolar</p>
          <p className="text-4xl font-black text-slate-900 mt-2">{recursosParaProtocolar.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando Comprovante</p>
          <p className="text-4xl font-black text-blue-600 mt-2">{aguardandoConfirmacao.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarefas na Agenda</p>
          <p className="text-4xl font-black text-indigo-600 mt-2">{tarefasPendentes.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimentos (5 dias)</p>
          <p className="text-4xl font-black text-rose-600 mt-2">
            {recursosParaProtocolar.filter(i => {
              if (!i.dataLimiteProtocolo) return false;
              const diff = new Date(i.dataLimiteProtocolo).getTime() - new Date().getTime();
              return diff > 0 && diff < 5 * 24 * 60 * 60 * 1000;
            }).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Próximos Protocolos</h3>
            <div className="flex gap-2">
              {proximosPrazos.length > 0 && (
                <button
                  onClick={() => {
                    setModoSelecaoInfracoes(!modoSelecaoInfracoes);
                    setInfracoesSelecionadas(new Set());
                  }}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${modoSelecaoInfracoes ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                >
                  {modoSelecaoInfracoes ? '✕ Cancelar' : '☑️ Selecionar'}
                </button>
              )}
              <Link to="/recursos?tab=PROCESSOS" className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-transparent">Ver Todos</Link>
            </div>
          </div>
          {modoSelecaoInfracoes && (
            <div className="bg-indigo-700 p-3 flex justify-between items-center text-white">
              <span className="text-xs font-black uppercase tracking-wider">
                ☑️ {infracoesSelecionadas.size} selecionada(s)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setInfracoesSelecionadas(new Set(proximosPrazos.map(i => i.id)))}
                  className="text-[9px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors uppercase"
                >
                  Todas
                </button>
                <button
                  disabled={infracoesSelecionadas.size === 0}
                  onClick={() => abrirProtocolo([...infracoesSelecionadas])}
                  className="text-[10px] font-black bg-amber-500 hover:bg-amber-600 disabled:opacity-40 px-3 py-1.5 rounded transition-colors uppercase tracking-wide shadow"
                >
                  📌 Protocolar {infracoesSelecionadas.size > 0 ? `(${infracoesSelecionadas.size})` : ''}
                </button>
              </div>
            </div>
          )}
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto flex-1">
            {proximosPrazos.length > 0 ? proximosPrazos.map(inf => {
              // Calculate days until deadline
              const daysUntilDeadline = Math.ceil((new Date(inf.dataLimiteProtocolo).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              const isOverdue = daysUntilDeadline < 0;
              const isUrgent = daysUntilDeadline <= 3 && daysUntilDeadline >= 0;
              const isWarning = daysUntilDeadline > 3 && daysUntilDeadline <= 7;

              const isSelecionada = infracoesSelecionadas.has(inf.id);

              return (
                <div key={inf.id} 
                  className={`p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all group gap-4 
                    ${modoSelecaoInfracoes ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:bg-slate-50'}
                    ${modoSelecaoInfracoes && isSelecionada ? 'bg-indigo-50/50 border-l-4 border-indigo-500' : 
                      inf.recursoElaborado ? 'bg-emerald-50/60 border-l-4 border-emerald-500' :
                      isOverdue ? 'bg-rose-50 border-l-4 border-rose-500' :
                      isUrgent ? 'bg-orange-50 border-l-4 border-orange-500' :
                      isWarning ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''
                    }`}
                  onClick={modoSelecaoInfracoes ? () => toggleSelecaoInfracao(inf.id) : undefined}
                >
                  <div className="flex items-start gap-3 flex-1">
                    {modoSelecaoInfracoes && (
                      <div
                        className={`mt-1.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelecionada ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                        }`}
                        onClick={e => { e.stopPropagation(); toggleSelecaoInfracao(inf.id); }}
                      >
                        {isSelecionada && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                    <label
                      className="relative flex items-center justify-center cursor-pointer mt-1.5 group/check"
                      title={inf.recursoElaborado ? 'Desmarcar como elaborado' : 'Marcar como elaborado'}
                      onClick={e => modoSelecaoInfracoes && e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={inf.recursoElaborado}
                        onChange={() => handleToggleElaborado(inf.id, inf.recursoElaborado)}
                        className="sr-only peer"
                      />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 ${
                        inf.recursoElaborado
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 bg-white group-hover/check:border-emerald-400'
                      }`}>
                        {inf.recursoElaborado && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>
                    <div className="flex-1">
                      <p 
                        className="font-black text-slate-900 text-lg leading-none mb-1 cursor-pointer hover:text-indigo-600 transition-colors"
                        onClick={() => openInfracaoModal(inf.id, { onSave: loadData })}
                        title="Editar Infração"
                      >
                        {inf.numeroAuto}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {inf.placa} • {inf.faseRecursal.replace('_', ' ')} • <span className="text-indigo-600">{translateStatus(inf.status)}</span>
                      </p>
                      <p className={`text-[9px] mt-2 font-black uppercase flex items-center gap-1 ${isOverdue ? 'text-rose-600' :
                        isUrgent ? 'text-orange-600' :
                          isWarning ? 'text-yellow-700' : 'text-slate-500'
                        }`}>
                        {isOverdue && '⚠️ VENCIDO'}
                        {isUrgent && !isOverdue && '🔴 URGENTE'}
                        {isWarning && '⚡ ATENÇÃO'}
                        {!isOverdue && !isUrgent && !isWarning && '📅'}
                        {' '}Limite: {formatDateString(inf.dataLimiteProtocolo)}
                        {!isOverdue && ` (${daysUntilDeadline} dia${daysUntilDeadline !== 1 ? 's' : ''})`}
                        {inf.recursoElaborado && (
                          <span className="ml-2 inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-emerald-200">
                            ✅ ELABORADO
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                    {!modoSelecaoInfracoes && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {inf.cliente_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openClienteModal(inf.cliente_id || '', { onSave: loadData }); }}
                            className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
                          >
                            👤 VER CLIENTE
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); abrirProtocolo([inf.id]); }}
                          className="bg-amber-600 text-white text-[10px] font-black px-4 py-2.5 rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 active:scale-95 whitespace-nowrap"
                        >
                          📌 PROTOCOLAR
                        </button>
                      </div>
                    )}
                    {inf.usuario_id && (() => {
                      const user = usuarios.find(u => u.id === inf.usuario_id);
                      return user ? <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">👤 RESPONSÁVEL: {user.name}</span> : null;
                    })()}
                  </div>
                </div>
              );
            }) : <div className="p-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest opacity-50 italic">Nenhum protocolo para hoje</div>}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Aguardando Comprovante</h3>
            <Link to="/recursos?tab=PROCESSOS" className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Ver Todos</Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto flex-1">
            {pendentesConfirmacao.length > 0 ? pendentesConfirmacao.map(inf => {
              return (
                <div key={inf.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 transition-colors group bg-blue-50/20 border-l-4 border-blue-400 gap-4">
                  <div className="flex-1">
                    <p 
                      className="font-black text-slate-900 text-lg leading-none mb-1 cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => openInfracaoModal(inf.id, { onSave: loadData })}
                      title="Editar Infração"
                    >
                      {inf.numeroAuto}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {inf.placa} • {inf.faseRecursal.replace('_', ' ')} • <span className="text-blue-600">{inf.status.replace('_', ' ')}</span>
                    </p>
                    <p className="text-[9px] mt-2 font-black uppercase text-slate-500 flex items-center gap-1">
                      📅 Protocolado em: {inf.dataProtocolo ? formatDateString(inf.dataProtocolo) : 'Pendente'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                    <div className="flex flex-wrap gap-2 justify-end">
                      {inf.cliente_id && (
                        <button
                          onClick={() => openClienteModal(inf.cliente_id, { onSave: loadData })}
                          className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
                        >
                          👤 VER CLIENTE
                        </button>
                      )}
                      <button
                        onClick={() => handleConfirmarComprovante(inf.id)}
                        className="bg-blue-600 text-white text-[10px] font-black px-4 py-2.5 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 whitespace-nowrap"
                      >
                        CONFIRMAR 📎
                      </button>
                    </div>
                    {inf.usuario_id && (() => {
                      const user = usuarios.find(u => u.id === inf.usuario_id);
                      return user ? <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">👤 RESPONSÁVEL: {user.name}</span> : null;
                    })()}
                  </div>
                </div>
              );
            }) : <div className="p-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest opacity-50 italic">Nenhum comprovante pendente</div>}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Gestão de Tarefa</h3>
            <Link to="/tarefas" className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Gerenciar Tarefa</Link>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {tarefasPendentes.slice(0, 6).map(tar => (
              <div key={tar.id} className="p-5 flex items-center space-x-4 hover:bg-slate-50 transition-colors">
                <div className={`w-2 h-12 rounded-full flex-shrink-0 ${tar.prioridade === 'ALTA' ? 'bg-rose-500' : tar.prioridade === 'MEDIA' ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 leading-tight mb-1 truncate">{tar.titulo}</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{tar.atribuidaPara} • {formatDateString(tar.dataPrazo)}</p>
                </div>
                <span className={`text-[9px] px-2.5 py-1.5 rounded-xl font-black uppercase flex-shrink-0 ${tar.status === StatusTarefa.EM_ANALISE ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                  {tar.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {tarefasPendentes.length === 0 && <div className="p-16 text-center text-slate-400 font-black uppercase text-xs tracking-widest opacity-50 italic">Tudo em ordem na agenda!</div>}
          </div>
        </div>
      </div>

      <Modal isOpen={protocoloModalOpen} onClose={() => setProtocoloModalOpen(false)} title="📌 Registrar Protocolo">
        <div className="space-y-5">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="text-sm font-bold text-amber-800 text-center">
              {protocoloTargetIds.length === 1
                ? 'Registrar o protocolo desta infração.'
                : `Registrar o protocolo de ${protocoloTargetIds.length} infrações em massa.`}
            </p>
            <p className="text-xs text-amber-600 text-center mt-1">
              O status será alterado para <strong>Pendente de Comprovante</strong>.
            </p>
          </div>
          <Input
            label="Data do Protocolo"
            type="date"
            value={protocoloData}
            onChange={e => setProtocoloData(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setProtocoloModalOpen(false)}>Cancelar</Button>
            <Button
              variant="ghost"
              onClick={handleConfirmarProtocolo}
              disabled={isProtocolando || !protocoloData}
              className="border border-amber-300 bg-amber-500 text-white hover:bg-amber-600 font-bold px-8"
            >
              {isProtocolando ? '⏳ Registrando...' : '📌 Confirmar Protocolo'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Dashboard;
