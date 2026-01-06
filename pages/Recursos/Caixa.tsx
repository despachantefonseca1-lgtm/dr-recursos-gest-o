import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { RecursoServico, RecursoCliente } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';

const Caixa: React.FC = () => {
    const [servicos, setServicos] = useState<RecursoServico[]>([]);
    const [clientes, setClientes] = useState<RecursoCliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportType, setReportType] = useState<'monthly' | 'annual' | 'custom'>('monthly');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().slice(0, 8) + '01',
        end: new Date().toISOString().slice(0, 10)
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [s, c] = await Promise.all([
                api.getRecursosServicos(),
                api.getRecursosClientes()
            ]);
            setServicos(s);
            setClientes(c);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getClienteName = (id: string) => {
        const cliente = clientes.find(c => c.id === id);
        return cliente ? cliente.nome : 'Cliente Desconhecido';
    };

    const getClientePhone = (id: string) => {
        const cliente = clientes.find(c => c.id === id);
        return cliente ? cliente.telefone : '-';
    };

    const filteredServicos = servicos.filter(s => {
        if (!s.data_contratacao) return false;
        return s.data_contratacao >= dateRange.start && s.data_contratacao <= dateRange.end;
    });

    const generateReport = () => {
        let start = '';
        let end = '';
        let reportName = '';

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        if (reportType === 'monthly') {
            // Current month
            start = new Date(year, month, 1).toISOString().slice(0, 10);
            end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
            reportName = `relatorio_mensal_${year}_${String(month + 1).padStart(2, '0')}`;
        } else if (reportType === 'annual') {
            // Current year
            start = `${year}-01-01`;
            end = `${year}-12-31`;
            reportName = `relatorio_anual_${year}`;
        } else {
            // Custom
            if (!customDates.start || !customDates.end) {
                alert('Por favor, selecione as datas para o relatório personalizado.');
                return;
            }
            start = customDates.start;
            end = customDates.end;
            reportName = `relatorio_personalizado_${start}_ate_${end}`;
        }

        // Filter services by date range
        const reportServicos = servicos.filter(s => {
            if (!s.data_contratacao) return false;
            return s.data_contratacao >= start && s.data_contratacao <= end;
        });

        if (reportServicos.length === 0) {
            alert('Nenhum registro encontrado no período selecionado.');
            return;
        }

        // Generate CSV
        const headers = ['Data', 'Cliente', 'Telefone', 'Serviço', 'Valor Total', 'Valor Pago', 'Valor Pendente', 'Status'];
        const csvContent = reportServicos.map(s => {
            return [
                new Date(s.data_contratacao).toLocaleDateString('pt-BR'),
                getClienteName(s.cliente_id),
                getClientePhone(s.cliente_id),
                s.descricao_servico,
                (s.valor_total || 0).toFixed(2).replace('.', ','),
                (s.valor_pago || 0).toFixed(2).replace('.', ','),
                (s.valor_pendente || 0).toFixed(2).replace('.', ','),
                s.status_pagamento
            ].join(';');
        });

        // Add totals row
        const totalRecebido = reportServicos.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0);
        const totalPendente = reportServicos.reduce((acc, curr) => acc + (curr.valor_pendente || 0), 0);
        const totalGeral = reportServicos.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

        csvContent.push('');
        csvContent.push(['TOTAIS', '', '', '', totalGeral.toFixed(2).replace('.', ','), totalRecebido.toFixed(2).replace('.', ','), totalPendente.toFixed(2).replace('.', ','), ''].join(';'));

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

        alert(`Relatório gerado com sucesso! ${reportServicos.length} registros exportados.`);
        setIsReportModalOpen(false);
    };

    const handleExport = () => {
        setIsReportModalOpen(true);
    };

    const totalRecebido = filteredServicos.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0);
    const totalPendente = filteredServicos.reduce((acc, curr) => acc + (curr.valor_pendente || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Fluxo de Caixa (Recursos)</h2>
                    <div className="flex gap-2">
                        <Input
                            type="date"
                            label="De"
                            value={dateRange.start}
                            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                            className="w-40"
                        />
                        <Input
                            type="date"
                            label="Até"
                            value={dateRange.end}
                            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                            className="w-40"
                        />
                    </div>
                </div>
                <Button onClick={handleExport} variant="outline">📄 Exportar Relatório</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-xs font-black text-emerald-600 uppercase">Total Recebido</p>
                    <p className="text-2xl font-black text-emerald-700">R$ {totalRecebido.toFixed(2)}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <p className="text-xs font-black text-amber-600 uppercase">Total Pendente</p>
                    <p className="text-2xl font-black text-amber-700">R$ {totalPendente.toFixed(2)}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Cliente</th>
                            <th className="px-4 py-3">Serviço</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-right">Pago</th>
                            <th className="px-4 py-3 text-right">Pendente</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {servicos.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-600">{new Date(s.data_contratacao).toLocaleDateString()}</td>
                                <td className="px-4 py-3 font-bold text-slate-800">
                                    {getClienteName(s.cliente_id)}
                                    <span className="block text-[10px] text-slate-400 font-normal">{getClientePhone(s.cliente_id)}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{s.descricao_servico}</td>
                                <td className="px-4 py-3 text-right font-medium">R$ {s.valor_total?.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-medium">R$ {s.valor_pago?.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-rose-500 font-medium">R$ {s.valor_pendente?.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${s.status_pagamento === 'PAGO' ? 'bg-emerald-100 text-emerald-700' :
                                        s.status_pagamento === 'PARCIAL' ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                        }`}>
                                        {s.status_pagamento}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                        icon="🗑️"
                                        onClick={async () => {
                                            if (confirm('Deseja excluir este lançamento?')) {
                                                try {
                                                    await api.deleteRecursoServico(s.id);
                                                    loadData();
                                                } catch (e) {
                                                    console.error(e);
                                                    alert("Erro ao excluir lançamento.");
                                                }
                                            }
                                        }}
                                    />
                                </td>
                            </tr>
                        ))}
                        {servicos.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum lançamento encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Report Generation Modal */}
            <Modal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                title="Gerar Relatório"
            >
                <div className="space-y-6">
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
                            <li>• Inclui totais no final</li>
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
