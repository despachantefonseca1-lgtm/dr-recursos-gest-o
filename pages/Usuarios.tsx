
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, UserRole, UserPermissoes } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { useUnidade } from '../contexts/UnidadeContext';

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

const DEFAULT_PERMISSOES: UserPermissoes = {
  painel: true,
  recursos: true,
  recursos_caixa: false,
  despachante: true,
  caixa: true,
  caixa_meses_anteriores: false,
  caixa_relatorios: false,
  tarefas: true,
  usuarios: false,
  unidades: false
};

const SOCIO_PERMISSOES: UserPermissoes = {
  painel: true,
  recursos: true,
  recursos_caixa: true,
  despachante: true,
  caixa: true,
  caixa_meses_anteriores: true,
  caixa_relatorios: true,
  tarefas: true,
  usuarios: false,
  unidades: false
};

const ALL_PERMISSOES: UserPermissoes = {
  painel: true,
  recursos: true,
  recursos_caixa: true,
  despachante: true,
  caixa: true,
  caixa_meses_anteriores: true,
  caixa_relatorios: true,
  tarefas: true,
  usuarios: true,
  unidades: true
};

const Usuarios: React.FC = () => {
  const { unidades } = useUnidade();
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
    responsavelProtocolar: false,
    unidade_id: '',
    permissoes: { ...DEFAULT_PERMISSOES }
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
    const payload = {
      ...formData,
      permissoes: formData.role === UserRole.ADMIN ? { ...ALL_PERMISSOES } : (formData.permissoes || { ...DEFAULT_PERMISSOES })
    };

    if (editingId) {
      await api.updateUser(editingId, payload);
    } else {
      await api.createUser(payload);
    }
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({
      name: '', email: '', password: '',
      role: UserRole.SECRETARIA, responsavelAcompanhamento: false,
      responsavelProtocolar: false,
      unidade_id: '',
      permissoes: { ...DEFAULT_PERMISSOES }
    });
    load();
  };

  const startEdit = (user: User) => {
    setFormData({
      ...user,
      unidade_id: user.unidade_id || '',
      permissoes: user.role === UserRole.ADMIN
        ? { ...ALL_PERMISSOES }
        : (user.permissoes ? { ...DEFAULT_PERMISSOES, ...user.permissoes } : { ...DEFAULT_PERMISSOES })
    });
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

          <div className="md:col-span-2">
            <Select
              label="Unidade de Lotação (Filial / Matriz)"
              value={formData.unidade_id || ''}
              onChange={e => setFormData({ ...formData, unidade_id: e.target.value })}
            >
              <option value="">Acesso Global (Sem restrição / Todas as Unidades)</option>
              {unidades.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.cidade}/{u.uf})
                </option>
              ))}
            </Select>
            <p className="text-[10px] text-slate-400 mt-1">
              Colaboradores restritos a uma unidade só enxergarão clientes, caixa e processos daquela praça.
            </p>
          </div>

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

          {/* Permissões e Autorizações por Módulo */}
          <div className="md:col-span-2 p-5 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 rounded-2xl border border-indigo-100 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/70 pb-3">
              <div>
                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🛡️</span> Autorizações e Áreas de Acesso Permitidas
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  O Administrador Geral pode conceder autorizações específicas aos módulos do sistema.
                </p>
              </div>

              {formData.role !== UserRole.ADMIN && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissoes: { ...ALL_PERMISSOES } })}
                    className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg transition-all"
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissoes: { ...SOCIO_PERMISSOES } })}
                    className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-all border border-emerald-300 shadow-sm"
                    title="Configuração ideal para sócios de unidades (ex: Nova Serrana): Caixa total com meses anteriores e operacional"
                  >
                    ⭐ Sócio (Caixa Total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissoes: { ...DEFAULT_PERMISSOES } })}
                    className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-all"
                  >
                    Padrão
                  </button>
                </div>
              )}
            </div>

            {formData.role === UserRole.ADMIN ? (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 font-bold flex items-center gap-2.5">
                <span className="text-lg">👑</span>
                <div>
                  <p className="font-black text-indigo-950">Administrador Geral (Acesso Irrestrito)</p>
                  <p className="text-[11px] text-indigo-700 font-normal mt-0.5">Possui autorização total para visualizar, editar e administrar todas as áreas, caixas e unidades.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* 1. Painel */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.painel ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.painel}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, painel: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>📊</span> Painel Geral (Dashboard)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Métricas resumidas, alertas e visão geral</p>
                  </div>
                </label>

                {/* 2. Recursos */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.recursos ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.recursos}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, recursos: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>⚖️</span> Gestão de Recursos
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Processos de infração, clientes de recursos e teses</p>
                  </div>
                </label>

                {/* 3. Recursos Caixa */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.recursos_caixa ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.recursos_caixa}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, recursos_caixa: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>💰</span> Caixa de Recursos
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Fluxo de honorários e contratações de recursos</p>
                  </div>
                </label>

                {/* 4. Despachante */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.despachante ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.despachante}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, despachante: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>📋</span> Módulo Despachante
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Clientes, serviços de despachante e vistorias</p>
                  </div>
                </label>

                {/* 5. Caixa Despachante */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.caixa ? 'bg-emerald-50/80 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-emerald-600 rounded"
                    checked={!!formData.permissoes?.caixa}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, caixa: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                      <span>💵</span> Controle de Caixa (Despachante)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Lançar entradas, despesas e gerenciar o caixa do dia</p>
                  </div>
                </label>

                {/* 6. Caixa - Meses Anteriores (Destacado) */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.caixa_meses_anteriores ? 'bg-purple-50/80 border-purple-300 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-purple-600 rounded"
                    checked={!!formData.permissoes?.caixa_meses_anteriores}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, caixa_meses_anteriores: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                      <span>📅</span> Caixa: Meses Anteriores & Histórico
                    </span>
                    <p className="text-[10px] text-purple-700 mt-0.5 font-medium">
                      Desbloqueia consulta e filtros de datas em meses passados (vital para sócios de unidades)
                    </p>
                  </div>
                </label>

                {/* 7. Caixa - Relatórios */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.caixa_relatorios ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.caixa_relatorios}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, caixa_relatorios: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>📑</span> Caixa: Relatórios & Exportação
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Exportar planilhas CSV e relatórios consolidados</p>
                  </div>
                </label>

                {/* 8. Tarefas */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.tarefas ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.tarefas}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, tarefas: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>📝</span> Tarefas & Pendências
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Acesso ao painel e gestão de tarefas da equipe</p>
                  </div>
                </label>

                {/* 9. Usuários */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.usuarios ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.usuarios}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, usuarios: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>👤</span> Gestão de Usuários
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Administrar colaboradores e acessos</p>
                  </div>
                </label>

                {/* 10. Unidades */}
                <label className={`p-3 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
                  formData.permissoes?.unidades ? 'bg-indigo-50/70 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
                    checked={!!formData.permissoes?.unidades}
                    onChange={e => setFormData({
                      ...formData,
                      permissoes: { ...formData.permissoes, unidades: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>🏢</span> Gestão de Unidades
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Configurar matriz e filiais</p>
                  </div>
                </label>
              </div>
            )}
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
              <div className="pt-1">
                {u.unidade_id ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200">
                    <span>📍</span>
                    <span>{unidades.find(un => un.id === u.unidade_id)?.nome || 'Unidade'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100">
                    <span>🌐</span>
                    <span>Acesso Geral (Todas)</span>
                  </span>
                )}
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

              {/* Badges de Permissões de Módulo */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Permissões:</p>
                <div className="flex flex-wrap gap-1">
                  {u.role === UserRole.ADMIN ? (
                    <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm">
                      👑 Acesso Total (Admin)
                    </span>
                  ) : (
                    <>
                      {u.permissoes?.caixa && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-bold border border-emerald-200" title="Controle de Caixa Liberado">
                          💵 Caixa
                        </span>
                      )}
                      {u.permissoes?.caixa_meses_anteriores && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[9px] font-bold border border-purple-200" title="Acesso a Meses Anteriores e Histórico do Caixa">
                          📅 Meses Anteriores
                        </span>
                      )}
                      {u.permissoes?.caixa_relatorios && (
                        <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-md text-[9px] font-bold border border-teal-200" title="Relatórios Financeiros">
                          📑 Relat. Caixa
                        </span>
                      )}
                      {u.permissoes?.despachante && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[9px] font-bold border border-blue-200">
                          📋 Despachante
                        </span>
                      )}
                      {u.permissoes?.recursos && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-bold border border-amber-200">
                          ⚖️ Recursos
                        </span>
                      )}
                      {u.permissoes?.recursos_caixa && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-900 rounded-md text-[9px] font-bold border border-amber-300">
                          💰 Caixa Rec.
                        </span>
                      )}
                      {u.permissoes?.tarefas && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-bold border border-indigo-100">
                          📝 Tarefas
                        </span>
                      )}
                      {!u.permissoes?.caixa && !u.permissoes?.despachante && !u.permissoes?.recursos && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-bold">
                          Acesso Básico
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
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
