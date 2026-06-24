import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Infracao, StatusInfracao, User } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { useGlobalModal } from '../../contexts/GlobalModalContext';

// Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
// WITHOUT creating a Date object (which would cause timezone conversion)
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

const Infracoes: React.FC = () => {
  const [infracoes, setInfracoes] = useState<Infracao[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const { openInfracaoModal, openClienteModal } = useGlobalModal();
  const [activeTab, setActiveTab] = useState<'GESTAO' | 'ACOMPANHAMENTO' | 'DEFERIDOS'>('GESTAO');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' });
  const [dateFilterType, setDateFilterType] = useState<'event' | 'registration'>('event');

  const [usersList, setUsersList] = useState<User[]>([]);

  // Seleção em massa
  const [modoSelecaoInfracoes, setModoSelecaoInfracoes] = useState(false);
  const [infracoesSelecionadas, setInfracoesSelecionadas] = useState<Set<string>>(new Set());

  // Modal de protocolo
  const [protocoloModalOpen, setProtocoloModalOpen] = useState(false);
  const [protocoloTargetIds, setProtocoloTargetIds] = useState<string[]>([]);
  const [protocoloData, setProtocoloData] = useState('');
  const [isProtocolando, setIsProtocolando] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'ACOMPANHAMENTO' || tab === 'GESTAO' || tab === 'DEFERIDOS') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  useEffect(() => {
    const editId = searchParams.get('edit_infracao');
    const editAuto = searchParams.get('edit_infracao_by_auto');

    if (editId && infracoes.length > 0) {
      const inf = infracoes.find(i => i.id === editId);
      if (inf) {
        openInfracaoModal(inf.id, { onSave: load });
      } else {
        alert('Infração não encontrada.');
      }
      searchParams.delete('edit_infracao');
      searchParams.delete('returnTo');
      setSearchParams(searchParams, { replace: true });
    } else if (editAuto && infracoes.length > 0) {
      const inf = infracoes.find(i => i.numeroAuto.trim().toLowerCase() === editAuto.trim().toLowerCase());
      if (inf) {
        openInfracaoModal(inf.id, { onSave: load });
      } else {
        alert(`Auto de infração "${editAuto}" não encontrado.`);
      }
      searchParams.delete('edit_infracao_by_auto');
      searchParams.delete('returnTo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, infracoes, setSearchParams]);

  const load = async () => {
    try {
      const [data, users] = await Promise.all([
        api.getInfracoes(),
        api.getUsers()
      ]);
      setInfracoes(data);
      setUsersList(users);
    } catch (error) {}
  };

  useEffect(() => { load(); }, []);

  const handleExportCSV = () => {
    const { start, end } = exportDateRange;
    if (!start || !end) {
      alert("Por favor, selecione o período.");
      return;
    }

    const filtered = infracoes.filter(inf => {
      // Choose which date field to filter by
      const compareDate = dateFilterType === 'event'
        ? inf.dataInfracao        // Event date (when infraction occurred)
        : inf.criadoEm;           // Registration date (when record was created)

      if (!compareDate) return false;

      // Use string comparison to avoid timezone issues
      const dateOnly = compareDate.split('T')[0];
      const matches = dateOnly >= start && dateOnly <= end;

      return matches;
    });

    if (filtered.length === 0) {
      alert("Nenhum registro para este período.");
      return;
    }

    // Cabeçalhos detalhados
    const headers = [
      "NÚMERO AUTO",
      "PLACA",
      "CLIENTE ID",
      "ÓRGÃO",
      "DATA INFRAÇÃO",
      "DATA LIMITE PROTOCOLO",
      "DATA PROTOCOLO",
      "FASE RECURSAL",
      "STATUS ATUAL",
      "INTERVALO ACOMP.",
      "DESCRIÇÃO",
      "OBSERVAÇÕES"
    ];

    const rows = filtered.map(inf => [
      inf.numeroAuto,
      inf.placa,
      inf.cliente_id || '',
      inf.orgao_responsavel || '',
      formatDateString(inf.dataInfracao),
      formatDateString(inf.dataLimiteProtocolo),
      inf.dataProtocolo ? formatDateString(inf.dataProtocolo) : '',
      inf.faseRecursal.replace('_', ' '),
      inf.status.replace('_', ' '),
      inf.intervaloAcompanhamento === 0 ? "NUNCA" : `${inf.intervaloAcompanhamento} DIAS`,
      inf.descricao.replace(/(\r\n|\n|\r|;)/gm, " "),
      inf.observacoes?.replace(/(\r\n|\n|\r|;)/gm, " ") || ""
    ]);

    // Usar ponto e vírgula como delimitador (padrão Excel Brasil)
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(";"))
    ].join("\n");

    // Adiciona o BOM para UTF-8 (garante acentuação no Excel)
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_DoutorRecursos_${start}_a_${end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsExportModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir permanentemente este registro?')) {
      try {
        await api.deleteInfracao(id);
        await load();
      } catch (error: any) {
        console.error('Error deleting infracao:', error);
        alert('Erro ao excluir infração: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  const handleViewCliente = (clienteId: string) => {
    if (!clienteId) {
      alert('Esta infração não está vinculada a um cliente.');
      return;
    }
    openClienteModal(clienteId, { onSave: load });
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
      await load();
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

  const filteredInfracoes = infracoes.filter(inf => {
    // Search Filter
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = searchTerm === '' ||
      inf.placa.toLowerCase().includes(searchLower) ||
      inf.numeroAuto.toLowerCase().includes(searchLower);

    if (!matchSearch) return false;

    if (activeTab === 'DEFERIDOS') return inf.status === StatusInfracao.DEFERIDO;
    if (activeTab === 'ACOMPANHAMENTO') return inf.status === StatusInfracao.EM_JULGAMENTO;
    return inf.status !== StatusInfracao.DEFERIDO;
  }).sort((a, b) => {
    if (activeTab === 'ACOMPANHAMENTO') {
      const getProx = (inf: Infracao) => {
        // Updated Logic: Count starts from dataProtocolo if confirmed, else fallback chain
        const base = inf.ultimaVerificacao ? new Date(inf.ultimaVerificacao) :
          (inf.dataProtocolo ? new Date(inf.dataProtocolo) : new Date(inf.criadoEm));
        return base.getTime() + (inf.intervaloAcompanhamento || 15) * 24 * 60 * 60 * 1000;
      };
      return getProx(a) - getProx(b);
    }
    return new Date(a.dataLimiteProtocolo).getTime() - new Date(b.dataLimiteProtocolo).getTime();
  });

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Gestão de Infrações</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Escritório Doutor Recursos</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {infracoes.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setModoSelecaoInfracoes(!modoSelecaoInfracoes);
                setInfracoesSelecionadas(new Set());
              }}
              className={`py-4 rounded-3xl border ${modoSelecaoInfracoes ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}
            >
              {modoSelecaoInfracoes ? '✕ Cancelar' : '☑️ Selecionar'}
            </Button>
          )}
          <div className="relative flex-1 sm:w-64">
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar placa ou auto..."
              className="pl-8"
            />
            <span className="absolute left-3 top-3.5 text-slate-400">🔍</span>
          </div>
          <Button variant="outline" onClick={() => setIsExportModalOpen(true)} className="py-4 rounded-3xl" icon="📊">
            Gerar Planilha
          </Button>
          <Button variant="secondary" onClick={() => openInfracaoModal(null, { onSave: load })} className="py-4 rounded-3xl shadow-2xl" icon="➕">
            Novo Registro
          </Button>
        </div>
      </div>

      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Exportar Processos (CSV)">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Filtrar Por
            </label>
            <Select
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value as any)}
            >
              <option value="event">Data da Infração (Data do Evento)</option>
              <option value="registration">Data de Cadastro no Sistema</option>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {dateFilterType === 'event'
                ? '📅 Filtra pela data em que a infração ocorreu'
                : '📝 Filtra pela data em que o processo foi cadastrado no sistema'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <Input
              label="Início"
              type="date"
              value={exportDateRange.start}
              onChange={e => setExportDateRange({ ...exportDateRange, start: e.target.value })}
            />
            <Input
              label="Fim"
              type="date"
              value={exportDateRange.end}
              onChange={e => setExportDateRange({ ...exportDateRange, end: e.target.value })}
            />
          </div>
          <Button onClick={handleExportCSV} fullWidth className="py-4 rounded-3xl">
            Baixar Planilha Organizada
          </Button>
        </div>
      </Modal>

      <div className="flex space-x-1 bg-slate-200/50 p-1.5 rounded-3xl w-full max-w-3xl border border-slate-200">
        <button onClick={() => setActiveTab('GESTAO')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest ${activeTab === 'GESTAO' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}>📂 Gestão Geral</button>
        <button onClick={() => setActiveTab('ACOMPANHAMENTO')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest ${activeTab === 'ACOMPANHAMENTO' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500'}`}>⏱️ Acompanhamento</button>
        <button onClick={() => setActiveTab('DEFERIDOS')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest ${activeTab === 'DEFERIDOS' ? 'bg-white text-emerald-700 shadow-md' : 'text-slate-500'}`}>✅ Deferidos</button>
      </div>

      {modoSelecaoInfracoes && (
        <div className="flex items-center justify-between bg-indigo-700 text-white px-6 py-4 rounded-3xl shadow-lg mt-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-black uppercase tracking-wider">
              ☑️ {infracoesSelecionadas.size} selecionada(s)
            </span>
            <button
              onClick={() => setInfracoesSelecionadas(new Set(filteredInfracoes.map(i => i.id)))}
              className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-colors uppercase"
            >
              Todas Visíveis
            </button>
            <button
              onClick={() => setInfracoesSelecionadas(new Set())}
              className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-colors uppercase"
            >
              Nenhuma
            </button>
          </div>
          <button
            disabled={infracoesSelecionadas.size === 0}
            onClick={() => abrirProtocolo([...infracoesSelecionadas])}
            className="flex items-center gap-2 text-sm font-black bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-2.5 rounded-2xl transition-colors uppercase tracking-wide shadow-md"
          >
            📌 Protocolar {infracoesSelecionadas.size > 0 ? `(${infracoesSelecionadas.size})` : ''}
          </button>
        </div>
      )}

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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {modoSelecaoInfracoes && <th className="p-6 w-12 text-center">Sel.</th>}
              <th className="p-6">Infração / Placa</th>
              <th className="p-6">Fase / Acompanhamento</th>
              <th className="p-6">Status</th>
              <th className="p-6">{activeTab === 'ACOMPANHAMENTO' ? 'Próxima Verif.' : 'Prazo Protocolo'}</th>
              <th className="p-6 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredInfracoes.map(inf => {
              const baseDate = inf.ultimaVerificacao ? new Date(inf.ultimaVerificacao) :
                (inf.dataProtocolo ? new Date(inf.dataProtocolo) : new Date(inf.criadoEm));
              const proxVerifDate = new Date(baseDate.getTime() + (inf.intervaloAcompanhamento || 15) * 24 * 60 * 60 * 1000);
              const isVencido = proxVerifDate.getTime() < new Date().getTime();
              const responsavel = usersList.find(u => u.id === inf.usuario_id);
              const isSelecionada = infracoesSelecionadas.has(inf.id);

              return (
                <tr
                  key={inf.id}
                  className={`hover:bg-slate-50/50 transition-colors ${modoSelecaoInfracoes && isSelecionada ? 'bg-indigo-50/50' : ''}`}
                  onClick={modoSelecaoInfracoes ? () => toggleSelecaoInfracao(inf.id) : undefined}
                >
                  {modoSelecaoInfracoes && (
                    <td className="p-6 text-center cursor-pointer">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mx-auto transition-all ${
                          isSelecionada ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                        }`}
                      >
                        {isSelecionada && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="p-6">
                    <p className="font-black text-slate-900 leading-none mb-1">{inf.numeroAuto}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase">{inf.placa}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-[10px] font-black text-slate-700 uppercase">{inf.faseRecursal.replace('_', ' ')}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{inf.intervaloAcompanhamento === 0 ? 'Sem monitoramento' : `Monitorar a cada ${inf.intervaloAcompanhamento}d`}</p>
                    {inf.dataProtocolo && <p className="text-[8px] text-emerald-600 mt-1">Prot: {formatDateString(inf.dataProtocolo)}</p>}
                  </td>
                  <td className="p-6">
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase border ${inf.status === StatusInfracao.DEFERIDO ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      inf.status === StatusInfracao.INDEFERIDO ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        inf.status === StatusInfracao.RECURSO_A_FAZER ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                          inf.status === StatusInfracao.PROTOCOLADO_PENDENTE_COMPROVANTE ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                      {translateStatus(inf.status)}
                    </span>
                    {inf.recursoElaborado && (
                      <span className="mt-1.5 flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-emerald-200 w-fit">
                        ✅ Elaborado
                      </span>
                    )}
                    {responsavel && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">
                          {responsavel.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wide">
                          👤 {responsavel.name}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-6 font-black text-sm text-slate-700">
                    {activeTab === 'ACOMPANHAMENTO' ? formatDateString(proxVerifDate.toISOString().split('T')[0]) : formatDateString(inf.dataLimiteProtocolo)}
                    {activeTab === 'ACOMPANHAMENTO' && isVencido && <span className="block text-[8px] text-indigo-500 uppercase tracking-tighter">Verificar agora!</span>}
                  </td>
                  <td className="p-6 text-right space-x-1">
                    {!modoSelecaoInfracoes && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); abrirProtocolo([inf.id]); }}
                          className="text-amber-600 hover:text-amber-800 text-[10px] font-black uppercase tracking-wide bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl transition-colors mr-1"
                        >
                          📌 Protocolar
                        </button>
                        {inf.cliente_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleViewCliente(inf.cliente_id || ''); }}
                            className="text-emerald-600 hover:bg-emerald-50"
                          >
                            👤 Ver Cliente
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openInfracaoModal(inf.id, { onSave: load }); }} className="text-indigo-600 hover:bg-indigo-50">Editar</Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(inf.id); }} className="text-rose-600 hover:bg-rose-50">Excluir</Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Infracoes;
