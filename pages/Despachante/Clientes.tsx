import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DespachanteDbService } from '../../services/despachanteDb';
import { Cliente, ServicoDespachante } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const Clientes: React.FC = () => {
    const navigate = useNavigate();
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // New Client Form State
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientObs, setNewClientObs] = useState('');

    useEffect(() => {
        loadClientes();
    }, []);

    const loadClientes = () => {
        setClientes(DespachanteDbService.getClientes());
    };

    const filteredClientes = clientes.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.telefone.includes(searchTerm)
    );

    const handleSaveClient = () => {
        if (!newClientName || !newClientPhone) {
            alert('Nome e Telefone são obrigatórios');
            return;
        }

        const newClient: Cliente = {
            id: crypto.randomUUID(),
            nome: newClientName,
            telefone: newClientPhone,
            observacoes_cliente: newClientObs,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        DespachanteDbService.saveCliente(newClient);
        loadClientes();
        setIsModalOpen(false);
        setNewClientName('');
        setNewClientPhone('');
        setNewClientObs('');
    };

    const getLastServiceDate = (clienteId: string) => {
        const services = DespachanteDbService.getServicosByClienteId(clienteId);
        if (services.length === 0) return '-';
        // Sort by date desc
        const sorted = services.sort((a, b) => new Date(b.data_servico).getTime() - new Date(a.data_servico).getTime());
        return new Date(sorted[0].data_servico).toLocaleDateString('pt-BR');
    };

    const getServiceCount = (clienteId: string) => {
        return DespachanteDbService.getServicosByClienteId(clienteId).length;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
                    <p className="text-slate-500">Gerencie seus clientes e serviços</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    + Novo Cliente
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <Input
                        label=""
                        placeholder="Buscar por nome ou telefone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-md"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Telefone</th>
                                <th className="px-6 py-4 text-center">Qtde. Serviços</th>
                                <th className="px-6 py-4 text-center">Último Serviço</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClientes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        Nenhum cliente encontrado
                                    </td>
                                </tr>
                            ) : (
                                filteredClientes.map((cliente) => (
                                    <tr
                                        key={cliente.id}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                        onClick={() => navigate(`/despachante/clientes/${cliente.id}`)}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-indigo-600">
                                            {cliente.nome}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {cliente.telefone}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
                                                {getServiceCount(cliente.id)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-500">
                                            {getLastServiceDate(cliente.id)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-indigo-600 hover:text-indigo-800 font-medium text-xs uppercase tracking-wide">
                                                Ver Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Novo Cliente"
            >
                <div className="space-y-4">
                    <Input
                        label="Nome Completo *"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                    />
                    <Input
                        label="Telefone *"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                    />
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Observações</label>
                        <textarea
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-24 text-sm"
                            value={newClientObs}
                            onChange={(e) => setNewClientObs(e.target.value)}
                        />
                    </div>
                    <div className="pt-4 flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveClient}>
                            Salvar Cliente
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Clientes;
