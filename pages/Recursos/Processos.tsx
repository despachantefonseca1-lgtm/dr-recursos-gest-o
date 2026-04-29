


import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Infracao, FaseRecursal, StatusInfracao, UserRole, RecursoCliente, RecursoVeiculo, TeseRecurso } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';

// Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
// WITHOUT creating a Date object (which would cause timezone conversion)
const formatDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const Infracoes: React.FC = () => {
  const [infracoes, setInfracoes] = useState<Infracao[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'GESTAO' | 'ACOMPANHAMENTO' | 'DEFERIDOS'>('GESTAO');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Linked Data State
  const [clientesList, setClientesList] = useState<RecursoCliente[]>([]);
  const [veiculosList, setVeiculosList] = useState<RecursoVeiculo[]>([]);

  // Teses state
  const [tesesList, setTesesList] = useState<TeseRecurso[]>([]);
  const [selectedTeses, setSelectedTeses] = useState<string[]>([]);
  const [isTesesModalOpen, setIsTesesModalOpen] = useState(false);

  const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' });
  const [dateFilterType, setDateFilterType] = useState<'event' | 'registration'>('event');

  const [formData, setFormData] = useState<Omit<Infracao, 'id' | 'criadoEm' | 'atualizadoEm' | 'historicoStatus'>>({
    numeroAuto: '',
    placa: '',
    cliente_id: '',
    veiculo_id: '',
    orgao_responsavel: '',
    dataInfracao: '',
    dataLimiteProtocolo: '',
    dataProtocolo: '',
    faseRecursal: FaseRecursal.DEFESA_PREVIA,
    status: StatusInfracao.RECURSO_A_FAZER,
    acompanhamentoMensal: false,
    intervaloAcompanhamento: 15,
    descricao: '',
    observacoes: ''
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'ACOMPANHAMENTO' || tab === 'GESTAO' || tab === 'DEFERIDOS') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const load = async () => {
    try {
      const data = await api.getInfracoes();
      setInfracoes(data);
    } catch (error) {
      // No console.error here as per instruction to remove debug logs
    }
    setClientesList(await api.getRecursosClientes());
    const teses = await api.getTeses();
    setTesesList(teses);
  };

  useEffect(() => { load(); }, []);

  // When editing, if there is a client_id, fetch their vehicles
  useEffect(() => {
    if (formData.cliente_id) {
      api.getRecursosVeiculos(formData.cliente_id).then(setVeiculosList);
    } else {
      setVeiculosList([]);
    }
  }, [formData.cliente_id]);

  const handleClienteChange = async (clienteId: string) => {
    setFormData({ ...formData, cliente_id: clienteId, veiculo_id: '', placa: '' });
  };

  const handleVeiculoChange = (veiculoId: string) => {
    const veiculo = veiculosList.find(v => v.id === veiculoId);
    if (veiculo) {
      setFormData({ ...formData, veiculo_id: veiculoId, placa: veiculo.placa });
    }
  };

  const handlePlacaChange = (val: string) => {
    // Limit to 8 characters max
    if (val.length > 8) return;
    setFormData({ ...formData, placa: val.toUpperCase() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for Placa Format (simplified check for 8 chars or expected pattern if needed)
    // "3 caracteres o quanto é um - e mais 4 caracteres no final" -> e.g. "ABC-1234" (8 chars)
    if (formData.placa.length > 0 && formData.placa.length < 7) {
      alert("A placa deve ter pelo menos 7 caracteres (ex: ABC1234 ou ABC-1234).");
      return;
    }

    try {
      let result;
      if (editingId) {
        result = await api.updateInfracao(editingId, {
          ...formData,
          dataProtocolo: formData.dataProtocolo || null,
          ultimaVerificacao: (formData.status === StatusInfracao.EM_JULGAMENTO && !formData.ultimaVerificacao) ? new Date().toISOString() : formData.ultimaVerificacao
        });
      } else {
        result = await api.createInfracao({
          ...formData,
          dataProtocolo: formData.dataProtocolo || null,
          ultimaVerificacao: formData.status === StatusInfracao.EM_JULGAMENTO ? new Date().toISOString() : undefined
        } as any);
      }

      if (!result) {
        throw new Error("O servidor não retornou os dados salvos. Verifique sua conexão.");
      }

      alert("Infração salva com sucesso!");
      setIsFormOpen(false);
      setEditingId(null);
      setSelectedTeses([]);
      setFormData({
        numeroAuto: '', placa: '', cliente_id: '', veiculo_id: '', orgao_responsavel: '', dataInfracao: '', dataLimiteProtocolo: '', dataProtocolo: '',
        faseRecursal: FaseRecursal.DEFESA_PREVIA, status: StatusInfracao.RECURSO_A_FAZER,
        acompanhamentoMensal: false, intervaloAcompanhamento: 15, descricao: '', observacoes: ''
      });
      load();
    } catch (e: any) {
      console.error("Error saving infracao:", e);
      alert("Erro ao salvar: " + (e.message || e));
    }
  };

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
        : inf.criadoEm;             // Registration date (when record was created)

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

  const startEdit = (inf: Infracao) => {
    setFormData({
      ...inf,
      dataProtocolo: inf.dataProtocolo || ''
    });
    setEditingId(inf.id);
    setSelectedTeses([]);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir permanentemente este registro?')) {
      try {
        await api.deleteInfracao(id);
        await load(); // Added await for instant UI update
      } catch (error: any) {
        console.error('Error deleting infracao:', error);
        alert('Erro ao excluir infração: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  const handleNavigateToCliente = (clienteId: string) => {
    if (!clienteId) {
      alert('Esta infração não está vinculada a um cliente.');
      return;
    }
    // Navigate to Recursos page with CLIENTES tab and cliente_id parameter
    navigate(`/recursos?tab=CLIENTES&cliente_id=${clienteId}`);
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

  // Header Generator State
  const [headerContent, setHeaderContent] = useState('');
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);

  const generateHeader = () => {
    if (!formData.cliente_id || !formData.veiculo_id) {
      alert("Selecione um Cliente e um Veículo para gerar o cabeçalho.");
      return;
    }

    const cliente = clientesList.find(c => c.id === formData.cliente_id);
    const veiculo = veiculosList.find(v => v.id === formData.veiculo_id);

    if (!cliente || !veiculo) {
      alert("Dados do cliente ou veículo não encontrados.");
      return;
    }

    const orgao = formData.orgao_responsavel ? formData.orgao_responsavel.toUpperCase() : "SECRETARIA DE TRÂNSITO/MG";
    const auto = formData.numeroAuto ? formData.numeroAuto.toUpperCase() : "_________________";
    const descricao = formData.descricao || "XXXXXXXXXXXX";
    const rgCompleto = cliente.rg
      ? `${cliente.rg} ${cliente.rg_orgao_emissor || 'SSP'} ${cliente.rg_uf || 'MG'}`
      : 'N/I';

    let text = `AO ILMOS. SENHORES MEMBROS JULGADORES DA ${orgao}.

AUTO DE INFRAÇÃO SOB O Nº ${auto}.

${cliente.nome}, ${cliente.nacionalidade || 'brasileiro(a)'}, ${cliente.estado_civil || 'solteiro(a)'}, ${cliente.profissao || 'autônomo(a)'}, Inscrito CPF N°${cliente.cpf}, RG N°${rgCompleto}, Residente e Domiciliado ${cliente.endereco}, condutor do veículo ${veiculo.marca || ''}/${veiculo.modelo}, placa ${veiculo.placa}, RENAVAM ${veiculo.renavam || '___________'}, CHASSI ${veiculo.chassi || '_________________'}.

Vem por intermédio de seu advogado, com procuração em anexo, com endereço profissional á Avenida Das Palmeiras, N°512, Centro, Bom Despacho-MG, CEP 35.630-002, e endereço eletrônico ifadvogado214437@gmail.com, muito respeitosamente à presença de vossos senhores apresentar; defesa, baseado na Lei nº 9.503 de 23/09/97 sobre a acusação de ${descricao}.`;

    // Append selected teses
    if (selectedTeses.length > 0) {
      const tesesSelecionadas = tesesList.filter(t => selectedTeses.includes(t.id));

      text += `

DO DIREITO:
`;
      tesesSelecionadas.forEach((tese) => {
        text += `
${tese.texto}
`;
      });

      text += `
Em face do exposto, requer a V. Exã. que se digne em DEFERIR o presente recurso pelas razões de direito acima expostas, evitando assim o pagamento de multa indevida.`;
    }

    setHeaderContent(text);
    setIsHeaderModalOpen(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(headerContent);
    alert("Texto copiado!");
  };

  return (
    <div className="space-y-6">
      {/* ... previous content ... */}

      <Modal
        isOpen={isHeaderModalOpen}
        onClose={() => setIsHeaderModalOpen(false)}
        title="Cabeçalho do Recurso"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Copie o texto abaixo e cole no seu editor de texto.</p>
          <textarea
            className="w-full h-96 p-4 border rounded-xl text-sm font-serif bg-slate-50 focus:outline-none focus:ring-2 ring-indigo-500"
            value={headerContent}
            readOnly
          />
          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => setIsHeaderModalOpen(false)}>Fechar</Button>
            <Button variant="primary" onClick={copyToClipboard}>Copiar Texto</Button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Gestão de Infrações</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Escritório Doutor Recursos</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
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
          <Button variant="secondary" onClick={() => {
            setIsFormOpen(true);
            setEditingId(null);
            setFormData({
              numeroAuto: '', placa: '', cliente_id: '', veiculo_id: '', orgao_responsavel: '', dataInfracao: '', dataLimiteProtocolo: '', dataProtocolo: '',
              faseRecursal: FaseRecursal.DEFESA_PREVIA, status: StatusInfracao.RECURSO_A_FAZER,
              acompanhamentoMensal: false, intervaloAcompanhamento: 15, descricao: '', observacoes: ''
            });
          }} className="py-4 rounded-3xl shadow-2xl" icon="➕">
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

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? "Editar Infração" : "Nova Infração"}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input
            label="Nº Auto"
            required
            value={formData.numeroAuto}
            onChange={e => setFormData({ ...formData, numeroAuto: e.target.value })}
          />

          <Select
            label="Cliente"
            value={formData.cliente_id || ''}
            onChange={e => handleClienteChange(e.target.value)}
          >
            <option value="">Selecione um Cliente</option>
            {clientesList.map(c => (
              <option key={c.id} value={c.id}>{c.nome} - {c.cpf}</option>
            ))}
          </Select>

          {formData.cliente_id ? (
            <Select
              label="Veículo"
              value={formData.veiculo_id || ''}
              onChange={e => handleVeiculoChange(e.target.value)}
            >
              <option value="">Selecione um Veículo</option>
              {veiculosList.map(v => (
                <option key={v.id} value={v.id}>{v.modelo} - {v.placa}</option>
              ))}
            </Select>
          ) : (
            <Input
              label="Placa (Avulsa)"
              value={formData.placa}
              onChange={e => handlePlacaChange(e.target.value)}
              placeholder="ABC-1234"
            />
          )}

          {formData.cliente_id && (
            <Input
              label="Placa (Confirmada)"
              value={formData.placa}
              readOnly
              className="bg-slate-100"
            />
          )}

          <Input
            label="Órgão Responsável"
            value={formData.orgao_responsavel || ''}
            onChange={e => setFormData({ ...formData, orgao_responsavel: e.target.value })}
            placeholder="Ex: DER/MG, PRF..."
          />
          <Input
            label="Data Infração"
            type="date"
            required
            value={formData.dataInfracao}
            onChange={e => setFormData({ ...formData, dataInfracao: e.target.value })}
          />
          <Input
            label="Limite Protocolo"
            type="date"
            required
            value={formData.dataLimiteProtocolo}
            onChange={e => setFormData({ ...formData, dataLimiteProtocolo: e.target.value })}
          />

          {(formData.dataProtocolo || editingId) && (
            <Input
              label="Data Protocolo Confirmada"
              type="date"
              value={formData.dataProtocolo || ''}
              onChange={e => setFormData({ ...formData, dataProtocolo: e.target.value })}
            />
          )}

          <Select
            label="Fase Jurídica"
            value={formData.faseRecursal}
            onChange={e => setFormData({ ...formData, faseRecursal: e.target.value as any })}
          >
            <option value={FaseRecursal.DEFESA_PREVIA}>Defesa Prévia</option>
            <option value={FaseRecursal.PRIMEIRA_INSTANCIA}>1ª Instância (JARI)</option>
            <option value={FaseRecursal.SEGUNDA_INSTANCIA}>2ª Instância (CETRAN)</option>
          </Select>
          <Select
            label="Acompanhamento (Dias)"
            value={formData.intervaloAcompanhamento}
            onChange={e => setFormData({ ...formData, intervaloAcompanhamento: parseInt(e.target.value) as any })}
          >
            <option value={0}>Nunca</option>
            <option value={15}>A cada 15 dias</option>
            <option value={30}>A cada 30 dias</option>
          </Select>
          <Select
            label="Status Atual"
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
          >
            <option value={StatusInfracao.RECURSO_A_FAZER}>Recurso a Fazer</option>
            <option value={StatusInfracao.EM_JULGAMENTO}>Em Julgamento</option>
            <option value={StatusInfracao.DEFERIDO}>Deferido</option>
            <option value={StatusInfracao.INDEFERIDO}>Indeferido</option>
          </Select>
          <div className="md:col-span-2">
            <Textarea
              label="Descrição da Infração"
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Excesso de velocidade acima de 50%"
              className="h-12"
            />
          </div>


          <div className="md:col-span-3">
            <Input
              label="Observações do Processo"
              value={formData.observacoes}
              onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Ex: Cliente aguardando retorno sobre multa municipal"
            />
            <div className="mt-3">
              <Button type="button" variant="outline" onClick={() => setIsTesesModalOpen(true)} className="w-full justify-center">
                ⚖️ {selectedTeses.length > 0 ? `Teses Incluídas (${selectedTeses.length}) - Editar` : 'Incluir Teses'}
              </Button>
            </div>
          </div>
          <div className="md:col-span-3 flex justify-between pt-6 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={generateHeader} icon="📄">
              Gerar Cabeçalho
            </Button>
            <div className="flex space-x-3">
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
                Fechar
              </Button>
              <Button type="submit" variant="primary" className="px-12 py-4 rounded-3xl">
                Salvar Infração
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal for Selecting Teses */}
      <Modal
        isOpen={isTesesModalOpen}
        onClose={() => setIsTesesModalOpen(false)}
        title="Incluir Teses de Recurso"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500">
              Selecione as teses jurídicas que serão adicionadas automaticamente ao gerar o cabeçalho.
            </p>
          </div>
          {tesesList.length === 0 ? (
            <div className="p-6 text-center border border-slate-200 rounded-xl">
              <p className="text-sm text-slate-400 font-medium">Nenhuma tese cadastrada.</p>
              <p className="text-xs text-slate-400 mt-1">Acesse a aba <strong>⚖️ TESES</strong> para cadastrar suas teses de recurso.</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
              {Object.entries(
                tesesList.reduce((acc, t) => {
                  const cat = t.categoria || 'Geral';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(t);
                  return acc;
                }, {} as Record<string, TeseRecurso[]>)
              ).map(([cat, lista]) => (
                <div key={cat}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {lista.map(tese => (
                      <label
                        key={tese.id}
                        className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-all border ${
                          selectedTeses.includes(tese.id)
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeses.includes(tese.id)}
                          onChange={e => {
                            setSelectedTeses(prev =>
                              e.target.checked
                                ? [...prev, tese.id]
                                : prev.filter(id => id !== tese.id)
                            );
                          }}
                          className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
                        />
                        <span className={`text-xs font-bold leading-snug ${
                          selectedTeses.includes(tese.id) ? 'text-indigo-800' : 'text-slate-600'
                        }`}>
                          {tese.nome}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsTesesModalOpen(false)}>
              Voltar
            </Button>
            <div className="flex gap-2">
              <Button onClick={() => setIsTesesModalOpen(false)}>
                Confirmar Seleção
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
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

              return (
                <tr key={inf.id} className="hover:bg-slate-50/50">
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
                          'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                      {inf.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-6 font-black text-sm text-slate-700">
                    {activeTab === 'ACOMPANHAMENTO' ? formatDateString(proxVerifDate.toISOString().split('T')[0]) : formatDateString(inf.dataLimiteProtocolo)}
                    {activeTab === 'ACOMPANHAMENTO' && isVencido && <span className="block text-[8px] text-indigo-500 uppercase tracking-tighter">Verificar agora!</span>}
                  </td>
                  <td className="p-6 text-right space-x-1">
                    {inf.cliente_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNavigateToCliente(inf.cliente_id || '')}
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        👤 Ver Cliente
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => startEdit(inf)} className="text-indigo-600 hover:bg-indigo-50">Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(inf.id)} className="text-rose-600 hover:bg-rose-50">Excluir</Button>
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
