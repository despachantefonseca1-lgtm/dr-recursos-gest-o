import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { RecursoCliente, RecursoVeiculo, RecursoServico, Infracao, FaseRecursal, StatusInfracao } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { generateProcuracaoPDF } from '../../services/pdfService';

const Clientes: React.FC = () => {
    const [clientes, setClientes] = useState<RecursoCliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'DADOS' | 'VEICULOS' | 'SERVICOS' | 'INFRACOES'>('DADOS');

    // Form State
    const [formData, setFormData] = useState<Partial<RecursoCliente>>({});
    const [veiculos, setVeiculos] = useState<RecursoVeiculo[]>([]);
    const [servicos, setServicos] = useState<RecursoServico[]>([]);
    const [infracoes, setInfracoes] = useState<Infracao[]>([]);

    // Auxiliary State for new Vehicle
    const [newVeiculo, setNewVeiculo] = useState<Partial<RecursoVeiculo>>({ tipo_vinculo: 'PROPRIETARIO' });
    // Auxiliary State for new Service
    const [newServico, setNewServico] = useState<Partial<RecursoServico>>({ status_pagamento: 'PENDENTE' });
    // Auxiliary State for new Infraction
    const [newInfracao, setNewInfracao] = useState<Partial<Infracao>>({
        numeroAuto: '',
        placa: '',
        dataInfracao: '',
        descricao: '',
        orgao_responsavel: '',
        dataLimiteProtocolo: '',
        faseRecursal: FaseRecursal.DEFESA_PREVIA,
        status: StatusInfracao.RECURSO_A_FAZER,
        observacoes: ''
    });

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

    const handleEdit = async (cliente: RecursoCliente) => {
        setEditingId(cliente.id);
        setFormData(cliente);
        setActiveTab('DADOS');

        // Load related data
        try {
            const v = await api.getRecursosVeiculos(cliente.id);
            setVeiculos(v);

            // Load infractions for this client
            const allInfracoes = await api.getInfracoes();
            const clienteInfracoes = allInfracoes.filter(inf => inf.cliente_id === cliente.id);
            setInfracoes(clienteInfracoes);
        } catch (e) {
            console.error(e);
        }

        setIsModalOpen(true);
    };

    const handleSaveCliente = async () => {
        try {
            if (editingId) {
                await api.updateRecursoCliente(editingId, formData);
            } else {
                const newEx = await api.createRecursoCliente(formData as any);
                setEditingId(newEx.id); // Switch to edit mode to allow adding vehicles
            }
            loadClientes();
            if (!editingId) {
                // If it was creation, keep modal open but switch to edit mode essentially
                // Actually, let's close for simplicity or ask user
                alert("Cliente salvo! Agora você pode adicionar veículos e serviços editando este cliente.");
                setIsModalOpen(false);
            } else {
                alert("Dados atualizados!");
            }
        } catch (error) {
            alert("Erro ao salvar cliente.");
        }
    };

    const handleAddVeiculo = async () => {
        if (!editingId) return;
        try {
            await api.createRecursoVeiculo({
                ...newVeiculo,
                cliente_id: editingId
            } as any);
            const v = await api.getRecursosVeiculos(editingId);
            setVeiculos(v);
            setNewVeiculo({ tipo_vinculo: 'PROPRIETARIO', marca: '', modelo: '', placa: '', renavam: '', chassi: '' });
            alert("Veículo adicionado!");
        } catch (error) {
            alert("Erro ao adicionar veículo");
        }
    };

    const handleDeleteVeiculo = async (id: string) => {
        if (!confirm("Remover veículo?")) return;
        try {
            await api.deleteRecursoVeiculo(id);
            if (editingId) {
                const v = await api.getRecursosVeiculos(editingId);
                setVeiculos(v);
            }
            alert('Veículo excluído com sucesso!');
        } catch (error: any) {
            console.error('Error deleting veiculo:', error);
            alert('Erro ao excluir veículo: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleAddServico = async () => {
        if (!editingId) return;

        // Validation
        if (!newServico.descricao_servico?.trim()) {
            alert("A descrição do serviço é obrigatória.");
            return;
        }

        // Helper to get local date string
        const getLocalDateString = (): string => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        try {
            const pendente = (newServico.valor_total || 0) - (newServico.valor_pago || 0);
            const payload = {
                ...newServico,
                cliente_id: editingId,
                veiculo_id: newServico.veiculo_id || undefined, // Send undefined if empty string
                data_contratacao: newServico.data_contratacao || getLocalDateString(), // Default to today if empty
                valor_pendente: pendente,
                status_pagamento: pendente <= 0 ? 'PAGO' : newServico.status_pagamento
            };

            await api.createRecursoServico(payload as any);

            // Refresh services
            // Ideally we need an api method to get services by client
            // For now, let's just reload the whole client or mock it if api not ready
            // But wait, I didn't verify if I added getRecursosServicosByClienteId. 
            // I added getRecursosServicos (all) and getRecursosVeiculos (by client).
            // Let's rely on effective refresh or just fetch all and filter/refactor api later.
            // Actually, getRecursosServicos returns ALL services. Not efficient but works for now.
            // Let's filter client side.
            const all = await api.getRecursosServicos();
            setServicos(all.filter(s => s.cliente_id === editingId));

            setNewServico({ status_pagamento: 'PENDENTE', valor_total: 0, valor_pago: 0, descricao_servico: '' });
            alert("Serviço adicionado com sucesso!");
        } catch (error: any) {
            console.error("Erro ao adicionar serviço:", error);
            alert(`Erro ao adicionar serviço: ${error.message || JSON.stringify(error)}`);
        }
    };

    const handleDeleteServico = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
        try {
            await api.deleteRecursoServico(id);
            if (editingId) {
                const all = await api.getRecursosServicos();
                setServicos(all.filter(s => s.cliente_id === editingId));
            }
            alert('Serviço excluído com sucesso!');
        } catch (error: any) {
            console.error('Error deleting servico:', error);
            alert('Erro ao excluir serviço: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleAddInfracao = async () => {
        if (!editingId) return;

        // Validation
        if (!newInfracao.numeroAuto?.trim() || !newInfracao.dataInfracao || !newInfracao.dataLimiteProtocolo) {
            alert("Preencha os campos obrigatórios: Número do Auto, Data da Infração e Data Limite Protocolo.");
            return;
        }

        try {
            await api.createInfracao({
                ...newInfracao,
                cliente_id: editingId,
                placa: newInfracao.placa || '',
                descricao: newInfracao.descricao || '',
                observacoes: newInfracao.observacoes || '',
                acompanhamentoMensal: false,
                intervaloAcompanhamento: 0
            } as Infracao);

            // Refresh infractions
            const allInfracoes = await api.getInfracoes();
            const clienteInfracoes = allInfracoes.filter(inf => inf.cliente_id === editingId);
            setInfracoes(clienteInfracoes);

            // Reset form
            setNewInfracao({
                numeroAuto: '',
                placa: '',
                dataInfracao: '',
                descricao: '',
                orgao_responsavel: '',
                dataLimiteProtocolo: '',
                faseRecursal: FaseRecursal.DEFESA_PREVIA,
                status: StatusInfracao.RECURSO_A_FAZER,
                observacoes: ''
            });

            alert("Infração adicionada com sucesso!");
        } catch (error: any) {
            console.error("Erro ao adicionar infração:", error);
            alert(`Erro ao adicionar infração: ${error.message || JSON.stringify(error)}`);
        }
    };

    const handleDeleteInfracao = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta infração?')) return;
        try {
            await api.deleteInfracao(id);
            if (editingId) {
                const allInfracoes = await api.getInfracoes();
                const clienteInfracoes = allInfracoes.filter(inf => inf.cliente_id === editingId);
                setInfracoes(clienteInfracoes);
            }
            alert('Infração excluída com sucesso!');
        } catch (error: any) {
            console.error('Error deleting infracao:', error);
            alert('Erro ao excluir infração: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleDeleteCliente = async () => {
        if (!editingId) return;
        if (!confirm("TEM CERTEZA? Ao excluir o cliente, todos os veículos e serviços associados também serão removidos permanentemente.")) return;

        try {
            await api.deleteRecursoCliente(editingId);
            setIsModalOpen(false);
            await loadClientes();
            alert("Cliente excluído com sucesso.");
        } catch (error: any) {
            console.error('Error deleting cliente:', error);
            alert('Erro ao excluir cliente: ' + (error.message || 'Erro desconhecido. Verifique se há veículos ou serviços vinculados.'));
        }
    };

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
                <h2 className="text-xl font-bold text-slate-700">Clientes</h2>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>📊 Exportar Lista</Button>
                    <Button onClick={() => {
                        setEditingId(null);
                        setFormData({});
                        setVeiculos([]);
                        setServicos([]);
                        setActiveTab('DADOS');
                        setIsModalOpen(true);
                    }}>Novo Cliente</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientes.map(c => (
                    <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => handleEdit(c)}>
                        <h3 className="font-bold text-slate-800">{c.nome}</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">{c.cpf} • {c.telefone}</p>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Cliente" : "Novo Cliente"}>
                <div className="flex space-x-2 mb-4 border-b pb-2">
                    <button onClick={() => setActiveTab('DADOS')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'DADOS' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>Dados Pessoais</button>
                    <button disabled={!editingId} onClick={() => setActiveTab('VEICULOS')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'VEICULOS' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 disabled:opacity-50'}`}>Veículos</button>
                    <button disabled={!editingId} onClick={() => setActiveTab('SERVICOS')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'SERVICOS' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 disabled:opacity-50'}`}>Financeiro/Serviços</button>
                    <button disabled={!editingId} onClick={() => setActiveTab('INFRACOES')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'INFRACOES' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 disabled:opacity-50'}`}>Infrações</button>
                </div>

                {activeTab === 'DADOS' && (
                    <div className="space-y-3">
                        <Input label="Nome Completo" value={formData.nome || ''} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="CPF" value={formData.cpf || ''} onChange={e => setFormData({ ...formData, cpf: e.target.value })} />
                            <Input label="RG" value={formData.rg || ''} onChange={e => setFormData({ ...formData, rg: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Nacionalidade" value={formData.nacionalidade || ''} onChange={e => setFormData({ ...formData, nacionalidade: e.target.value })} />
                            <Input label="Estado Civil" value={formData.estado_civil || ''} onChange={e => setFormData({ ...formData, estado_civil: e.target.value })} />
                        </div>
                        <Input label="Profissão" value={formData.profissao || ''} onChange={e => setFormData({ ...formData, profissao: e.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Telefone" value={formData.telefone || ''} onChange={e => setFormData({ ...formData, telefone: e.target.value })} />
                            <Input label="CEP" value={formData.cep || ''} onChange={e => setFormData({ ...formData, cep: e.target.value })} />
                        </div>
                        <Input label="Endereço Completo" value={formData.endereco || ''} onChange={e => setFormData({ ...formData, endereco: e.target.value })} />

                        <div className="mt-4 flex justify-between items-center">
                            {editingId && (
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleDeleteCliente}
                                        className="text-rose-500 text-sm font-bold hover:text-rose-700 underline"
                                    >
                                        Excluir Cliente
                                    </button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            if (formData.nome && formData.cpf) {
                                                try {
                                                    await generateProcuracaoPDF(formData as any);
                                                } catch (err: any) {
                                                    console.error(err);
                                                    alert("Erro ao gerar PDF: " + (err.message || err));
                                                }
                                            } else {
                                                alert("Preencha Nome e CPF.");
                                            }
                                        }}
                                    >
                                        📄 Procuração
                                    </Button>
                                </div>
                            )}
                            <Button variant="primary" onClick={handleSaveCliente}>Salvar Dados</Button>
                        </div>
                    </div>
                )}

                {activeTab === 'VEICULOS' && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <h4 className="text-xs font-black text-slate-500 uppercase mb-2">Adicionar Veículo</h4>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Select label="Vínculo" value={newVeiculo.tipo_vinculo} onChange={e => setNewVeiculo({ ...newVeiculo, tipo_vinculo: e.target.value as any })}>
                                    <option value="PROPRIETARIO">Proprietário</option>
                                    <option value="CONDUTOR">Condutor</option>
                                </Select>
                                <Input label="Placa" value={newVeiculo.placa || ''} onChange={e => setNewVeiculo({ ...newVeiculo, placa: e.target.value?.toUpperCase() })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input label="Marca" value={newVeiculo.marca || ''} onChange={e => setNewVeiculo({ ...newVeiculo, marca: e.target.value })} />
                                <Input label="Modelo" value={newVeiculo.modelo || ''} onChange={e => setNewVeiculo({ ...newVeiculo, modelo: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input label="Renavam" value={newVeiculo.renavam || ''} onChange={e => setNewVeiculo({ ...newVeiculo, renavam: e.target.value })} />
                                <Input label="Chassi" value={newVeiculo.chassi || ''} onChange={e => setNewVeiculo({ ...newVeiculo, chassi: e.target.value })} />
                            </div>
                            <Button size="sm" onClick={handleAddVeiculo}>Adicionar Veículo</Button>
                        </div>

                        <div className="space-y-2">
                            {veiculos.map(v => (
                                <div key={v.id} className="flex justify-between items-center p-2 bg-white border rounded">
                                    <div>
                                        <p className="font-bold text-sm">{v.placa} - {v.modelo}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{v.tipo_vinculo}</p>
                                    </div>
                                    <button onClick={() => handleDeleteVeiculo(v.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">EXCLUIR</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'SERVICOS' && (
                    <div className="space-y-4">
                        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                            <h4 className="text-xs font-black text-emerald-600 uppercase mb-2">Novo Contrato de Serviço</h4>
                            <Input label="Descrição do Serviço" value={newServico.descricao_servico || ''} onChange={e => setNewServico({ ...newServico, descricao_servico: e.target.value })} />

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <Select label="Veículo (Opcional)" value={newServico.veiculo_id || ''} onChange={e => setNewServico({ ...newServico, veiculo_id: e.target.value })}>
                                    <option value="">Nenhum / Geral</option>
                                    {veiculos.map(v => (
                                        <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                                    ))}
                                </Select>
                                <Input label="Data Contratação" type="date" value={newServico.data_contratacao || ''} onChange={e => setNewServico({ ...newServico, data_contratacao: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-2">
                                <Input label="Valor Total" type="number" value={newServico.valor_total || 0} onChange={e => setNewServico({ ...newServico, valor_total: Number(e.target.value) })} />
                                <Input label="Valor Pago" type="number" value={newServico.valor_pago || 0} onChange={e => setNewServico({ ...newServico, valor_pago: Number(e.target.value) })} />
                                <Select label="Status" value={newServico.status_pagamento || 'PENDENTE'} onChange={e => setNewServico({ ...newServico, status_pagamento: e.target.value as any })}>
                                    <option value="PENDENTE">Pendente</option>
                                    <option value="PARCIAL">Parcial</option>
                                    <option value="PAGO">Pago</option>
                                </Select>
                            </div>

                            <div className="mt-3 text-right">
                                <Button size="sm" onClick={handleAddServico}>Adicionar Serviço</Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {servicos.map(s => (
                                <div key={s.id} className="flex justify-between items-center p-2 bg-white border rounded">
                                    <div>
                                        <p className="font-bold text-sm">{s.descricao_servico}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">
                                            {s.data_contratacao} • Total: R${s.valor_total?.toFixed(2)} • Pago: R${s.valor_pago?.toFixed(2)} • Status: {s.status_pagamento}
                                            {s.veiculo_id && ` • Veículo: ${veiculos.find(v => v.id === s.veiculo_id)?.placa || 'N/A'}`}
                                        </p>
                                    </div>
                                    <button onClick={() => handleDeleteServico(s.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">EXCLUIR</button>
                                </div>
                            ))}
                            {servicos.length === 0 && (
                                <p className="text-center text-sm text-slate-500">Nenhum serviço cadastrado para este cliente.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'INFRACOES' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                            <h4 className="text-xs font-black text-amber-600 uppercase mb-2">Nova Infração</h4>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input
                                    label="Número do Auto *"
                                    value={newInfracao.numeroAuto || ''}
                                    onChange={e => setNewInfracao({ ...newInfracao, numeroAuto: e.target.value })}
                                />
                                <Input
                                    label="Data da Infração *"
                                    type="date"
                                    value={newInfracao.dataInfracao || ''}
                                    onChange={e => setNewInfracao({ ...newInfracao, dataInfracao: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Select
                                    label="Veículo (Opcional)"
                                    value={newInfracao.veiculo_id || ''}
                                    onChange={e => {
                                        const veiculoId = e.target.value;
                                        const veiculo = veiculos.find(v => v.id === veiculoId);
                                        setNewInfracao({
                                            ...newInfracao,
                                            veiculo_id: veiculoId,
                                            placa: veiculo ? veiculo.placa : newInfracao.placa || ''
                                        });
                                    }}
                                >
                                    <option value="">Nenhum / Geral</option>
                                    {veiculos.map(v => (
                                        <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                                    ))}
                                </Select>
                                <Input
                                    label="Placa"
                                    value={newInfracao.placa || ''}
                                    onChange={e => setNewInfracao({ ...newInfracao, placa: e.target.value.toUpperCase() })}
                                    placeholder="ABC-1234"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input
                                    label="Órgão Responsável"
                                    value={newInfracao.orgao_responsavel || ''}
                                    onChange={e => setNewInfracao({ ...newInfracao, orgao_responsavel: e.target.value })}
                                    placeholder="Ex: DER/MG, PRF"
                                />
                                <Input
                                    label="Data Limite Protocolo *"
                                    type="date"
                                    value={newInfracao.dataLimiteProtocolo || ''}
                                    onChange={e => setNewInfracao({ ...newInfracao, dataLimiteProtocolo: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Select
                                    label="Fase Recursal"
                                    value={newInfracao.faseRecursal || FaseRecursal.DEFESA_PREVIA}
                                    onChange={e => setNewInfracao({ ...newInfracao, faseRecursal: e.target.value as FaseRecursal })}
                                >
                                    <option value={FaseRecursal.DEFESA_PREVIA}>Defesa Prévia</option>
                                    <option value={FaseRecursal.PRIMEIRA_INSTANCIA}>1ª Instância (JARI)</option>
                                    <option value={FaseRecursal.SEGUNDA_INSTANCIA}>2ª Instância (CETRAN)</option>
                                </Select>
                                <Select
                                    label="Status"
                                    value={newInfracao.status || StatusInfracao.RECURSO_A_FAZER}
                                    onChange={e => setNewInfracao({ ...newInfracao, status: e.target.value as StatusInfracao })}
                                >
                                    <option value={StatusInfracao.RECURSO_A_FAZER}>Recurso a Fazer</option>
                                    <option value={StatusInfracao.EM_JULGAMENTO}>Em Julgamento</option>
                                    <option value={StatusInfracao.DEFERIDO}>Deferido</option>
                                    <option value={StatusInfracao.INDEFERIDO}>Indeferido</option>
                                </Select>
                            </div>

                            <Textarea
                                label="Descrição"
                                value={newInfracao.descricao || ''}
                                onChange={e => setNewInfracao({ ...newInfracao, descricao: e.target.value })}
                                rows={2}
                                placeholder="Ex: Excesso de velocidade..."
                            />

                            <div className="mt-3 text-right">
                                <Button size="sm" onClick={handleAddInfracao}>Adicionar Infração</Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {infracoes.map(inf => (
                                <div key={inf.id} className="flex justify-between items-center p-2 bg-white border rounded">
                                    <div>
                                        <p className="font-bold text-sm">{inf.numeroAuto} - {inf.placa}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">
                                            {new Date(inf.dataInfracao).toLocaleDateString('pt-BR')} •
                                            {inf.faseRecursal.replace('_', ' ')} •
                                            Status: {inf.status.replace('_', ' ')}
                                        </p>
                                        {inf.descricao && <p className="text-xs text-slate-600 mt-1">{inf.descricao}</p>}
                                    </div>
                                    <button onClick={() => handleDeleteInfracao(inf.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">EXCLUIR</button>
                                </div>
                            ))}
                            {infracoes.length === 0 && (
                                <p className="text-center text-sm text-slate-500">Nenhuma infração cadastrada para este cliente.</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Clientes;
