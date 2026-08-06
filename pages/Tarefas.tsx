import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Tarefa, PrioridadeTarefa, StatusTarefa, User, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Modal } from '../components/ui/Modal';

// Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
const formatDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

type PageTab = 'ativas' | 'arquivo';

const Tarefas: React.FC = () => {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [tarefasArquivadas, setTarefasArquivadas] = useState<Tarefa[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<PageTab>('ativas');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'monthly' | 'annual' | 'custom'>('monthly');
  const [dateFilterType, setDateFilterType] = useState<'created' | 'deadline'>('created');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [concluirId, setConcluirId] = useState<string | null>(null);
  const [motivoConclusao, setMotivoConclusao] = useState('');
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);
  const [isConfirmDeleteArquivadasOpen, setIsConfirmDeleteArquivadasOpen] = useState(false);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState<Set<string>>(new Set());
  const [isConfirmDeleteSelectedOpen, setIsConfirmDeleteSelectedOpen] = useState(false);
  const [isConfirmArquivarSelectedOpen, setIsConfirmArquivarSelectedOpen] = useState(false);
  // Archive selection mode (in arquivo tab)
  const [modoSelecaoArquivo, setModoSelecaoArquivo] = useState(false);
  const [arquivadasSelecionadas, setArquivadasSelecionadas] = useState<Set<string>>(new Set());
  const [isConfirmDeleteSelecionadasArquivoOpen, setIsConfirmDeleteSelecionadasArquivoOpen] = useState(false);
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

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageViewUrl, setImageViewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = async () => {
    const [tData, uData, arqData] = await Promise.all([
      api.getTarefas(),
      api.getUsers(),
      api.getTarefasArquivadas()
    ]);
    setTarefas(tData);
    setUsuarios(uData);
    setTarefasArquivadas(arqData);
  };

  useEffect(() => { load(); }, []);

  // Check 2-day rule — apenas registra no console; o banner do Header já notifica o usuário
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
      // Apenas log — o banner vermelho do Header já informa o usuário de forma não bloqueante
      console.warn(`[Tarefas] ${overdueTasks.length} tarefa(s) sem interação há mais de 2 dias:`, overdueTasks.map(t => t.titulo));
    }
  }, [tarefas, currentUser]);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Apenas arquivos de imagem são permitidos.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processImageFile(file);
        break;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.atribuidaPara) {
      alert("Por favor, selecione um colaborador responsável.");
      return;
    }

    try {
      setIsUploading(true);
      let imagemUrl: string | undefined;

      // Upload image if present
      if (imageFile) {
        try {
          imagemUrl = await api.uploadTarefaImagem(imageFile);
        } catch (uploadErr: any) {
          console.error('Image upload error:', uploadErr);
          alert('Erro ao enviar imagem: ' + (uploadErr.message || 'Erro desconhecido'));
          setIsUploading(false);
          return;
        }
      }

      await api.createTarefa({
        ...formData,
        imagemUrl,
        atribuidaPorId: currentUser?.id || 'admin-main'
      });

      setIsFormOpen(false);
      setFormData({
        titulo: '', descricao: '', prioridade: PrioridadeTarefa.MEDIA,
        status: StatusTarefa.PENDENTE, atribuidaPara: '', dataPrazo: '', observacoes: ''
      });
      removeImage();
      await load();
      alert('Tarefa criada com sucesso!');
    } catch (error: any) {
      console.error('Error creating tarefa:', error);
      alert('Erro ao criar tarefa: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
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

  const handleArquivar = async (id: string) => {
    if (confirm('Arquivar esta tarefa? Ela ficará disponível na aba "Arquivo" e poderá ser excluída de lá.')) {
      try {
        await api.arquivarTarefa(id);
        await load();
        alert('Tarefa arquivada com sucesso!');
      } catch (error: any) {
        console.error(error);
        alert('Erro ao arquivar tarefa: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  const handleRemoverAtribuicao = async (id: string) => {
    if (confirm('Remover a atribuição desta tarefa? Ela deixará de ser contabilizada no relatório do colaborador atual.')) {
      try {
        await api.removerAtribuicaoTarefa(id);
        await load();
      } catch (error: any) {
        console.error(error);
        alert('Erro ao remover atribuição: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  const handleDesarquivar = async (id: string) => {
    try {
      await api.desarquivarTarefa(id);
      await load();
      alert('Tarefa restaurada com sucesso!');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao restaurar tarefa: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleExcluirDoArquivo = async (id: string) => {
    if (confirm('Excluir permanentemente esta tarefa? Esta ação não pode ser desfeita.')) {
      try {
        await api.deleteTarefa(id);
        await load();
        alert('Tarefa excluída permanentemente!');
      } catch (error: any) {
        console.error(error);
        alert('Erro ao excluir tarefa: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  const handleExcluirTodas = async () => {
    try {
      await api.deleteAllTarefas();
      setIsConfirmDeleteAllOpen(false);
      await load();
      alert('Todas as tarefas ativas foram excluídas com sucesso!');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao excluir tarefas: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleExcluirTodasArquivadas = async () => {
    try {
      await api.deleteAllArquivadas();
      setIsConfirmDeleteArquivadasOpen(false);
      await load();
      alert('Todas as tarefas arquivadas foram excluídas permanentemente!');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao excluir tarefas: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const toggleSelecao = (id: string) => {
    setTarefasSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selecionarTodas = () => {
    setTarefasSelecionadas(new Set(tarefas.map(t => t.id)));
  };

  const selecionarConcluidas = () => {
    setTarefasSelecionadas(new Set(
      tarefas.filter(t => t.status === StatusTarefa.CONCLUIDA).map(t => t.id)
    ));
  };

  const desmarcarTodas = () => {
    setTarefasSelecionadas(new Set());
  };

  const cancelarModoSelecao = () => {
    setModoSelecao(false);
    setTarefasSelecionadas(new Set());
  };

  const handleExcluirSelecionadas = async () => {
    try {
      await Promise.all([...tarefasSelecionadas].map(id => api.deleteTarefa(id)));
      setIsConfirmDeleteSelectedOpen(false);
      cancelarModoSelecao();
      await load();
      alert(`${tarefasSelecionadas.size} tarefa(s) excluída(s) com sucesso!`);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao excluir tarefas: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleArquivarSelecionadas = async () => {
    try {
      await Promise.all([...tarefasSelecionadas].map(id => api.arquivarTarefa(id)));
      setIsConfirmArquivarSelectedOpen(false);
      cancelarModoSelecao();
      await load();
      alert(`${tarefasSelecionadas.size} tarefa(s) arquivada(s) com sucesso!`);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao arquivar tarefas: ' + (error.message || 'Erro desconhecido'));
    }
  };

  // --- Arquivo tab selection ---
  const toggleSelecaoArquivo = (id: string) => {
    setArquivadasSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selecionarTodasArquivadas = () => {
    setArquivadasSelecionadas(new Set(tarefasArquivadas.map(t => t.id)));
  };

  const desmarcarTodasArquivadas = () => {
    setArquivadasSelecionadas(new Set());
  };

  const cancelarModoSelecaoArquivo = () => {
    setModoSelecaoArquivo(false);
    setArquivadasSelecionadas(new Set());
  };

  const handleExcluirSelecionadasArquivo = async () => {
    try {
      await Promise.all([...arquivadasSelecionadas].map(id => api.deleteTarefa(id)));
      setIsConfirmDeleteSelecionadasArquivoOpen(false);
      cancelarModoSelecaoArquivo();
      await load();
      alert(`${arquivadasSelecionadas.size} tarefa(s) excluída(s) permanentemente!`);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao excluir tarefas: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const generateReport = () => {
    let start = '';
    let end = '';
    let reportName = '';

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (reportType === 'monthly') {
      start = new Date(year, month, 1).toISOString().slice(0, 10);
      end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      reportName = `relatorio_tarefas_mensal_${year}_${String(month + 1).padStart(2, '0')}`;
    } else if (reportType === 'annual') {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
      reportName = `relatorio_tarefas_anual_${year}`;
    } else {
      if (!customDates.start || !customDates.end) {
        alert('Por favor, selecione as datas para o relatório personalizado.');
        return;
      }
      start = customDates.start;
      end = customDates.end;
      reportName = `relatorio_tarefas_${start}_ate_${end}`;
    }

    const reportData = tarefas.filter(t => {
      const compareDate = dateFilterType === 'created'
        ? t.dataCriacao
        : t.dataPrazo;

      if (!compareDate) return false;
      const dateStr = compareDate.split('T')[0];
      return dateStr >= start && dateStr <= end;
    });

    if (reportData.length === 0) {
      alert('Nenhuma tarefa encontrada no período selecionado.');
      return;
    }

    const headers = ['Título', 'Descrição', 'Status', 'Prioridade', 'Data Criação', 'Data Prazo', 'Atribuída Para'];
    const csvContent = reportData.map(t => {
      const usuario = usuarios.find(u => u.id === t.atribuidaPara);
      return [
        t.titulo,
        t.descricao,
        t.status,
        t.prioridade,
        formatDateString(t.dataCriacao.split('T')[0]),
        t.dataPrazo ? formatDateString(t.dataPrazo) : '',
        usuario?.name || ''
      ].join(';');
    });

    const csv = [headers.join(';'), ...csvContent].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${reportName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    alert(`Relatório gerado com sucesso! ${reportData.length} tarefas exportadas.`);
    setIsReportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Gestão de Tarefa</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controle operacional e demandas internas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === 'ativas' && (
            <>
              <Button onClick={() => setIsReportModalOpen(true)} variant="outline" icon="📄">
                Exportar Relatório
              </Button>
              {currentUser?.role === UserRole.ADMIN && !modoSelecao && (
                <Button
                  onClick={() => setIsConfirmDeleteAllOpen(true)}
                  variant="ghost"
                  className="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors"
                  icon="🗑️"
                >
                  Apagar Todas
                </Button>
              )}
              {currentUser?.role === UserRole.ADMIN && (
                modoSelecao ? (
                  <Button
                    onClick={cancelarModoSelecao}
                    variant="ghost"
                    className="border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    icon="✕"
                  >
                    Cancelar Seleção
                  </Button>
                ) : (
                  <Button
                    onClick={() => setModoSelecao(true)}
                    variant="ghost"
                    className="border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors"
                    icon="☑️"
                  >
                    Selecionar
                  </Button>
                )
              )}
              {!modoSelecao && (
                <Button onClick={() => setIsFormOpen(!isFormOpen)} icon="➕">
                  Nova Tarefa
                </Button>
              )}
            </>
          )}
          {activeTab === 'arquivo' && currentUser?.role === UserRole.ADMIN && (
            <>
              {modoSelecaoArquivo ? (
                <Button
                  onClick={cancelarModoSelecaoArquivo}
                  variant="ghost"
                  className="border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  icon="✕"
                >
                  Cancelar Seleção
                </Button>
              ) : (
                <Button
                  onClick={() => setModoSelecaoArquivo(true)}
                  variant="ghost"
                  className="border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors"
                  icon="☑️"
                >
                  Selecionar
                </Button>
              )}
              {!modoSelecaoArquivo && tarefasArquivadas.length > 0 && (
                <Button
                  onClick={() => setIsConfirmDeleteArquivadasOpen(true)}
                  variant="ghost"
                  className="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors"
                  icon="🗑️"
                >
                  Excluir Todas
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => { setActiveTab('ativas'); cancelarModoSelecao(); cancelarModoSelecaoArquivo(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'ativas'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          📋 Tarefas Ativas
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'ativas' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
          }`}>
            {tarefas.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('arquivo'); cancelarModoSelecao(); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'arquivo'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🗃️ Arquivo
          {tarefasArquivadas.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'arquivo' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {tarefasArquivadas.length}
            </span>
          )}
        </button>
      </div>

      {/* ========== MODALS ========== */}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Nova Tarefa"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6" onPaste={handleImagePaste}>
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

          {/* Image Upload Zone */}
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Imagem Anexa (Opcional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processImageFile(file);
              }}
            />

            {imagePreview ? (
              <div className="relative group rounded-2xl overflow-hidden border-2 border-indigo-200 bg-indigo-50">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-48 object-contain rounded-2xl p-2"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={removeImage}
                    className="bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-rose-700 transition-colors shadow-lg"
                  >
                    🗑️ Remover
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white text-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-slate-100 transition-colors shadow-lg"
                  >
                    🔄 Trocar
                  </button>
                </div>
                <p className="text-[9px] font-bold text-indigo-500 text-center py-1 uppercase tracking-wider">✅ Imagem selecionada • Passe o mouse para alterar</p>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50 scale-[1.02]'
                    : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-3xl">{isDragOver ? '📥' : '🖼️'}</span>
                  <p className="text-sm font-bold text-slate-600">
                    {isDragOver ? 'Solte a imagem aqui!' : 'Arraste uma imagem ou clique para selecionar'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    📋 Ctrl+V para colar • 📎 Clique para upload • 🖱️ Arraste aqui
                  </p>
                  <p className="text-[9px] text-slate-400">Máximo 5MB • PNG, JPG, GIF, WebP</p>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => { setIsFormOpen(false); removeImage(); }}>
              Descartar
            </Button>
            <Button type="submit" variant="secondary" className="px-10 py-3.5 rounded-2xl" disabled={isUploading}>
              {isUploading ? '⏳ Enviando...' : 'Cadastrar Tarefa'}
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

      {/* Modal de confirmação: Apagar Todas as Tarefas Ativas */}
      <Modal
        isOpen={isConfirmDeleteAllOpen}
        onClose={() => setIsConfirmDeleteAllOpen(false)}
        title="⚠️ Apagar Todas as Tarefas Ativas"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <p className="text-sm font-bold text-rose-700 text-center">
              Esta ação irá excluir permanentemente <strong>todas as {tarefas.length} tarefas ativas</strong> cadastradas.
            </p>
            <p className="text-xs text-rose-500 text-center mt-1 font-medium">
              Essa operação não pode ser desfeita. Tarefas arquivadas não serão afetadas.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsConfirmDeleteAllOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={handleExcluirTodas}
              className="border border-rose-300 bg-rose-600 text-white hover:bg-rose-700 font-bold px-8"
            >
              🗑️ Sim, Apagar Todas
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação: Excluir Selecionadas */}
      <Modal
        isOpen={isConfirmDeleteSelectedOpen}
        onClose={() => setIsConfirmDeleteSelectedOpen(false)}
        title="🗑️ Excluir Tarefas Selecionadas"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <p className="text-sm font-bold text-rose-700 text-center">
              Você selecionou <strong>{tarefasSelecionadas.size} tarefa(s)</strong> para exclusão permanente.
            </p>
            <p className="text-xs text-rose-500 text-center mt-1 font-medium">
              Essa operação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsConfirmDeleteSelectedOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={handleExcluirSelecionadas}
              className="border border-rose-300 bg-rose-600 text-white hover:bg-rose-700 font-bold px-8"
            >
              🗑️ Excluir {tarefasSelecionadas.size} Tarefa(s)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação: Excluir Todas as Arquivadas */}
      <Modal
        isOpen={isConfirmDeleteArquivadasOpen}
        onClose={() => setIsConfirmDeleteArquivadasOpen(false)}
        title="⚠️ Excluir Todas as Tarefas Arquivadas"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <p className="text-sm font-bold text-rose-700 text-center">
              Esta ação irá excluir permanentemente <strong>todas as {tarefasArquivadas.length} tarefas arquivadas</strong>.
            </p>
            <p className="text-xs text-rose-500 text-center mt-1 font-medium">
              Essa operação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsConfirmDeleteArquivadasOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={handleExcluirTodasArquivadas}
              className="border border-rose-300 bg-rose-600 text-white hover:bg-rose-700 font-bold px-8"
            >
              🗑️ Excluir Todas Permanentemente
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação: Arquivar Selecionadas */}
      <Modal
        isOpen={isConfirmArquivarSelectedOpen}
        onClose={() => setIsConfirmArquivarSelectedOpen(false)}
        title="🗃️ Arquivar Tarefas Selecionadas"
      >
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="text-sm font-bold text-amber-700 text-center">
              Você selecionou <strong>{tarefasSelecionadas.size} tarefa(s)</strong> para arquivar.
            </p>
            <p className="text-xs text-amber-600 text-center mt-1 font-medium">
              Elas ficarão disponíveis na aba Arquivo e poderão ser excluídas ou restauradas de lá.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsConfirmArquivarSelectedOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={handleArquivarSelecionadas}
              className="border border-amber-300 bg-amber-500 text-white hover:bg-amber-600 font-bold px-8"
            >
              🗃️ Arquivar {tarefasSelecionadas.size} Tarefa(s)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação: Excluir Selecionadas do Arquivo */}
      <Modal
        isOpen={isConfirmDeleteSelecionadasArquivoOpen}
        onClose={() => setIsConfirmDeleteSelecionadasArquivoOpen(false)}
        title="🗑️ Excluir Selecionadas do Arquivo"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <p className="text-sm font-bold text-rose-700 text-center">
              Você selecionou <strong>{arquivadasSelecionadas.size} tarefa(s)</strong> para exclusão permanente.
            </p>
            <p className="text-xs text-rose-500 text-center mt-1 font-medium">
              Essa operação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsConfirmDeleteSelecionadasArquivoOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={handleExcluirSelecionadasArquivo}
              className="border border-rose-300 bg-rose-600 text-white hover:bg-rose-700 font-bold px-8"
            >
              🗑️ Excluir {arquivadasSelecionadas.size} Tarefa(s)
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========== TAB: TAREFAS ATIVAS ========== */}
      {activeTab === 'ativas' && (
        <>
          {/* Barra flutuante de seleção */}
          {modoSelecao && (
            <div className="sticky top-4 z-50 flex flex-wrap items-center justify-between gap-3 bg-indigo-700 text-white px-6 py-3 rounded-2xl shadow-2xl border border-indigo-500 transition-all">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black uppercase tracking-wider">
                  ☑️ {tarefasSelecionadas.size} selecionada(s)
                </span>
                <button
                  onClick={selecionarTodas}
                  className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
                >
                  Selecionar Todas
                </button>
                <button
                  onClick={selecionarConcluidas}
                  className="text-xs font-bold bg-emerald-500/70 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
                >
                  ✅ Concluídas
                </button>
                <button
                  onClick={desmarcarTodas}
                  className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
                >
                  Nenhuma
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={tarefasSelecionadas.size === 0}
                  onClick={() => setIsConfirmArquivarSelectedOpen(true)}
                  className="flex items-center gap-2 text-sm font-black bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-colors uppercase tracking-wide shadow-md"
                >
                  🗃️ Arquivar Selecionadas
                </button>
                <button
                  disabled={tarefasSelecionadas.size === 0}
                  onClick={() => setIsConfirmDeleteSelectedOpen(true)}
                  className="flex items-center gap-2 text-sm font-black bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-colors uppercase tracking-wide shadow-md"
                >
                  🗑️ Excluir
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tarefas.sort((a, b) => a.status === StatusTarefa.CONCLUIDA ? 1 : -1).map(tar => {
              const resp = usuarios.find(u => u.id === tar.atribuidaPara);
              const isSelecionada = tarefasSelecionadas.has(tar.id);
              return (
                <div
                  key={tar.id}
                  className={`bg-white p-6 rounded-3xl border-2 shadow-sm transition-all hover:shadow-xl relative overflow-hidden ${
                    modoSelecao && isSelecionada
                      ? 'border-indigo-500 ring-2 ring-indigo-300 bg-indigo-50/40'
                      : modoSelecao
                      ? 'border-slate-200 hover:border-indigo-300 cursor-pointer'
                      : 'border-slate-200'
                  } ${tar.status === StatusTarefa.CONCLUIDA && !modoSelecao ? 'opacity-60 bg-slate-50' : ''}`}
                  onClick={modoSelecao ? () => toggleSelecao(tar.id) : undefined}
                >
                  <div className={`absolute top-0 left-0 w-2 h-full ${tar.prioridade === 'ALTA' ? 'bg-rose-500' : tar.prioridade === 'MEDIA' ? 'bg-amber-500' : 'bg-slate-300'
                    }`} />

                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">ID: #{tar.id.slice(0, 6)}</span>
                    <div className="flex items-center gap-2">
                      {modoSelecao && (
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            isSelecionada
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'bg-white border-slate-300 hover:border-indigo-400'
                          }`}
                          onClick={(e) => { e.stopPropagation(); toggleSelecao(tar.id); }}
                        >
                          {isSelecionada && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${tar.status === StatusTarefa.EM_ANALISE ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {tar.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <h4 className={`font-black text-lg mb-2 leading-tight ${tar.status === StatusTarefa.CONCLUIDA ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {tar.titulo}
                  </h4>

                  <p className="text-sm text-slate-500 mb-4 font-medium line-clamp-3">
                    {tar.descricao.split(/Auto: ([^,]+)/).map((part, index, arr) => {
                        // split gives us: [ "Text before ", "AIT-123", ", text after" ]
                        // every odd index is the captured AIT
                        if (index % 2 === 1) {
                            return (
                                <React.Fragment key={index}>
                                    Auto: <Link to={`/recursos?tab=PROCESSOS&edit_infracao_by_auto=${encodeURIComponent(part.trim())}&returnTo=/tarefas`} className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold transition-all">{part}</Link>
                                </React.Fragment>
                            );
                        }
                        return part;
                    })}
                  </p>

                  {tar.imagemUrl && (
                    <div
                      className="mb-4 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer group/img hover:border-indigo-300 transition-colors"
                      onClick={() => setImageViewUrl(tar.imagemUrl || null)}
                    >
                      <img
                        src={tar.imagemUrl}
                        alt="Anexo da tarefa"
                        className="w-full max-h-40 object-cover group-hover/img:scale-105 transition-transform duration-300"
                      />
                      <p className="text-[9px] font-black text-slate-400 text-center py-1.5 uppercase tracking-widest bg-slate-50">🖼️ Clique para ampliar</p>
                    </div>
                  )}

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
                      <span className="text-xs font-black text-slate-800">{formatDateString(tar.dataPrazo)}</span>
                    </div>
                  </div>

                  {!modoSelecao && tar.status !== StatusTarefa.CONCLUIDA && (
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
                      {currentUser?.role === UserRole.ADMIN && tar.atribuidaPara && (
                        <Button
                          variant="ghost"
                          onClick={() => handleRemoverAtribuicao(tar.id)}
                          className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-[10px] font-bold uppercase tracking-wide transition-all"
                          size="sm"
                        >
                          ✖ Remover Atribuição
                        </Button>
                      )}
                    </div>
                  )}
                  {!modoSelecao && tar.status === StatusTarefa.CONCLUIDA && currentUser?.role === UserRole.ADMIN && (
                    <div className="mt-6 flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => handleArquivar(tar.id)}
                        className="w-full py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition-colors"
                        size="sm"
                      >
                        Arquivar Tarefa 🗃️
                      </Button>
                      {tar.atribuidaPara && (
                        <Button
                          variant="ghost"
                          onClick={() => handleRemoverAtribuicao(tar.id)}
                          className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-[10px] font-bold uppercase tracking-wide transition-all"
                          size="sm"
                        >
                          ✖ Remover Atribuição
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {tarefas.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 text-center py-16">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma tarefa ativa</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== TAB: ARQUIVO ========== */}
      {activeTab === 'arquivo' && (
        <>
          {/* Barra flutuante de seleção do arquivo */}
          {modoSelecaoArquivo && (
            <div className="sticky top-4 z-50 flex items-center justify-between bg-amber-700 text-white px-6 py-3 rounded-2xl shadow-2xl border border-amber-500 transition-all">
              <div className="flex items-center gap-4">
                <span className="text-sm font-black uppercase tracking-wider">
                  ☑️ {arquivadasSelecionadas.size} selecionada(s)
                </span>
                <button
                  onClick={selecionarTodasArquivadas}
                  className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
                >
                  Todas
                </button>
                <button
                  onClick={desmarcarTodasArquivadas}
                  className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
                >
                  Nenhuma
                </button>
              </div>
              <button
                disabled={arquivadasSelecionadas.size === 0}
                onClick={() => setIsConfirmDeleteSelecionadasArquivoOpen(true)}
                className="flex items-center gap-2 text-sm font-black bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-colors uppercase tracking-wide shadow-md"
              >
                🗑️ Excluir Permanentemente
              </button>
            </div>
          )}

          {tarefasArquivadas.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🗃️</p>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma tarefa arquivada</p>
              <p className="text-xs text-slate-400 mt-1">Tarefas concluídas podem ser arquivadas para controle histórico.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tarefasArquivadas.map(tar => {
                const resp = usuarios.find(u => u.id === tar.atribuidaPara);
                const isSelecionada = arquivadasSelecionadas.has(tar.id);
                const archivedDate = tar.archivedAt
                  ? new Date(tar.archivedAt).toLocaleDateString('pt-BR')
                  : '';

                return (
                  <div
                    key={tar.id}
                    className={`bg-white p-6 rounded-3xl border-2 shadow-sm transition-all hover:shadow-xl relative overflow-hidden opacity-80 ${
                      modoSelecaoArquivo && isSelecionada
                        ? 'border-amber-500 ring-2 ring-amber-300 bg-amber-50/40'
                        : modoSelecaoArquivo
                        ? 'border-slate-200 hover:border-amber-300 cursor-pointer'
                        : 'border-amber-100 bg-amber-50/20'
                    }`}
                    onClick={modoSelecaoArquivo ? () => toggleSelecaoArquivo(tar.id) : undefined}
                  >
                    {/* Faixa de prioridade */}
                    <div className={`absolute top-0 left-0 w-2 h-full ${tar.prioridade === 'ALTA' ? 'bg-rose-300' : tar.prioridade === 'MEDIA' ? 'bg-amber-300' : 'bg-slate-200'}`} />

                    {/* Badge arquivo */}
                    <div className="absolute top-3 right-3">
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 uppercase tracking-wider">
                        🗃️ Arquivado
                      </span>
                    </div>

                    <div className="flex justify-between items-start mb-4 pr-24">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">ID: #{tar.id.slice(0, 6)}</span>
                      {modoSelecaoArquivo && (
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            isSelecionada
                              ? 'bg-amber-600 border-amber-600'
                              : 'bg-white border-slate-300 hover:border-amber-400'
                          }`}
                          onClick={(e) => { e.stopPropagation(); toggleSelecaoArquivo(tar.id); }}
                        >
                          {isSelecionada && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>

                    <h4 className="font-black text-lg mb-2 leading-tight text-slate-600 line-through">
                      {tar.titulo}
                    </h4>

                    {tar.descricao && (
                      <p className="text-sm text-slate-400 mb-4 font-medium line-clamp-2">{tar.descricao}</p>
                    )}

                    {tar.motivoConclusao && (
                      <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Conclusão</p>
                        <p className="text-xs text-emerald-700 font-bold italic">"{tar.motivoConclusao}"</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100 mb-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsável</span>
                        <span className="text-xs font-black text-slate-600 uppercase">{resp ? resp.name : 'Não definido'}</span>
                      </div>
                      {archivedDate && (
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Arquivado em</span>
                          <span className="text-xs font-black text-amber-700">{archivedDate}</span>
                        </div>
                      )}
                    </div>

                    {!modoSelecaoArquivo && currentUser?.role === UserRole.ADMIN && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => handleDesarquivar(tar.id)}
                          className="py-2.5 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-[10px] font-bold uppercase tracking-wide transition-colors"
                          size="sm"
                        >
                          ↩️ Restaurar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleExcluirDoArquivo(tar.id)}
                          className="py-2.5 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white text-[10px] font-bold uppercase tracking-wide transition-colors"
                          size="sm"
                        >
                          🗑️ Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Report Generation Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Gerar Relatório de Tarefas"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Filtrar Por</label>
            <Select value={dateFilterType} onChange={(e) => setDateFilterType(e.target.value as any)}>
              <option value="created">Data de Criação</option>
              <option value="deadline">Data de Prazo</option>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {dateFilterType === 'created' ? '📝 Filtra pela data em que a tarefa foi criada' : '⏰ Filtra pela data de prazo da tarefa'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Relatório</label>
            <Select value={reportType} onChange={(e) => setReportType(e.target.value as any)}>
              <option value="monthly">Mensal (Mês Atual)</option>
              <option value="annual">Anual (Ano Atual)</option>
              <option value="custom">Personalizado</option>
            </Select>
          </div>
          {reportType === 'custom' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <Input type="date" label="Data Inicial" value={customDates.start} onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })} />
              <Input type="date" label="Data Final" value={customDates.end} onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsReportModalOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={generateReport}>📥 Gerar e Baixar</Button>
          </div>
        </div>
      </Modal>

      {/* Image Lightbox Modal */}
      {imageViewUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setImageViewUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImageViewUrl(null)}
              className="absolute -top-3 -right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 hover:bg-rose-100 hover:text-rose-600 transition-colors shadow-xl z-10 font-black text-lg"
            >
              ✕
            </button>
            <img
              src={imageViewUrl}
              alt="Visualização ampliada"
              className="w-full h-full object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Tarefas;
