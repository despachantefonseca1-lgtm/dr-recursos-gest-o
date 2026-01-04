import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { RecursoServico, RecursoCliente } from '../../types';
import { Button } from '../../components/ui/Button';

const Caixa: React.FC = () => {
    const [servicos, setServicos] = useState<RecursoServico[]>([]);
    const [clientes, setClientes] = useState<RecursoCliente[]>([]);
    const [loading, setLoading] = useState(true);

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

    const handleExport = () => {
        const headers = ['Data', 'Cliente', 'Telefone', 'Serviço', 'Valor Total', 'Valor Pago', 'Valor Pendente', 'Status'];
        const csvContent = servicos.map(s => {
            return [
                s.data_contratacao,
                getClienteName(s.cliente_id),
                getClientePhone(s.cliente_id),
                s.descricao_servico,
                s.valor_total.toString(),
                s.valor_pago.toString(),
                s.valor_pendente.toString(),
                s.status_pagamento
            ].join(',');
        });

        const csv = [headers.join(','), ...csvContent].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `relatorio_caixa_recursos_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const totalRecebido = servicos.reduce((acc, curr) => acc + (curr.valor_pago || 0), 0);
    const totalPendente = servicos.reduce((acc, curr) => acc + (curr.valor_pendente || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-700">Fluxo de Caixa (Recursos)</h2>
                <Button onClick={handleExport} variant="outline">📄 Exportar Relatório Mensal</Button>
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
        </div>
    );
};

export default Caixa;
