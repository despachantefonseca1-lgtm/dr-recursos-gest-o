import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { RecursoCliente } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useGlobalModal } from '../../contexts/GlobalModalContext';
import { useSearchParams } from 'react-router-dom';

/** Remove acentos e normaliza string para busca sem distinção de acentuação */
const normalizeStr = (str: string): string =>
    str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const Clientes: React.FC = () => {
    const [clientes, setClientes] = useState<RecursoCliente[]>([]);
    const [loading, setLoading] = useState(true);
    const { openClienteModal } = useGlobalModal();
    const [searchParams, setSearchParams] = useSearchParams();

    // Search state
    const [clientSearchTerm, setClientSearchTerm] = useState('');

    const loadClientes = async () => {
        setLoading(true);
        try {
            const data = await api.getRecursosClientes();
            setClientes(data);
        } catch (error) {
            console.error("Erro ao carregar clientes", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClientes();
    }, []);

    // Auto-open modal when navigating from infraction
    useEffect(() => {
        const clienteId = searchParams.get('cliente_id');
        if (clienteId && clientes.length > 0) {
            const cliente = clientes.find(c => c.id === clienteId);
            if (cliente) {
                openClienteModal(cliente.id, { onSave: loadClientes });
                // Clear the parameter after opening
                setSearchParams({});
            }
        }
    }, [searchParams, clientes, openClienteModal, setSearchParams]);

    const handleExport = () => {
        if (clientes.length === 0) {
            alert('Nenhum cliente para exportar.');
            return;
        }

        const headers = ['Nome', 'CPF', 'RG', 'Telefone', 'Nacionalidade', 'Estado Civil', 'Profissão', 'Endereço'];
        const rows = clientes.map(c => [
            c.nome,
            c.cpf,
            c.rg || '',
            c.telefone || '',
            c.nacionalidade || '',
            c.estado_civil || '',
            c.profissao || '',
            c.endereco || ''
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `clientes_recursos_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <div className="flex justify-between mb-4">
                <div className="flex-1 mr-4">
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Clientes</h2>
                    <div className="relative max-w-md">
                        <Input
                            value={clientSearchTerm}
                            onChange={e => setClientSearchTerm(e.target.value)}
                            placeholder="Buscar por nome ou CPF..."
                            className="pl-8"
                        />
                        <span className="absolute left-3 top-3.5 text-slate-400">🔍</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>📊 Exportar Lista</Button>
                    <Button onClick={() => openClienteModal(null, { onSave: loadClientes })}>Novo Cliente</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientes
                    .filter(c => {
                        if (!clientSearchTerm) return true;
                        const searchNorm = normalizeStr(clientSearchTerm);
                        return (
                            normalizeStr(c.nome).includes(searchNorm) ||
                            normalizeStr(c.cpf).includes(searchNorm)
                        );
                    })
                    .map(c => (
                        <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => openClienteModal(c.id, { onSave: loadClientes })}>
                            <h3 className="font-bold text-slate-800">{c.nome}</h3>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">{c.cpf} • {c.telefone}</p>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default Clientes;
