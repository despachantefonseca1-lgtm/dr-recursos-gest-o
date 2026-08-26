
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';

interface RelatorioDetalheItem {
  id: string;
  tipo: 'RECURSO' | 'SERVICO' | 'TAREFA';
  titulo: string;
  data: string;
  status: string;
}

interface RelatorioRow {
  userId: string;
  name: string;
  tarefas: number;
  servicos: number;
  recursos: number;
  detalhes: RelatorioDetalheItem[];
}

const Usuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    name: '',
    email: '',
    password: '',
    role: UserRole.SECRETARIA,
    responsavelAcompanhamento: false,
    responsavelProtocolar: false
  });

  // --- Relatório state ---
  const [isRelatorioOpen, setIsRelatorioOpen] = useState(false);
  const [relatorioLoading, setRelatorioLoading] = useState(false);
  const [relatorioRows, setRelatorioRows] = useState<RelatorioRow[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const getFirstDayOfMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const [relatorioInicio, setRelatorioInicio] = useState(getFirstDayOfMonth());
  const [relatorioFim, setRelatorioFim] = useState(getTodayString());

  const load = async () => {
    const data = await api.getUsers();
    setUsuarios(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.updateUser(editingId, formData);
    } else {
      await api.createUser(formData);
    }
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({
      name: '', email: '', password: '',
      role: UserRole.SECRETARIA, responsavelAcompanhamento: false,
      responsavelProtocolar: false
    });
    load();
  };

  const startEdit = (user: User) => {
    setFormData(user);
    setEditingId(user.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (id === 'admin-main') {
      alert('Não é possível excluir o administrador mestre.');
      return;
    }
    if (confirm('Excluir acesso deste usuário permanentemente?')) {
      try {
        await api.deleteUser(id);
        await load();
      } catch (error: any) {
        alert('Erro ao excluir usuário: ' + (error.message || 'Erro desconhecido'));
        console.error(error);
      }
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSincronizarProcessos = async () => {
    try {
      setIsSyncing(true);
      const res = await api.sincronizarTarefasInfracoesExistentes();
      alert(`Sincronização concluída com sucesso!\n\n• ${res.limpas} tarefa(s) indevidas/antigas foram limpas.\n• ${res.sincronizadas} tarefa(s) foram geradas/renovadas para os ${res.totalRecursosAProtocolar} recursos a protocolar.`);
      if (isRelatorioOpen && relatorioInicio && relatorioFim) {
        handleGerarRelatorio();
      }
    } catch (err: any) {
      alert('Erro ao sincronizar processos: ' + (err.message || err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGerarRelatorio = async () => {
    if (!relatorioInicio || !relatorioFim) {
      alert('Selecione as datas de início e fim.');
      return;
    }
    setRelatorioLoading(true);
    setExpandedUserId(null);
    try {
      const results = await api.getRelatorioDesempenho(relatorioInicio, relatorioFim);
      // Map user IDs to names; also include users with 0 activity
      const rows: RelatorioRow[] = usuarios.map(u => {
        const found = results.find(r => r.userId === u.id);
        return {
          userId: u.id,
          name: u.name,
          tarefas: found?.tarefas ?? 0,
          servicos: found?.servicos ?? 0,
          recursos: found?.recursos ?? 0,
          detalhes: found?.detalhes ?? []
        };
      });
      // Sort by total desc
      rows.sort((a, b) => (b.tarefas + b.servicos + b.recursos) - (a.tarefas + a.servicos + a.recursos));
      setRelatorioRows(rows);
    } catch (err: any) {
      alert('Erro ao gerar relatório: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRelatorioLoading(false);
    }
  };

  const handleExportarRelatorioCSV = () => {
    if (relatorioRows.length === 0) return;
    const headers = ['Usuário', 'Tarefas', 'Recursos (Multas/Fases)', 'Serviços Despachante', 'Total de Produção'];
    const rows = relatorioRows.map(r => [
      `"${r.name}"`,
      r.tarefas,
      r.recursos,
      r.servicos,
      r.tarefas + r.servicos + r.recursos
    ]);
    const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_desempenho_${relatorioInicio}_a_${relatorioFim}.csv`;
    link.click();
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  if (loading) return <div className="p-8 text-center font-black uppercase tracking-widest text-slate-400">Carregando usuários...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Controle de Acessos</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestão de colaboradores e permissões</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleSincronizarProcessos}
            disabled={isSyncing}
            variant="ghost"
            className="border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-5 py-3 rounded-2xl transition-all"
            icon="🔄"
          >
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Processos'}
          </Button>
          <Button
            onClick={() => { setIsRelatorioOpen(true); setRelatorioRows([]); }}
            variant="outline"
            className="px-6 py-3 rounded-2xl"
            icon="📊"
          >
            Relatório de Desempenho
          </Button>
          <Button
            onClick={() => { setIsFormOpen(!isFormOpen); setEditingId(null); }}
            className="px-8 py-4 rounded-3xl shadow-xl"
            icon="👤"
          >
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* New/Edit User Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? "Editar Acesso" : "Novo Acesso"}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nome Completo"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Maria Souza"
          />
          <Input
            label="E-mail de Login"
            required
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="maria@drrecursos.com"
          />
          <Input
            label="Senha Provisória"
            required
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            placeholder="Mínimo 6 caracteres"
          />
          <Select
            label="Cargo / Papel"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value as any })}
          >
            <option value={UserRole.SECRETARIA}>Secretaria (Operacional)</option>
            <option value={UserRole.ADMIN}>Administrador (Total)</option>
          </Select>

          <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center space-x-4">
            <input
              type="checkbox"
              id="respCheck"
              className="w-5 h-5 accent-indigo-600"
              checked={formData.responsavelAcompanhamento}
              onChange={e => setFormData({ ...formData, responsavelAcompanhamento: e.target.checked })}
            />
            <label htmlFor="respCheck" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">
              Responsável por acompanhar status de julgamento (Recebe alertas de 15/30 dias)
            </label>
          </div>

          <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center space-x-4">
            <input
              type="checkbox"
              id="respProtCheck"
              className="w-5 h-5 accent-indigo-600"
              checked={formData.responsavelProtocolar}
              onChange={e => setFormData({ ...formData, responsavelProtocolar: e.target.checked })}
            />
            <label htmlFor="respProtCheck" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">
              Responsável por protocolar infrações (Recebe alertas de prazos no dia e cobranças de vencidos)
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" className="px-10 py-4 rounded-3xl uppercase tracking-[0.2em]">
              {editingId ? 'Salvar Usuário' : 'Criar Acesso'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Relatório de Desempenho Modal */}
      <Modal
        isOpen={isRelatorioOpen}
        onClose={() => setIsRelatorioOpen(false)}
        title="📊 Relatório de Desempenho"
      >
        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-800 space-y-1">
            <p className="font-black text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
              <span>💡</span> Contabilização de Recursos & Fases
            </p>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Cada nova atribuição de infração ou avanço de fase recursal (Defesa Prévia, 1ª Instância/JARI, 2ª Instância/CETRAN) gera uma tarefa e é contabilizada como <strong>1 recurso realizado</strong> no mês correspondente.
            </p>
          </div>

          {/* Period Selector */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período de análise</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Data Início"
                type="date"
                value={relatorioInicio}
                onChange={e => setRelatorioInicio(e.target.value)}
              />
              <Input
                label="Data Fim"
                type="date"
                value={relatorioFim}
                onChange={e => setRelatorioFim(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setRelatorioInicio(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
                  setRelatorioFim(getTodayString());
                }}
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all"
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setRelatorioInicio(`${now.getFullYear()}-01-01`);
                  setRelatorioFim(getTodayString());
                }}
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all"
              >
                Este Ano
              </button>
            </div>
            <Button onClick={handleGerarRelatorio} disabled={relatorioLoading} className="w-full justify-center">
              {relatorioLoading ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
          </div>

          {/* Results Table */}
          {relatorioRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Período: {formatDate(relatorioInicio)} a {formatDate(relatorioFim)}
                </p>
                <button
                  type="button"
                  onClick={handleExportarRelatorioCSV}
                  className="flex items-center gap-1 text-[10px] font-black text-emerald-600 hover:text-emerald-800 uppercase tracking-wider px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-all border border-emerald-200"
                >
                  <span>📥</span> Exportar CSV
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuário</th>
                      <th className="text-center px-4 py-3 text-[10px] font-black text-indigo-500 uppercase tracking-widest">Tarefas</th>
                      <th className="text-center px-4 py-3 text-[10px] font-black text-amber-500 uppercase tracking-widest">Recursos</th>
                      <th className="text-center px-4 py-3 text-[10px] font-black text-emerald-500 uppercase tracking-widest">Serviços Desp.</th>
                      <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioRows.map((row, i) => {
                      const total = row.tarefas + row.servicos + row.recursos;
                      const isExpanded = expandedUserId === row.userId;
                      return (
                        <React.Fragment key={row.userId}>
                          <tr
                            onClick={() => setExpandedUserId(isExpanded ? null : row.userId)}
                            className={`border-b border-slate-100 last:border-0 cursor-pointer hover:bg-indigo-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-indigo-100 rounded-xl flex items-center justify-center text-xs font-black text-indigo-600">
                                    {row.name.charAt(0)}
                                  </div>
                                  <span className="font-bold text-slate-800 text-xs">{row.name}</span>
                                </div>
                                {row.detalhes.length > 0 && (
                                  <span className="text-[10px] text-slate-400 font-bold ml-2">
                                    {isExpanded ? '▲ Fechar' : '▼ Ver itens'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-center px-4 py-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-700 rounded-xl font-black text-sm border border-indigo-100">
                                {row.tarefas}
                              </span>
                            </td>
                            <td className="text-center px-4 py-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-50 text-amber-700 rounded-xl font-black text-sm border border-amber-100">
                                {row.recursos}
                              </span>
                            </td>
                            <td className="text-center px-4 py-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 rounded-xl font-black text-sm border border-emerald-100">
                                {row.servicos}
                              </span>
                            </td>
                            <td className="text-center px-4 py-3">
                              <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-black text-xs ${
                                total > 0
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {total}
                              </span>
                            </td>
                          </tr>

                          {isExpanded && row.detalhes && row.detalhes.length > 0 && (
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <td colSpan={5} className="p-3">
                                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-inner space-y-2">
                                  <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                      Itens contabilizados para {row.name} ({row.detalhes.length}):
                                    </p>
                                    <span className="text-[10px] text-slate-400 font-bold">
                                      {row.recursos} Recursos • {row.servicos} Serviços • {row.tarefas} Tarefas
                                    </span>
                                  </div>
                                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                                    {row.detalhes.map((item, idx) => (
                                      <div key={item.id || idx} className="flex justify-between items-center text-xs bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-100 transition-colors">
                                        <div className="flex items-center gap-2 truncate pr-2">
                                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                            item.tipo === 'RECURSO' ? 'bg-amber-100 text-amber-800' :
                                            item.tipo === 'SERVICO' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                                          }`}>
                                            {item.tipo}
                                          </span>
                                          <span className="font-bold text-slate-800 truncate">{item.titulo}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-slate-500 font-medium">
                                          <span>Prazo: {formatDate(item.data)}</span>
                                          <span className="px-2 py-0.5 rounded-md bg-slate-200 font-black text-[9px] uppercase">{item.status}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {relatorioRows.length === 0 && !relatorioLoading && (
            <div className="text-center py-6 text-sm text-slate-400 font-medium">
              Clique em "Gerar Relatório" para visualizar os dados do período selecionado.
            </div>
          )}
        </div>
      </Modal>

      {/* User Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usuarios.map(u => (
          <div key={u.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-110`} />

            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-200 font-black text-slate-400">
                {u.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-slate-900 leading-none">{u.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{u.role}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                <span>📧</span> <span className="truncate">{u.email}</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                <span>🔑</span> <span className="font-mono">{u.password}</span>
              </div>
              {u.responsavelAcompanhamento && (
                <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100">
                  <span>🔔</span> <span>Monitorador de Status</span>
                </div>
              )}
              {u.responsavelProtocolar && (
                <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                  <span>📎</span> <span>Gestor de Protocolos</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-50">
              <Button variant="ghost" size="sm" onClick={() => startEdit(u)} className="text-indigo-600 hover:bg-indigo-50">Configurar</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="text-rose-600 hover:bg-rose-50">Excluir</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Usuarios;
