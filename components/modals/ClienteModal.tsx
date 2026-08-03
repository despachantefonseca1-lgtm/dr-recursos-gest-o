import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { RecursoCliente, RecursoVeiculo, RecursoServico, Infracao, FaseRecursal, StatusInfracao, User } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { generateProcuracaoPDF } from '../../services/pdfService';
import { useGlobalModal } from '../../contexts/GlobalModalContext';
import { NotasPromissoriasSecao } from './NotaPromissoriaModal';

const getLocalDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const ClienteModal: React.FC = () => {
    const { clienteModal, closeClienteModal, openInfracaoModal } = useGlobalModal();
    const { isOpen, id: editingId, onSave } = clienteModal;

    const [activeTab, setActiveTab] = useState<'DADOS' | 'VEICULOS' | 'SERVICOS' | 'INFRACOES'>('DADOS');
    const [formData, setFormData] = useState<Partial<RecursoCliente>>({});
    const [veiculos, setVeiculos] = useState<RecursoVeiculo[]>([]);
    const [servicos, setServicos] = useState<RecursoServico[]>([]);
    const [infracoes, setInfracoes] = useState<Infracao[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [newVeiculo, setNewVeiculo] = useState<Partial<RecursoVeiculo>>({ tipo_vinculo: 'PROPRIETARIO' });
    const [newServico, setNewServico] = useState<Partial<RecursoServico>>({ status_pagamento: 'PENDENTE' });

    // Seleção em massa de infrações
    const [modoSelecaoInfracoes, setModoSelecaoInfracoes] = useState(false);
    const [infracoesSelecionadas, setInfracoesSelecionadas] = useState<Set<string>>(new Set());

    // Modal de protocolo
    const [protocoloModalOpen, setProtocoloModalOpen] = useState(false);
    const [protocoloTargetIds, setProtocoloTargetIds] = useState<string[]>([]);
    const [protocoloData, setProtocoloData] = useState('');
    const [isProtocolando, setIsProtocolando] = useState(false);

    const [viewingVeiculoId, setViewingVeiculoId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const copyToClipboard = (value: string, fieldKey: string) => {
        if (!value) return;
        navigator.clipboard.writeText(value).then(() => {
            setCopiedField(fieldKey);
            setTimeout(() => setCopiedField(null), 1500);
        });
    };

    const [editingServicoId, setEditingServicoId] = useState<string | null>(null);
    const [isEditServicoModalOpen, setIsEditServicoModalOpen] = useState(false);
    const [editingServicoData, setEditingServicoData] = useState<Partial<RecursoServico>>({});

    const [selectedVeiculo, setSelectedVeiculo] = useState<RecursoVeiculo | null>(null);
    const [isVeiculoModalOpen, setIsVeiculoModalOpen] = useState(false);

    // Track internal editing ID if we are creating a new client and save it
    const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setActiveTab('DADOS');
        if (editingId) {
            setCurrentEditingId(editingId);
            loadClienteData(editingId);
        } else {
            setCurrentEditingId(null);
            setFormData({});
            setVeiculos([]);
            setServicos([]);
            setInfracoes([]);
        }
    }, [isOpen, editingId]);

    const loadClienteData = async (id: string) => {
        try {
            const [clientes, v, allServicos, allInfracoes, users] = await Promise.all([
                api.getRecursosClientes(),
                api.getRecursosVeiculos(id),
                api.getRecursosServicos(),
                api.getInfracoes(),
                api.getUsers()
            ]);
            const cliente = clientes.find(c => c.id === id);
            if (cliente) setFormData(cliente);
            setVeiculos(v);
            setServicos(allServicos.filter(s => s.cliente_id === id));
            setInfracoes(allInfracoes.filter(inf => inf.cliente_id === id));
            setUsersList(users);
        } catch (e) {
            console.error("Erro ao carregar dados do cliente", e);
        }
    };

    const handleSaveCliente = async () => {
        try {
            if (currentEditingId) {
                await api.updateRecursoCliente(currentEditingId, formData);
                alert("Dados do cliente atualizados!");
            } else {
                const newEx = await api.createRecursoCliente(formData as any);
                setCurrentEditingId(newEx.id);
                alert("Cliente salvo! Agora você pode adicionar veículos, serviços financeiros e infrações.");
            }
            if (onSave) onSave();
        } catch (error) {
            alert("Erro ao salvar cliente.");
        }
    };

    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        let cep = e.target.value.replace(/\D/g, '');
        if (cep.length > 8) cep = cep.slice(0, 8);
        
        let displayCep = cep;
        if (cep.length > 5) {
            displayCep = `${cep.slice(0, 5)}-${cep.slice(5)}`;
        }

        setFormData(prev => ({ ...prev, cep: displayCep }));

        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    setFormData(prev => ({
                        ...prev,
                        logradouro: data.logradouro || prev.logradouro,
                        bairro: data.bairro || prev.bairro,
                        cidade: data.localidade || prev.cidade,
                        uf: data.uf || prev.uf
                    }));
                }
            } catch (err) {
                console.error("Erro ao buscar CEP", err);
            }
        }
    };

    const handleAddVeiculo = async () => {
        if (!currentEditingId) return;
        try {
            await api.createRecursoVeiculo({ ...newVeiculo, cliente_id: currentEditingId } as any);
            setVeiculos(await api.getRecursosVeiculos(currentEditingId));
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
            if (currentEditingId) setVeiculos(await api.getRecursosVeiculos(currentEditingId));
            alert('Veículo excluído com sucesso!');
        } catch (error: any) {
            alert('Erro ao excluir veículo: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleAddServico = async () => {
        if (!currentEditingId) return;
        if (!newServico.descricao_servico?.trim()) {
            alert("A descrição do serviço é obrigatória.");
            return;
        }

        try {
            const pendente = (newServico.valor_total || 0) - (newServico.valor_pago || 0);
            const payload = {
                ...newServico,
                cliente_id: currentEditingId,
                veiculo_id: newServico.veiculo_id || undefined,
                data_contratacao: newServico.data_contratacao || getLocalDateString(),
                valor_pendente: pendente,
                status_pagamento: pendente <= 0 ? 'PAGO' : newServico.status_pagamento
            };

            await api.createRecursoServico(payload as any);
            const all = await api.getRecursosServicos();
            setServicos(all.filter(s => s.cliente_id === currentEditingId));
            setNewServico({ status_pagamento: 'PENDENTE', valor_total: 0, valor_pago: 0, descricao_servico: '' });
            alert("Serviço adicionado com sucesso!");
        } catch (error: any) {
            alert(`Erro ao adicionar serviço: ${error.message || JSON.stringify(error)}`);
        }
    };

    const handleDeleteServico = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
        try {
            await api.deleteRecursoServico(id);
            if (currentEditingId) {
                const all = await api.getRecursosServicos();
                setServicos(all.filter(s => s.cliente_id === currentEditingId));
            }
            alert('Serviço excluído com sucesso!');
        } catch (error: any) {
            alert('Erro ao excluir serviço: ' + (error.message || 'Erro desconhecido'));
        }
    };



    const handleDeleteInfracao = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta infração?')) return;
        try {
            await api.deleteInfracao(id);
            if (currentEditingId) {
                const allInfracoes = await api.getInfracoes();
                setInfracoes(allInfracoes.filter(inf => inf.cliente_id === currentEditingId));
            }
            alert('Infração excluída com sucesso!');
            if (onSave) onSave();
        } catch (error: any) {
            alert('Erro ao excluir infração: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleDeleteCliente = async () => {
        if (!currentEditingId) return;
        if (!confirm("TEM CERTEZA? Ao excluir o cliente, todos os veículos e serviços associados também serão removidos permanentemente.")) return;

        try {
            await api.deleteRecursoCliente(currentEditingId);
            closeClienteModal();
            if (onSave) onSave();
            alert("Cliente excluído com sucesso.");
        } catch (error: any) {
            alert('Erro ao excluir cliente: ' + (error.message || 'Erro desconhecido.'));
        }
    };

    const handleEditServico = (servico: RecursoServico) => {
        setEditingServicoId(servico.id);
        setEditingServicoData({
            valor_total: servico.valor_total,
            valor_pago: servico.valor_pago,
            status_pagamento: servico.status_pagamento
        });
        setIsEditServicoModalOpen(true);
    };

    const handleUpdateServicoFinanceiro = async () => {
        if (!editingServicoId) return;

        try {
            const valorTotal = editingServicoData.valor_total || 0;
            const valorPago = editingServicoData.valor_pago || 0;
            const valorPendente = valorTotal - valorPago;

            let status = editingServicoData.status_pagamento;
            if (valorPendente <= 0) {
                status = 'PAGO';
            } else if (valorPago > 0) {
                status = 'PARCIAL';
            } else {
                status = 'PENDENTE';
            }

            await api.updateRecursoServico(editingServicoId, {
                valor_total: valorTotal,
                valor_pago: valorPago,
                valor_pendente: valorPendente,
                status_pagamento: status
            });

            if (currentEditingId) {
                const all = await api.getRecursosServicos();
                setServicos(all.filter(s => s.cliente_id === currentEditingId));
            }

            setIsEditServicoModalOpen(false);
            setEditingServicoId(null);
            setEditingServicoData({});
            alert("Financeiro atualizado com sucesso!");
        } catch (error: any) {
            alert(`Erro ao atualizar: ${error.message || JSON.stringify(error)}`);
        }
    };

    // --- Protocolar ---
    const getLocalDate = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    };

    const abrirProtocolo = (ids: string[]) => {
        setProtocoloTargetIds(ids);
        setProtocoloData(getLocalDate());
        setProtocoloModalOpen(true);
    };

    const handleConfirmarProtocolo = async () => {
        if (!protocoloData) { alert('Selecione a data de protocolo.'); return; }
        try {
            setIsProtocolando(true);
            await api.protocolarInfracoesEmMassa(protocoloTargetIds, protocoloData);
            setProtocoloModalOpen(false);
            setModoSelecaoInfracoes(false);
            setInfracoesSelecionadas(new Set());
            if (currentEditingId) await loadClienteData(currentEditingId);
            if (onSave) onSave();
            alert(`${protocoloTargetIds.length} infração(ões) protocolada(s) com sucesso!`);
        } catch (error: any) {
            alert('Erro ao protocolar: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsProtocolando(false);
        }
    };

    const toggleSelecaoInfracao = (id: string) => {
        setInfracoesSelecionadas(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <>
            <Modal isOpen={isOpen} onClose={closeClienteModal} title={currentEditingId ? "Editar Cliente" : "Novo Cliente"}>
                <div className="flex space-x-2 mb-4 border-b pb-2">
                    <button onClick={() => setActiveTab('DADOS')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'DADOS' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>Dados Pessoais</button>
                    <button disabled={!currentEditingId} onClick={() => setActiveTab('VEICULOS')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'VEICULOS' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 disabled:opacity-50'}`}>Veículos</button>
                    <button disabled={!currentEditingId} onClick={() => setActiveTab('SERVICOS')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'SERVICOS' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 disabled:opacity-50'}`}>Financeiro/Serviços</button>
                    <button disabled={!currentEditingId} onClick={() => setActiveTab('INFRACOES')} className={`px-3 py-1 text-sm font-bold rounded ${activeTab === 'INFRACOES' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 disabled:opacity-50'}`}>Infrações</button>
                </div>

                {activeTab === 'DADOS' && (
                    <div className="space-y-3">
                        <Input label="Nome Completo *" required value={formData.nome || ''} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
                        <Input label="CPF *" required value={formData.cpf || ''} onChange={e => setFormData({ ...formData, cpf: e.target.value })} />
                        <div className="grid grid-cols-3 gap-3">
                            <Input label="RG (Opcional)" value={formData.rg || ''} onChange={e => setFormData({ ...formData, rg: e.target.value })} />
                            <Input label="Órgão Emissor (Opcional)" value={formData.rg_orgao_emissor || ''} onChange={e => setFormData({ ...formData, rg_orgao_emissor: e.target.value?.toUpperCase() })} placeholder="SSP, PC, IFP..." />
                            <Select label="UF do RG (Opcional)" value={formData.rg_uf || ''} onChange={e => setFormData({ ...formData, rg_uf: e.target.value })}>
                                <option value="">Selecione</option>
                                <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option><option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option><option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option><option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option><option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option><option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option><option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option><option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option><option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Nacionalidade *" required value={formData.nacionalidade || ''} onChange={e => setFormData({ ...formData, nacionalidade: e.target.value })} />
                            <Input label="Estado Civil *" required value={formData.estado_civil || ''} onChange={e => setFormData({ ...formData, estado_civil: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Profissão *" required value={formData.profissao || ''} onChange={e => setFormData({ ...formData, profissao: e.target.value })} />
                            <Input label="Telefone *" required value={formData.telefone || ''} onChange={e => setFormData({ ...formData, telefone: e.target.value })} />
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                            <h4 className="text-xs font-black text-slate-500 uppercase mb-2">Endereço</h4>
                            <div className="grid grid-cols-5 gap-3 mb-3">
                                <div className="col-span-1">
                                    <Input label="CEP *" required value={formData.cep || ''} onChange={handleCepChange} placeholder="00000-000" />
                                </div>
                                <div className="col-span-3">
                                    <Input label="Logradouro *" required value={formData.logradouro || ''} onChange={e => setFormData({ ...formData, logradouro: e.target.value })} placeholder="Rua, Avenida..." />
                                </div>
                                <div className="col-span-1">
                                    <Input label="Número *" required value={formData.numero || ''} onChange={e => setFormData({ ...formData, numero: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <Input label="Bairro *" required value={formData.bairro || ''} onChange={e => setFormData({ ...formData, bairro: e.target.value })} />
                                <Input label="Cidade *" required value={formData.cidade || ''} onChange={e => setFormData({ ...formData, cidade: e.target.value })} />
                                <Select label="UF *" required value={formData.uf || ''} onChange={e => setFormData({ ...formData, uf: e.target.value })}>
                                    <option value="">Selecione</option>
                                    <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option><option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option><option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option><option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option><option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option><option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option><option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option><option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option><option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
                                </Select>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-between items-center">
                            {currentEditingId && (
                                <div className="flex items-center gap-4">
                                    <button onClick={handleDeleteCliente} className="text-rose-500 text-sm font-bold hover:text-rose-700 underline">
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
                                <Input label="Marca" value={newVeiculo.marca || ''} onChange={e => setNewVeiculo({ ...newVeiculo, marca: e.target.value?.toUpperCase() })} />
                                <Input label="Modelo" value={newVeiculo.modelo || ''} onChange={e => setNewVeiculo({ ...newVeiculo, modelo: e.target.value?.toUpperCase() })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Input label="Renavam" value={newVeiculo.renavam || ''} onChange={e => setNewVeiculo({ ...newVeiculo, renavam: e.target.value?.toUpperCase() })} />
                                <Input label="Chassi" value={newVeiculo.chassi || ''} onChange={e => setNewVeiculo({ ...newVeiculo, chassi: e.target.value?.toUpperCase() })} />
                            </div>
                            <Button size="sm" onClick={handleAddVeiculo}>Adicionar Veículo</Button>
                        </div>

                        <div className="space-y-2">
                            {veiculos.map(v => (
                                <div key={v.id} className="bg-white border rounded overflow-hidden">
                                    <div className="flex justify-between items-center p-2">
                                        <div>
                                            <p className="font-bold text-sm">{v.placa} - {v.modelo}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">{v.tipo_vinculo}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setViewingVeiculoId(viewingVeiculoId === v.id ? null : v.id)}
                                                className="text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                                            >
                                                {viewingVeiculoId === v.id ? 'FECHAR' : 'VER'}
                                            </button>
                                            <button onClick={() => handleDeleteVeiculo(v.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">EXCLUIR</button>
                                        </div>
                                    </div>

                                    {viewingVeiculoId === v.id && (
                                        <div className="border-t border-slate-100 bg-indigo-50 px-3 py-2">
                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Clique em qualquer dado para copiar</p>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {[
                                                    { label: 'Placa', value: v.placa, key: `placa-${v.id}` },
                                                    { label: 'Vínculo', value: v.tipo_vinculo, key: `vinculo-${v.id}` },
                                                    { label: 'Marca', value: v.marca, key: `marca-${v.id}` },
                                                    { label: 'Modelo', value: v.modelo, key: `modelo-${v.id}` },
                                                    { label: 'Renavam', value: v.renavam, key: `renavam-${v.id}` },
                                                    { label: 'Chassi', value: v.chassi, key: `chassi-${v.id}` },
                                                ].map(({ label, value, key }) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => copyToClipboard(value || '', key)}
                                                        title={`Copiar ${label}`}
                                                        className={`text-left px-2 py-1.5 rounded transition-all ${
                                                            copiedField === key
                                                                ? 'bg-emerald-100 border border-emerald-300'
                                                                : 'bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                                                        }`}
                                                    >
                                                        <span className="block text-[9px] font-black text-slate-400 uppercase">{label}</span>
                                                        <span className={`block text-xs font-bold ${
                                                            copiedField === key ? 'text-emerald-700' : 'text-slate-700'
                                                        }`}>
                                                            {copiedField === key ? '✓ Copiado!' : (value || '—')}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'SERVICOS' && (
                    <div className="space-y-4">
                        {/* Seção de Notas Promissórias */}
                        {currentEditingId && formData && (
                            <NotasPromissoriasSecao
                                clienteId={currentEditingId}
                                cliente={formData as any}
                            />
                        )}

                        <hr className="border-slate-200" />

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
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditServico(s)} className="text-indigo-600 hover:text-indigo-700 text-xs font-bold">EDITAR</button>
                                        <button onClick={() => handleDeleteServico(s.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">EXCLUIR</button>
                                    </div>
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
                        {/* Header da aba */}
                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Gerenciar Infrações</h4>
                                <p className="text-xs text-slate-500">Cadastre e acompanhe as infrações vinculadas a este cliente.</p>
                            </div>
                            <div className="flex gap-2">
                                {infracoes.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setModoSelecaoInfracoes(!modoSelecaoInfracoes); setInfracoesSelecionadas(new Set()); }}
                                        className={`border ${modoSelecaoInfracoes ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}
                                    >
                                        {modoSelecaoInfracoes ? '✕ Cancelar' : '☑️ Selecionar'}
                                    </Button>
                                )}
                                <Button variant="primary" size="sm"
                                    onClick={() => openInfracaoModal(null, { clienteId: currentEditingId || undefined, onSave: () => currentEditingId && loadClienteData(currentEditingId) })}
                                    icon="➕"
                                >
                                    Nova Infração
                                </Button>
                            </div>
                        </div>

                        {/* Barra seleção em massa */}
                        {modoSelecaoInfracoes && (
                            <div className="flex items-center justify-between bg-indigo-700 text-white px-4 py-2.5 rounded-xl shadow-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black uppercase tracking-wider">☑️ {infracoesSelecionadas.size} selecionada(s)</span>
                                    <button onClick={() => setInfracoesSelecionadas(new Set(infracoes.map(i => i.id)))} className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition-colors uppercase">Todas</button>
                                    <button onClick={() => setInfracoesSelecionadas(new Set())} className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition-colors uppercase">Nenhuma</button>
                                </div>
                                <button
                                    disabled={infracoesSelecionadas.size === 0}
                                    onClick={() => abrirProtocolo([...infracoesSelecionadas])}
                                    className="flex items-center gap-1.5 text-xs font-black bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
                                >
                                    📌 Protocolar {infracoesSelecionadas.size > 0 ? `(${infracoesSelecionadas.size})` : ''}
                                </button>
                            </div>
                        )}

                        {/* Lista de infrações */}
                        <div className="space-y-2">
                            {infracoes.map(inf => {
                                const responsavel = usersList.find(u => u.id === inf.usuario_id);
                                const isSelecionada = infracoesSelecionadas.has(inf.id);
                                return (
                                    <div
                                        key={inf.id}
                                        className={`bg-white border rounded-xl overflow-hidden transition-all ${
                                            modoSelecaoInfracoes && isSelecionada ? 'border-indigo-400 ring-1 ring-indigo-300 bg-indigo-50/30'
                                            : modoSelecaoInfracoes ? 'border-slate-200 hover:border-indigo-300 cursor-pointer'
                                            : 'border-slate-200'
                                        }`}
                                        onClick={modoSelecaoInfracoes ? () => toggleSelecaoInfracao(inf.id) : undefined}
                                    >
                                        <div className="flex justify-between items-start p-3">
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                {modoSelecaoInfracoes && (
                                                    <div
                                                        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                            isSelecionada ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                                                        }`}
                                                        onClick={e => { e.stopPropagation(); toggleSelecaoInfracao(inf.id); }}
                                                    >
                                                        {isSelecionada && (
                                                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm">{inf.numeroAuto} - {inf.placa}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase">
                                                        {formatDateString(inf.dataInfracao)} • {inf.faseRecursal.replace('_', ' ')} • Status: {inf.status.replace(/_/g, ' ')}
                                                        {inf.dataProtocolo && ` • Prot: ${formatDateString(inf.dataProtocolo)}`}
                                                    </p>
                                                    {inf.descricao && <p className="text-xs text-slate-600 mt-0.5 truncate">{inf.descricao}</p>}
                                                    {responsavel && (
                                                        <div className="mt-1.5 flex items-center gap-1.5">
                                                            <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px] font-black flex-shrink-0">
                                                                {responsavel.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wide">👤 {responsavel.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {!modoSelecaoInfracoes && (
                                                <div className="flex gap-2 flex-shrink-0 ml-2">
                                                    <button onClick={() => abrirProtocolo([inf.id])} className="text-amber-600 hover:text-amber-800 text-[10px] font-black uppercase tracking-wide bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors">
                                                        📌 Protocolar
                                                    </button>
                                                    <button onClick={() => openInfracaoModal(inf.id, { onSave: () => { if (currentEditingId) loadClienteData(currentEditingId); } })} className="text-indigo-600 hover:text-indigo-700 text-xs font-bold">EDITAR</button>
                                                    <button onClick={() => handleDeleteInfracao(inf.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">EXCLUIR</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {infracoes.length === 0 && (
                                <p className="text-center text-sm text-slate-500">Nenhuma infração cadastrada para este cliente.</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal de Protocolo */}
            <Modal isOpen={protocoloModalOpen} onClose={() => setProtocoloModalOpen(false)} title="📌 Registrar Protocolo">
                <div className="space-y-5">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <p className="text-sm font-bold text-amber-800 text-center">
                            {protocoloTargetIds.length === 1 ? 'Registrar o protocolo desta infração.' : `Registrar o protocolo de ${protocoloTargetIds.length} infrações em massa.`}
                        </p>
                        <p className="text-xs text-amber-600 text-center mt-1">O status será alterado para <strong>Pendente de Comprovante</strong>.</p>
                    </div>
                    <Input label="Data do Protocolo" type="date" value={protocoloData} onChange={e => setProtocoloData(e.target.value)} />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setProtocoloModalOpen(false)}>Cancelar</Button>
                        <Button variant="ghost" onClick={handleConfirmarProtocolo} disabled={isProtocolando || !protocoloData}
                            className="border border-amber-300 bg-amber-500 text-white hover:bg-amber-600 font-bold px-8">
                            {isProtocolando ? '⏳ Registrando...' : '📌 Confirmar Protocolo'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isEditServicoModalOpen} onClose={() => setIsEditServicoModalOpen(false)} title="Atualizar Financeiro">
                <div className="space-y-3">
                    <Input label="Valor Total (R$)" type="number" value={editingServicoData.valor_total || 0} onChange={e => setEditingServicoData({ ...editingServicoData, valor_total: Number(e.target.value) })} />
                    <Input label="Valor Pago (R$)" type="number" value={editingServicoData.valor_pago || 0} onChange={e => setEditingServicoData({ ...editingServicoData, valor_pago: Number(e.target.value) })} />
                    <Select label="Status" value={editingServicoData.status_pagamento || 'PENDENTE'} onChange={e => setEditingServicoData({ ...editingServicoData, status_pagamento: e.target.value as any })}>
                        <option value="PENDENTE">Pendente</option>
                        <option value="PARCIAL">Parcial</option>
                        <option value="PAGO">Pago</option>
                    </Select>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsEditServicoModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateServicoFinanceiro}>Salvar Financeiro</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default ClienteModal;
