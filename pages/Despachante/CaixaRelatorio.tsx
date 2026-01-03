import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DespachanteDbService } from '../../services/despachanteDb';
import { CaixaLancamento, TipoLancamento, UserRole } from '../../types';
import { DbService } from '../../services/db';
import { Button } from '../../components/ui/Button';

const CaixaRelatorio: React.FC = () => {
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [lancamentos, setLancamentos] = useState<CaixaLancamento[]>([]);

    // Auth Check
    useEffect(() => {
        const user = DbService.getCurrentUser();
        if (!user || user.role !== UserRole.ADMIN) {
            alert('Acesso negado.');
            navigate('/despachante/caixa');
            return;
        }
        loadData();
    }, [selectedMonth]);

    const loadData = () => {
        const all = DespachanteDbService.getLancamentos();
        const active = all.filter(l => !l.deleted_at && l.data.startsWith(selectedMonth));
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
                    <h1 className="text-2xl font-bold text-slate-800">Relatório Mensal de Caixa</h1>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="month"
                        className="px-3 py-2 border border-slate-300 rounded-md"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                    />
                    <Button onClick={handlePrint}>🖨️ Imprimir</Button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center mb-6 border-b border-black pb-4">
                <h1 className="text-xl font-bold uppercase">Relatório Financeiro - Despachante</h1>
                <p className="text-sm">Mês de Referência: {selectedMonth}</p>
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
