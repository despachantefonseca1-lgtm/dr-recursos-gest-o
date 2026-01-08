import React, { useState, useEffect } from 'react';
import { DespachanteDbService } from '../../services/despachanteDb';
import { ServicoDespachante, Cliente } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const Relatorios: React.FC = () => {
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [servicosFiltrados, setServicosFiltrados] = useState<(ServicoDespachante & { clienteNome: string })[]>([]);

    useEffect(() => {
        // Default to current month
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        setDataInicio(firstDay);
        setDataFim(lastDay);
        filtrar(firstDay, lastDay);
    }, []);

    // Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
    // WITHOUT creating a Date object (which would cause timezone conversion)
    const formatDateString = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const filtrar = async (inicio: string, fim: string) => {
        const allServicos = await DespachanteDbService.getServicos();
        const allClientes = await DespachanteDbService.getClientes();

        const filtered = allServicos.filter(s => {
            return s.data_servico >= inicio && s.data_servico <= fim;
        }).map(s => {
            const c = allClientes.find(cli => cli.id === s.cliente_id);
            return { ...s, clienteNome: c ? c.nome : 'Cliente Removido' };
        });

        // sort by date desc
        filtered.sort((a, b) => new Date(b.data_servico).getTime() - new Date(a.data_servico).getTime());
        setServicosFiltrados(filtered);
    };

    const handleFiltrar = () => {
        filtrar(dataInicio, dataFim);
    };

    const totalValor = servicosFiltrados.reduce((acc, curr) => acc + (curr.pagamento_valor || 0), 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Relatório de Serviços</h1>
                <p className="text-slate-500">Visualize os serviços realizados por período</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <Input
                        label="Data Início"
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="w-full sm:w-auto"
                    />
                    <Input
                        label="Data Fim"
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="w-full sm:w-auto"
                    />
                    <Button onClick={handleFiltrar} className="h-10 mb-[2px]">
                        Filtrar
                    </Button>
                    <Button
                        variant="outline"
                        className="h-10 mb-[2px] flex items-center gap-2"
                        onClick={() => {
                            if (servicosFiltrados.length === 0) return;

                            // Define headers
                            const headers = ['Data', 'Cliente', 'Veículo', 'Placa', 'Serviço', 'Valor'];

                            // Format data rows
                            const rows = servicosFiltrados.map(s => [
                                formatDateString(s.data_servico),
                                s.clienteNome,
                                s.veiculo,
                                s.placa,
                                s.servico_descricao,
                                s.pagamento_valor?.toFixed(2).replace('.', ',')
                            ]);

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
                            link.setAttribute('download', `relatorio_servicos_${dataInicio}_${dataFim}.csv`);
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                    <p className="text-sm font-bold text-indigo-500 uppercase tracking-wider mb-1">Total de Serviços</p>
                    <p className="text-3xl font-black text-indigo-900">{servicosFiltrados.length}</p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                    <p className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-1">Valor Total (R$)</p>
                    <p className="text-3xl font-black text-emerald-900">R$ {totalValor.toFixed(2)}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Veículo/Placa</th>
                                <th className="px-6 py-4">Serviço</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {servicosFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        Nenhum serviço neste período
                                    </td>
                                </tr>
                            ) : (
                                servicosFiltrados.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                            {formatDateString(s.data_servico)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-900 font-bold">
                                            {s.clienteNome}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {s.veiculo} <span className="text-slate-400 mx-1">|</span> {s.placa}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {s.servico_descricao}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                            R$ {s.pagamento_valor?.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Relatorios;
