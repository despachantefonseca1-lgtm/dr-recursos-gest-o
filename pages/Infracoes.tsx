
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Infracao, FaseRecursal, StatusInfracao } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Modal } from '../components/ui/Modal';

const Infracoes: React.FC = () => {
  const [infracoes, setInfracoes] = useState<Infracao[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'GESTAO' | 'ACOMPANHAMENTO' | 'DEFERIDOS'>('GESTAO');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState<Omit<Infracao, 'id' | 'criadoEm' | 'atualizadoEm' | 'historicoStatus'>>({
    numeroAuto: '',
    placa: '',
    dataInfracao: '',
    dataLimiteProtocolo: '',
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

  const load = async () => setInfracoes(await api.getInfracoes());

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await api.updateInfracao(editingId, {
        ...formData,
        ultimaVerificacao: (formData.status === StatusInfracao.EM_JULGAMENTO && !formData.ultimaVerificacao) ? new Date().toISOString() : formData.ultimaVerificacao
      });
    } else {
      await api.createInfracao({
        ...formData,
        ultimaVerificacao: formData.status === StatusInfracao.EM_JULGAMENTO ? new Date().toISOString() : undefined
      } as any);
    }
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({
      numeroAuto: '', placa: '', dataInfracao: '', dataLimiteProtocolo: '',
      faseRecursal: FaseRecursal.DEFESA_PREVIA, status: StatusInfracao.RECURSO_A_FAZER,
      acompanhamentoMensal: false, intervaloAcompanhamento: 15, descricao: '', observacoes: ''
    });
    load();
  };

  const handleExportCSV = () => {
    const { start, end } = exportDateRange;
    if (!start || !end) {
      alert("Por favor, selecione o período.");
      return;
    }

    const filtered = infracoes.filter(inf => {
      const date = new Date(inf.dataInfracao);
      return date >= new Date(start) && date <= new Date(end);
    });

    if (filtered.length === 0) {
      alert("Nenhum registro para este período.");
      return;
    }

    // Cabeçalhos detalhados
    const headers = [
      "NÚMERO AUTO",
      "PLACA",
      "DATA INFRAÇÃO",
      "DATA LIMITE PROTOCOLO",
      "FASE RECURSAL",
      "STATUS ATUAL",
      "INTERVALO ACOMP.",
      "DESCRIÇÃO",
      "OBSERVAÇÕES"
    ];

    const rows = filtered.map(inf => [
      inf.numeroAuto,
      inf.placa,
      new Date(inf.dataInfracao).toLocaleDateString('pt-BR'),
      new Date(inf.dataLimiteProtocolo).toLocaleDateString('pt-BR'),
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
    setFormData(inf);
    setEditingId(inf.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir permanentemente este registro?')) {
      await api.deleteInfracao(id);
      load();
    }
  };

  const filteredInfracoes = infracoes.filter(inf => {
    if (activeTab === 'DEFERIDOS') return inf.status === StatusInfracao.DEFERIDO;
    if (activeTab === 'ACOMPANHAMENTO') return inf.status === StatusInfracao.EM_JULGAMENTO;
    return inf.status !== StatusInfracao.DEFERIDO;
  }).sort((a, b) => {
    if (activeTab === 'ACOMPANHAMENTO') {
      const getProx = (inf: Infracao) => {
        const base = inf.ultimaVerificacao ? new Date(inf.ultimaVerificacao) : new Date(inf.criadoEm);
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
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setIsExportModalOpen(true)} className="py-4 rounded-3xl" icon="📊">
            Gerar Planilha
          </Button>
          <Button variant="secondary" onClick={() => { setIsFormOpen(true); setEditingId(null); }} className="py-4 rounded-3xl shadow-2xl" icon="➕">
            Novo Registro
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Filtro de Relatório"
      >
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
          <Input
            label="Placa"
            required
            value={formData.placa}
            onChange={e => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
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
          </div>
          <div className="md:col-span-3 flex justify-end space-x-3 pt-6 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
              Fechar
            </Button>
            <Button type="submit" variant="primary" className="px-12 py-4 rounded-3xl">
              Salvar Infração
            </Button>
          </div>
        </form>
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
              const baseDate = inf.ultimaVerificacao ? new Date(inf.ultimaVerificacao) : new Date(inf.criadoEm);
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
                    {activeTab === 'ACOMPANHAMENTO' ? proxVerifDate.toLocaleDateString() : new Date(inf.dataLimiteProtocolo).toLocaleDateString()}
                    {activeTab === 'ACOMPANHAMENTO' && isVencido && <span className="block text-[8px] text-indigo-500 uppercase tracking-tighter">Verificar agora!</span>}
                  </td>
                  <td className="p-6 text-right space-x-1">
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
