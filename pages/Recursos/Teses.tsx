import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { TeseRecurso } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';

const CATEGORIAS_PADRAO = [
  'Excesso de Velocidade',
  'Semáforo / Sinalização',
  'Documentação / Habilitação',
  'Estacionamento',
  'Uso de Celular',
  'Alcoolemia',
  'Processual / Nulidade',
  'Outras',
];

const FASE_LABELS: Record<string, string> = {
  DEFESA_PREVIA: 'Defesa Prévia',
  PRIMEIRA_INSTANCIA: '1ª Instância',
  SEGUNDA_INSTANCIA: '2ª Instância',
};

const emptyForm = { nome: '', texto: '', categoria: '', fase_recursal: '', ativo: true };

const Teses: React.FC = () => {
  const [teses, setTeses] = useState<TeseRecurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setTeses(await api.getAllTeses());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleEdit = (tese: TeseRecurso) => {
    setEditingId(tese.id);
    setFormData({
      nome: tese.nome,
      texto: tese.texto,
      categoria: tese.categoria || '',
      fase_recursal: tese.fase_recursal || '',
      ativo: tese.ativo,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) { alert('O nome da tese é obrigatório.'); return; }
    if (!formData.texto.trim()) { alert('O texto da tese é obrigatório.'); return; }
    try {
      if (editingId) {
        await api.updateTese(editingId, formData);
        alert('Tese atualizada com sucesso!');
      } else {
        await api.createTese(formData);
        alert('Tese cadastrada com sucesso!');
      }
      setIsModalOpen(false);
      load();
    } catch (e: any) {
      alert('Erro ao salvar tese: ' + (e.message || e));
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir a tese "${nome}"?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await api.deleteTese(id);
      load();
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e.message || e));
    }
  };

  const handleToggleAtivo = async (tese: TeseRecurso) => {
    try {
      await api.updateTese(tese.id, { ativo: !tese.ativo });
      load();
    } catch (e: any) {
      alert('Erro: ' + (e.message || e));
    }
  };

  const categorias = [...new Set(teses.map(t => t.categoria).filter(Boolean))] as string[];

  const filtered = teses.filter(t => {
    const matchSearch = !searchTerm ||
      t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.texto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.categoria || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = !filterCategoria || t.categoria === filterCategoria;
    return matchSearch && matchCat;
  });

  const grouped = filtered.reduce((acc, t) => {
    const cat = t.categoria || 'Sem Categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, TeseRecurso[]>);

  const ativas = teses.filter(t => t.ativo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Banco de Teses</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            {teses.length} cadastrada{teses.length !== 1 ? 's' : ''} • {ativas} ativa{ativas !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar teses..."
              className="pl-8"
            />
            <span className="absolute left-3 top-3.5 text-slate-400">🔍</span>
          </div>
          <Button onClick={handleOpenNew}>➕ Nova Tese</Button>
        </div>
      </div>

      {/* Category filters */}
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategoria('')}
            className={`px-3 py-1.5 text-xs font-black rounded-full transition-all ${!filterCategoria ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            Todas ({teses.length})
          </button>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategoria(filterCategoria === cat ? '' : cat)}
              className={`px-3 py-1.5 text-xs font-black rounded-full transition-all ${filterCategoria === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {cat} ({teses.filter(t => t.categoria === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-slate-400 font-black uppercase tracking-widest text-xs animate-pulse">
          Carregando teses...
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-5xl mb-4">⚖️</p>
          <p className="font-black text-slate-600 uppercase tracking-widest text-sm">
            {searchTerm || filterCategoria ? 'Nenhuma tese encontrada' : 'Nenhuma tese cadastrada'}
          </p>
          <p className="text-xs text-slate-400 mt-2 mb-6">
            {searchTerm || filterCategoria ? 'Tente outros filtros' : 'Cadastre suas teses de recurso para usá-las nos cabeçalhos'}
          </p>
          {!searchTerm && !filterCategoria && (
            <Button onClick={handleOpenNew}>➕ Cadastrar Primeira Tese</Button>
          )}
        </div>
      )}

      {/* Grouped list */}
      {!loading && Object.entries(grouped).map(([categoria, lista]) => (
        <div key={categoria}>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{categoria}</h3>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-bold whitespace-nowrap">
              {lista.length} tese{lista.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {lista.map(tese => (
              <div
                key={tese.id}
                className={`bg-white rounded-2xl border transition-all ${!tese.ativo ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}
              >
                <div className="flex justify-between items-start gap-4 p-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-black text-slate-900">{tese.nome}</p>
                      {tese.fase_recursal && (
                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">
                          {FASE_LABELS[tese.fase_recursal] || tese.fase_recursal}
                        </span>
                      )}
                      {!tese.ativo && (
                        <span className="text-[9px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase">Inativa</span>
                      )}
                    </div>
                    <p className={`text-sm text-slate-500 leading-relaxed ${expandedId === tese.id ? '' : 'line-clamp-2'}`}>
                      {tese.texto}
                    </p>
                    {tese.texto.length > 120 && (
                      <button
                        onClick={() => setExpandedId(expandedId === tese.id ? null : tese.id)}
                        className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 mt-1"
                      >
                        {expandedId === tese.id ? '▲ Ver menos' : '▼ Ver texto completo'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleAtivo(tese)}
                      className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all ${tese.ativo ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      title={tese.ativo ? 'Desativar tese' : 'Ativar tese'}
                    >
                      {tese.ativo ? '✅ Ativa' : '⏸ Inativa'}
                    </button>
                    <button
                      onClick={() => handleEdit(tese)}
                      className="text-[10px] font-black text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(tese.id, tese.nome)}
                      className="text-[10px] font-black text-rose-500 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? '✏️ Editar Tese' : '➕ Nova Tese de Recurso'}
      >
        <div className="space-y-4">
          <Input
            label="Nome da Tese *"
            value={formData.nome}
            onChange={e => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Ausência de Agente Autuador no Local"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1">
                Categoria
              </label>
              <input
                list="categorias-list"
                value={formData.categoria}
                onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Ex: Excesso de Velocidade"
              />
              <datalist id="categorias-list">
                {CATEGORIAS_PADRAO.map(c => <option key={c} value={c} />)}
                {categorias.filter(c => !CATEGORIAS_PADRAO.includes(c)).map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <Select
              label="Fase Recursal (opcional)"
              value={formData.fase_recursal}
              onChange={e => setFormData({ ...formData, fase_recursal: e.target.value })}
            >
              <option value="">Todas as Fases</option>
              <option value="DEFESA_PREVIA">Defesa Prévia</option>
              <option value="PRIMEIRA_INSTANCIA">1ª Instância (JARI)</option>
              <option value="SEGUNDA_INSTANCIA">2ª Instância (CETRAN)</option>
            </Select>
          </div>

          <Textarea
            label="Texto Completo da Tese *"
            value={formData.texto}
            onChange={e => setFormData({ ...formData, texto: e.target.value })}
            placeholder="Digite o texto jurídico completo desta tese. Este texto será inserido automaticamente no cabeçalho quando a tese for selecionada..."
            rows={10}
          />

          <p className="text-[10px] text-slate-400 bg-slate-50 rounded-xl px-4 py-3 font-medium leading-relaxed">
            💡 O <strong>Nome</strong> aparece como checkbox na tela de infração. O <strong>Texto</strong> é inserido automaticamente no cabeçalho gerado.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave}>
              {editingId ? 'Salvar Alterações' : 'Cadastrar Tese'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Teses;
