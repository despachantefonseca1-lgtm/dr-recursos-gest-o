import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { RecursoCliente } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useGlobalModal } from '../../contexts/GlobalModalContext';
import { useSearchParams } from 'react-router-dom';

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
<<<<<<< HEAD
    }, [searchParams, clientes, openClienteModal, setSearchParams]);
=======
    }, [searchParams, clientes]);

    const handleEdit = async (cliente: RecursoCliente) => {
        setEditingId(cliente.id);
        setFormData(cliente);
        setActiveTab('DADOS');

        // Load related data
        try {
            const v = await api.getRecursosVeiculos(cliente.id);
            setVeiculos(v);

            // Load services for this client
            const allServicos = await api.getRecursosServicos();
            const clienteServicos = allServicos.filter(s => s.cliente_id === cliente.id);
            setServicos(clienteServicos);

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
                alert("Dados do cliente atualizados!");
            } else {
                const newEx = await api.createRecursoCliente(formData as any);
                setEditingId(newEx.id); // Switch to edit mode to allow adding vehicles
                alert("Cliente salvo! Agora você pode adicionar veículos, serviços financeiros e infrações.");
            }
            loadClientes();
            // Mantém o modal aberto para continuar preenchendo veículo, financeiro e infrações
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

        if (newInfracao.placa && newInfracao.placa.length > 0 && newInfracao.placa.length < 7) {
            alert("A placa deve ter pelo menos 7 caracteres (ex: ABC1234 ou ABC-1234).");
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
                intervaloAcompanhamento: 0,
                ultimaVerificacao: newInfracao.status === StatusInfracao.EM_JULGAMENTO ? new Date().toISOString() : undefined
            } as Infracao);

            // Refresh infractions
            const allInfracoes = await api.getInfracoes();
            const clienteInfracoes = allInfracoes.filter(inf => inf.cliente_id === editingId);
            setInfracoes(clienteInfracoes);

            // Reset form mas mantém os dados comuns (órgão, datas) para facilitar cadastros simultâneos
            setNewInfracao({
                numeroAuto: '',
                placa: newInfracao.placa || '', // Mantém a placa
                dataInfracao: newInfracao.dataInfracao, // Mantém a data da infração
                descricao: '',
                orgao_responsavel: newInfracao.orgao_responsavel, // Mantém o órgão
                dataLimiteProtocolo: newInfracao.dataLimiteProtocolo, // Mantém a data limite
                faseRecursal: FaseRecursal.DEFESA_PREVIA,
                status: StatusInfracao.RECURSO_A_FAZER,
                observacoes: ''
            });

            alert("Infração adicionada com sucesso! Os campos órgão, data da infração e data limite foram mantidos para facilitar cadastros simultâneos.");
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

    const handleEditInfracao = (infracao: Infracao) => {
        setEditingInfracaoId(infracao.id);
        setEditingInfracaoData(infracao);
        setIsInfracaoModalOpen(true);
    };

    const handleUpdateInfracao = async () => {
        if (!editingInfracaoId) return;

        // Validation
        if (!editingInfracaoData.numeroAuto?.trim() || !editingInfracaoData.dataInfracao || !editingInfracaoData.dataLimiteProtocolo) {
            alert("Preencha os campos obrigatórios: Número do Auto, Data da Infração e Data Limite Protocolo.");
            return;
        }

        if (editingInfracaoData.placa && editingInfracaoData.placa.length > 0 && editingInfracaoData.placa.length < 7) {
            alert("A placa deve ter pelo menos 7 caracteres (ex: ABC1234 ou ABC-1234).");
            return;
        }

        try {
            await api.updateInfracao(editingInfracaoId, {
                ...editingInfracaoData,
                ultimaVerificacao: (editingInfracaoData.status === StatusInfracao.EM_JULGAMENTO && !editingInfracaoData.ultimaVerificacao) ? new Date().toISOString() : editingInfracaoData.ultimaVerificacao
            });

            // Refresh infractions
            if (editingId) {
                const allInfracoes = await api.getInfracoes();
                const clienteInfracoes = allInfracoes.filter(inf => inf.cliente_id === editingId);
                setInfracoes(clienteInfracoes);
            }

            setIsInfracaoModalOpen(false);
            setEditingInfracaoId(null);
            setEditingInfracaoData({});
            alert("Infração atualizada com sucesso!");
        } catch (error: any) {
            console.error("Erro ao atualizar infração:", error);
            alert(`Erro ao atualizar infração: ${error.message || JSON.stringify(error)}`);
        }
    };

    const generateHeader = () => {
        if (!editingId || !editingInfracaoData.veiculo_id) {
            alert("Selecione um veículo para gerar o cabeçalho.");
            return;
        }

        const cliente = formData;
        const veiculo = veiculos.find(v => v.id === editingInfracaoData.veiculo_id);

        if (!veiculo) {
            alert("Veículo não encontrado.");
            return;
        }

        const orgao = editingInfracaoData.orgao_responsavel ? editingInfracaoData.orgao_responsavel.toUpperCase() : "SECRETARIA DE TRÂNSITO/MG";
        const auto = editingInfracaoData.numeroAuto ? editingInfracaoData.numeroAuto.toUpperCase() : "_________________";
        const descricao = editingInfracaoData.descricao || "XXXXXXXXXXXX";
        const rgCompleto = cliente.rg
            ? `${cliente.rg} ${cliente.rg_orgao_emissor || 'SSP'} ${cliente.rg_uf || 'MG'}`
            : 'N/I';

        const text = `AO ILMOS. SENHORES MEMBROS JULGADORES DA ${orgao}.

AUTO DE INFRAÇÃO SOB O Nº ${auto}.

${cliente.nome}, ${cliente.nacionalidade || 'brasileiro(a)'}, ${cliente.estado_civil || 'solteiro(a)'}, ${cliente.profissao || 'autônomo(a)'}, Inscrito CPF N°${cliente.cpf}, RG N°${rgCompleto}, Residente e Domiciliado ${cliente.endereco}, condutor do veículo ${veiculo.marca || ''}/${veiculo.modelo}, placa ${veiculo.placa}, RENAVAM ${veiculo.renavam || '___________'}, CHASSI ${veiculo.chassi || '_________________'}.

Vem por intermédio de seu advogado, com procuração em anexo, com endereço profissional á Avenida Das Palmeiras, N°512, Centro, Bom Despacho-MG, CEP 35.630-002, e endereço eletrônico ifadvogado214437@gmail.com, muito respeitosamente à presença de vossos senhores apresentar; defesa, baseado na Lei nº 9.503 de 23/09/97 sobre a acusação de ${descricao}.`;

        setHeaderContent(text);
        setIsHeaderModalOpen(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(headerContent);
        alert("Texto copiado!");
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

            // Automatically set status to PAGO if fully paid
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

            // Refresh services list
            if (editingId) {
                const all = await api.getRecursosServicos();
                setServicos(all.filter(s => s.cliente_id === editingId));
            }

            setIsEditServicoModalOpen(false);
            setEditingServicoId(null);
            setEditingServicoData({});
            alert("Financeiro atualizado com sucesso!");
        } catch (error: any) {
            console.error("Erro ao atualizar financeiro:", error);
            alert(`Erro ao atualizar: ${error.message || JSON.stringify(error)}`);
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
>>>>>>> 38c4d7e (Atualizacoes no cadastro de clientes e infracoes)

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
                        const searchLower = clientSearchTerm.toLowerCase();
                        return (
                            c.nome.toLowerCase().includes(searchLower) ||
                            c.cpf.toLowerCase().includes(searchLower)
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
