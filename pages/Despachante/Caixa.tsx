import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DespachanteDbService } from '../../services/despachanteDb';
import { CaixaLancamento, TipoLancamento, UserRole } from '../../types';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';

const Caixa: React.FC = () => {
    const navigate = useNavigate();
    const [lancamentos, setLancamentos] = useState<CaixaLancamento[]>([]);
    const [filteredLancamentos, setFilteredLancamentos] = useState<CaixaLancamento[]>([]);
    const [userRole, setUserRole] = useState<UserRole>(UserRole.SECRETARIA);

    // Helper function to get current date in local timezone
    const getLocalDateString = (): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
    // WITHOUT creating a Date object (which would cause timezone conversion)
    const formatDateString = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    // Filters
    const today = getLocalDateString();
    const [startDate, setStartDate] = useState(today.substring(0, 8) + '01'); // 1st of month
    const [endDate, setEndDate] = useState(today);
    const [filterType, setFilterType] = useState<'TODOS' | TipoLancamento>('TODOS');
    const [filterText, setFilterText] = useState('');

    // Modals
    const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);
    const [isDespesaModalOpen, setIsDespesaModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportType, setReportType] = useState<'monthly' | 'annual' | 'custom'>('monthly');
    const [dateFilterType, setDateFilterType] = useState<'event' | 'registration'>('event');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });

    // Form Data
    const [formData, setFormData] = useState({
        descricao: '',
        valor: 0,
        forma_pagamento: '',
        cliente_nome: '',
        cliente_telefone: '',
        observacao: '', // For Despesa just append to description or use separate field logic
        categoria: ''
    });

    useEffect(() => {
        const user = api.getCurrentUser();
        if (user) {
            setUserRole(user.role);

            // Monthly Restriction Logic
            if (user.role !== UserRole.ADMIN) {
                const now = new Date();
                // First day of current month
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                // Last day of current month
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

                setStartDate(firstDay);
                setEndDate(lastDay);
            }
        }
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [lancamentos, startDate, endDate, filterType, filterText]);

    const loadData = async () => {
        const all = await DespachanteDbService.getLancamentos();
        // Filter out deleted
        const active = all.filter(l => !l.deleted_at);
        // Sort DESC
        // Sort DESC
        active.sort((a, b) => {
            const dateA = new Date(a.data).getTime();
            const dateB = new Date(b.data).getTime();
            if (dateA !== dateB) return dateB - dateA;

            // Fallback to created_at if exists
            const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return createdB - createdA;
        });
        setLancamentos(active);
    };

    const applyFilters = () => {
        let filtered = lancamentos;

        // Date Range
        if (startDate) {
            filtered = filtered.filter(l => l.data >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(l => l.data <= endDate);
        }

        // Type
        if (filterType !== 'TODOS') {
            filtered = filtered.filter(l => l.tipo === filterType);
        }

        // Text
        if (filterText) {
            const lower = filterText.toLowerCase();
            filtered = filtered.filter(l =>
                l.descricao.toLowerCase().includes(lower) ||
                (l.cliente_nome && l.cliente_nome.toLowerCase().includes(lower))
            );
        }

        setFilteredLancamentos(filtered);
    };

    const handleSaveEntrada = async () => {
        if (!formData.descricao || !formData.valor) {
            alert('Preencha descrição e valor!');
            return;
        }

        const user = api.getCurrentUser();

        const newEntry: Partial<CaixaLancamento> = {
            data: getLocalDateString(),
            tipo: TipoLancamento.ENTRADA,
            descricao: formData.descricao,
            valor: Number(formData.valor),
            forma_pagamento: formData.forma_pagamento,
            cliente_nome: formData.cliente_nome || 'ANÔNIMO',
            cliente_telefone: formData.cliente_telefone,
            criado_por: user?.name || 'Sistema'
        };

        try {
            await DespachanteDbService.saveLancamento(newEntry);
            alert('Entada salva com sucesso!');
            await loadData();
            setIsEntradaModalOpen(false);
            resetForm();
        } catch (error: any) {
            console.error(error);
            alert('Erro ao salvar entrada: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleSaveDespesa = async () => {
        if (!formData.descricao || !formData.valor) {
            alert('Preencha descrição e valor!');
            return;
        }

        const user = api.getCurrentUser();

        const newEntry: Partial<CaixaLancamento> = {
            data: getLocalDateString(),
            tipo: TipoLancamento.DESPESA,
            descricao: formData.descricao + (formData.categoria ? ` [${formData.categoria}]` : ''),
            valor: Number(formData.valor),
            criado_por: user?.name || 'Sistema'
        };

        try {
            await DespachanteDbService.saveLancamento(newEntry);
            alert('Despesa salva com sucesso!');
            await loadData();
            setIsDespesaModalOpen(false);
            resetForm();
        } catch (error: any) {
            console.error(error);
            alert('Erro ao salvar despesa: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const resetForm = () => {
        setFormData({
            descricao: '',
            valor: 0,
            forma_pagamento: '',
            cliente_nome: '',
            cliente_telefone: '',
            observacao: '',
            categoria: ''
        });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.')) {
            try {
                await DespachanteDbService.deleteLancamento(id);
                await loadData(); // Wait for data to reload
            } catch (error: any) {
                console.error('Error deleting lancamento:', error);
                alert('Erro ao excluir lançamento: ' + (error.message || 'Erro desconhecido'));
            }
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
            reportName = `relatorio_caixa_mensal_${year}_${String(month + 1).padStart(2, '0')}`;
        } else if (reportType === 'annual') {
            start = `${year}-01-01`;
            end = `${year}-12-31`;
            reportName = `relatorio_caixa_anual_${year}`;
        } else {
            if (!customDates.start || !customDates.end) {
                alert('Por favor, selecione as datas para o relatório personalizado.');
                return;
            }
            start = customDates.start;
            end = customDates.end;
            reportName = `relatorio_caixa_${start}_ate_${end}`;
        }

        // Filter by date range
        const reportData = lancamentos.filter(l => {
            const compareDate = dateFilterType === 'event'
                ? l.data             // Event date
                : l.created_at;       // Registration date

            if (!compareDate) return false;
            return compareDate >= start && compareDate <= end;
        });

        if (reportData.length === 0) {
            alert('Nenhum registro encontrado no período selecionado.');
            return;
        }

        // Generate CSV
        const headers = ['Data', 'Tipo', 'Descrição', 'Valor', 'Forma Pagamento', 'Cliente', 'Telefone'];
        const csvContent = reportData.map(l => {
            return [
                formatDateString(l.data),
                l.tipo,
                l.descricao,
                (l.valor || 0).toFixed(2).replace('.', ','),
                l.forma_pagamento || '',
                l.cliente_nome || '',
                l.cliente_telefone || ''
            ].join(';');
        });

        // Add totals
        const totalEntradas = reportData.filter(l => l.tipo === TipoLancamento.ENTRADA).reduce((acc, curr) => acc + (curr.valor || 0), 0);
        const totalDespesas = reportData.filter(l => l.tipo === TipoLancamento.DESPESA).reduce((acc, curr) => acc + (curr.valor || 0), 0);
        const saldo = totalEntradas - totalDespesas;

        csvContent.push('');
        csvContent.push(['TOTAIS', '', '', '', '', '', ''].join(';'));
        csvContent.push(['Total Entradas', '', '', totalEntradas.toFixed(2).replace('.', ','), '', '', ''].join(';'));
        csvContent.push(['Total Despesas', '', '', totalDespesas.toFixed(2).replace('.', ','), '', '', ''].join(';'));
        csvContent.push(['Saldo', '', '', saldo.toFixed(2).replace('.', ','), '', '', ''].join(';'));

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

        alert(`Relatório gerado com sucesso! ${reportData.length} registros exportados.`);
        setIsReportModalOpen(false);
    };

    // Totals Logic
    const calculateTotals = () => {
        const entradas = filteredLancamentos.filter(l => l.tipo === TipoLancamento.ENTRADA).reduce((acc, curr) => acc + curr.valor, 0);
        const despesas = filteredLancamentos.filter(l => l.tipo === TipoLancamento.DESPESA).reduce((acc, curr) => acc + curr.valor, 0);
        return { entradas, despesas, saldo: entradas - despesas };
    };

    const totals = calculateTotals();
    const isAdmin = userRole === UserRole.ADMIN;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Controle de Caixa</h1>
                    <p className="text-slate-500 text-sm">Gerencie o fluxo financeiro do despachante</p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
                                📄 Exportar Relatório
                            </Button>
                            <Button variant="secondary" onClick={() => navigate('/despachante/caixa/relatorio')}>
                                🖨️ Relatório Mensal
                            </Button>
                        </>
                    )}
                    <Button variant="outline" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100" onClick={() => setIsDespesaModalOpen(true)}>
                        - Nova Despesa
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setIsEntradaModalOpen(true)}>
                        + Entrada Avulsa
                    </Button>
                </div>
            </div>

            {/* Totals - Only for Admin */}
            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-sm text-slate-500 uppercase font-bold">Total Entradas</p>
                        <p className="text-2xl font-bold text-emerald-600">R$ {totals.entradas.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-sm text-slate-500 uppercase font-bold">Total Despesas</p>
                        <p className="text-2xl font-bold text-red-600">R$ {totals.despesas.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-sm text-slate-500 uppercase font-bold">Saldo do Período</p>
                        <p className={`text-2xl font-bold ${totals.saldo >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                            R$ {totals.saldo.toFixed(2)}
                        </p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="relative">
                        <Input label="De" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={!isAdmin} />
                        {!isAdmin && <span className="absolute top-8 right-8 text-xs text-slate-400">🔒</span>}
                    </div>
                    <div className="relative">
                        <Input label="Até" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={!isAdmin} />
                        {!isAdmin && <span className="absolute top-8 right-8 text-xs text-slate-400">🔒</span>}
                    </div>
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                    <select
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as any)}
                    >
                        <option value="TODOS">Todos</option>
                        <option value={TipoLancamento.ENTRADA}>Entradas</option>
                        <option value={TipoLancamento.DESPESA}>Despesas</option>
                    </select>
                </div>
                <div className="flex-[2]">
                    <Input label="Buscar" placeholder="Descrição ou Cliente..." value={filterText} onChange={e => setFilterText(e.target.value)} />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Tipo</th>
                            <th className="px-4 py-3">Descrição</th>
                            <th className="px-4 py-3">Cliente</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                            <th className="px-4 py-3">Criado por</th>
                            <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredLancamentos.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum lançamento encontrado.</td>
                            </tr>
                        ) : (
                            filteredLancamentos.map(l => (
                                <tr key={l.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-700">{formatDateString(l.data)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${l.tipo === TipoLancamento.ENTRADA ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {l.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-800 font-medium">{l.descricao}</td>
                                    <td className="px-4 py-3 text-slate-600">{l.cliente_nome || '-'}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${l.tipo === TipoLancamento.ENTRADA ? 'text-emerald-600' : 'text-red-600'
                                        }`}>
                                        R$ {l.valor.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{l.criado_por}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleDelete(l.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                            title="Excluir Lançamento"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Entrada Avulsa */}
            <Modal isOpen={isEntradaModalOpen} onClose={() => setIsEntradaModalOpen(false)} title="Nova Entrada Avulsa">
                <div className="space-y-4">
                    <Input label="Descrição *" placeholder="Ex: Cópia, Consulta..." value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} />
                    <Input label="Valor (R$) *" type="number" step="0.01" value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} />
                    <Input label="Forma de Pagamento" placeholder="Pix, Dinheiro..." value={formData.forma_pagamento} onChange={e => setFormData({ ...formData, forma_pagamento: e.target.value })} />
                    <Input label="Nome do Cliente (Opcional)" value={formData.cliente_nome} onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })} />
                    <Input label="Telefone (Opcional)" value={formData.cliente_telefone} onChange={e => setFormData({ ...formData, cliente_telefone: e.target.value })} />
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button variant="secondary" onClick={() => setIsEntradaModalOpen(false)}>Cancelar</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveEntrada}>Salvar Entrada</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Despesa */}
            <Modal isOpen={isDespesaModalOpen} onClose={() => setIsDespesaModalOpen(false)} title="Nova Despesa">
                <div className="space-y-4">
                    <Input label="Descrição *" placeholder="Ex: Material escritório, Luz..." value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} />
                    <Input label="Valor (R$) *" type="number" step="0.01" value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} />
                    <Input label="Categoria (Opcional)" placeholder="Ex: Fixo, Variável..." value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })} />
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button variant="secondary" onClick={() => setIsDespesaModalOpen(false)}>Cancelar</Button>
                        <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSaveDespesa}>Salvar Despesa</Button>
                    </div>
                </div>
            </Modal>

            {/* Report Generation Modal */}
            <Modal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                title="Gerar Relatório de Caixa"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Filtrar Por
                        </label>
                        <Select
                            value={dateFilterType}
                            onChange={(e) => setDateFilterType(e.target.value as any)}
                        >
                            <option value="event">Data do Lançamento</option>
                            <option value="registration">Data de Cadastro no Sistema</option>
                        </Select>
                        <p className="text-xs text-slate-500 mt-1">
                            {dateFilterType === 'event'
                                ? '📅 Filtra pela data do lançamento'
                                : '📝 Filtra pela data em que foi cadastrado'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Tipo de Relatório
                        </label>
                        <Select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value as any)}
                        >
                            <option value="monthly">Mensal (Mês Atual)</option>
                            <option value="annual">Anual (Ano Atual)</option>
                            <option value="custom">Personalizado</option>
                        </Select>
                    </div>

                    {reportType === 'custom' && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                            <Input
                                type="date"
                                label="Data Inicial"
                                value={customDates.start}
                                onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                            />
                            <Input
                                type="date"
                                label="Data Final"
                                value={customDates.end}
                                onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-700 mb-2">📊 Informações do Relatório</p>
                        <ul className="text-xs text-slate-600 space-y-1">
                            <li>• Exporta para formato CSV</li>
                            <li>• Inclui totais (Entradas, Despesas, Saldo)</li>
                            <li>• Compatível com Excel</li>
                        </ul>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            variant="ghost"
                            onClick={() => setIsReportModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={generateReport}
                        >
                            📥 Gerar e Baixar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Caixa;
