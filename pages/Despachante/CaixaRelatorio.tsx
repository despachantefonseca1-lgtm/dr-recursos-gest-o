import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DespachanteDbService } from '../../services/despachanteDb';
import { CaixaLancamento, TipoLancamento, UserRole } from '../../types';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';

const CaixaRelatorio: React.FC = () => {
    const navigate = useNavigate();
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().slice(0, 8) + '01', // First day of current month
        end: new Date().toISOString().slice(0, 10) // Today
    });
    const [lancamentos, setLancamentos] = useState<CaixaLancamento[]>([]);

    // Auth Check
    useEffect(() => {
        const user = api.getCurrentUser();
        if (!user || user.role !== UserRole.ADMIN) {
            alert('Acesso negado.');
            navigate('/despachante/caixa');
            return;
        }
        loadData();
    }, [dateRange]);

    const loadData = async () => {
        const all = await DespachanteDbService.getLancamentos();
        const active = all.filter(l => {
            if (l.deleted_at) return false;
            const lDate = new Date(l.data);
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            // Adjust end date to include the whole day if needed, or just compare dates
            // Simple string comparison works for ISO dates YYYY-MM-DD if formatted correctly
            return l.data >= dateRange.start && l.data <= dateRange.end;
        });
        // Sort Date Ascending for Report
        active.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
        setLancamentos(active);
    };

    const entradas = lancamentos.filter(l => l.tipo === TipoLancamento.ENTRADA);
    const despesas = lancamentos.filter(l => l.tipo === TipoLancamento.DESPESA);

    const totalEntradas = entradas.reduce((acc, curr) => acc + curr.valor, 0);
    const totalDespesas = despesas.reduce((acc, curr) => acc + curr.valor, 0);
    const saldo = totalEntradas - totalDespesas;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 print:space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 no-print">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/despachante/caixa')} className="text-slate-400 hover:text-slate-600">
                        ← Voltar
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800">Relatório Financeiro</h1>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Início</span>
                        <input
                            type="date"
                            className="text-xs font-bold text-slate-700 bg-transparent outline-none"
                            value={dateRange.start}
                            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        />
                    </div>
                    <div className="w-px h-8 bg-slate-200 mx-2"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Fim</span>
                        <input
                            type="date"
                            className="text-xs font-bold text-slate-700 bg-transparent outline-none"
                            value={dateRange.end}
                            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handlePrint}>🖨️ Imprimir</Button>
                    <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => {
                            if (lancamentos.length === 0) return;

                            // Define headers
                            const headers = ['Data', 'Tipo', 'Descrição', 'Cliente', 'Valor'];

                            // Format data rows
                            const rows = lancamentos.map(l => {
                                const tipo = l.tipo === TipoLancamento.ENTRADA ? 'Entrada' : 'Despesa';
                                const cliente = l.cliente_nome && l.cliente_nome !== 'ANÔNIMO' ? l.cliente_nome : '';

                                return [
                                    new Date(l.data).toLocaleDateString('pt-BR'),
                                    tipo,
                                    l.descricao,
                                    cliente,
                                    l.valor.toFixed(2).replace('.', ',')
                                ];
                            });

                            // Combine headers and rows
                            const csvContent = [
                                headers.join(';'),
                                ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
                            ].join('\n');

                            // Create download link
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            const url = URL.createObjectURL(blob);
                            link.setAttribute('href', url);
                            link.setAttribute('download', `relatorio_caixa_${dateRange.start}_a_${dateRange.end}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        Exportar CSV
                    </Button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center mb-6 border-b border-black pb-4">
                <h1 className="text-xl font-bold uppercase">Relatório Financeiro - Despachante</h1>
                <p className="text-sm">Período: {new Date(dateRange.start).toLocaleDateString()} até {new Date(dateRange.end).toLocaleDateString()}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 print:border-black">
                    <p className="text-xs uppercase font-bold text-slate-500">Entradas</p>
                    <p className="text-xl font-bold text-emerald-600">R$ {totalEntradas.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 print:border-black">
                    <p className="text-xs uppercase font-bold text-slate-500">Despesas</p>
                    <p className="text-xl font-bold text-red-600">R$ {totalDespesas.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 print:border-black">
                    <p className="text-xs uppercase font-bold text-slate-500">Saldo Líquido</p>
                    <p className="text-xl font-bold text-slate-800">R$ {saldo.toFixed(2)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-2">
                {/* Entradas List */}
                <div>
                    <h3 className="text-lg font-bold text-emerald-700 mb-3 border-b border-emerald-200 pb-2">Entradas</h3>
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="py-1">Dia</th>
                                <th className="py-1">Descrição</th>
                                <th className="py-1 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entradas.map(l => (
                                <tr key={l.id} className="border-b border-slate-100">
                                    <td className="py-1">{l.data.split('-')[2]}</td>
                                    <td className="py-1">
                                        {l.descricao}
                                        {l.cliente_nome && l.cliente_nome !== 'ANÔNIMO' && <span className="text-slate-400 block text-[10px]">{l.cliente_nome}</span>}
                                    </td>
                                    <td className="py-1 text-right font-medium">R$ {l.valor.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Despesas List */}
                <div>
                    <h3 className="text-lg font-bold text-red-700 mb-3 border-b border-red-200 pb-2">Despesas</h3>
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="py-1">Dia</th>
                                <th className="py-1">Descrição</th>
                                <th className="py-1 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {despesas.map(l => (
                                <tr key={l.id} className="border-b border-slate-100">
                                    <td className="py-1">{l.data.split('-')[2]}</td>
                                    <td className="py-1">{l.descricao}</td>
                                    <td className="py-1 text-right font-medium">R$ {l.valor.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { margin: 20px; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default CaixaRelatorio;
