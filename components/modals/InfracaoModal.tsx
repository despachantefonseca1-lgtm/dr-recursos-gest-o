import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Infracao, FaseRecursal, StatusInfracao, RecursoCliente, RecursoVeiculo, TeseRecurso, User, PrioridadeTarefa, StatusTarefa } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Modal } from '../ui/Modal';
import { useGlobalModal } from '../../contexts/GlobalModalContext';

const InfracaoModal: React.FC = () => {
    const { infracaoModal, closeInfracaoModal } = useGlobalModal();
    const { isOpen, id: editingId, numeroAuto: prefilledAuto, clienteId: prefilledClienteId, onSave } = infracaoModal;

    const [clientesList, setClientesList] = useState<RecursoCliente[]>([]);
    const [veiculosList, setVeiculosList] = useState<RecursoVeiculo[]>([]);
    const [tesesList, setTesesList] = useState<TeseRecurso[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);

    const [selectedTeses, setSelectedTeses] = useState<string[]>([]);
    const [isTesesModalOpen, setIsTesesModalOpen] = useState(false);
    const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
    const [headerContent, setHeaderContent] = useState('');
    const [isResponsavelModalOpen, setIsResponsavelModalOpen] = useState(false);

    const [orgaosOptions, setOrgaosOptions] = useState<string[]>([]);
    const [descricoesOptions, setDescricoesOptions] = useState<string[]>([]);

    const [formData, setFormData] = useState<Partial<Infracao>>({
        numeroAuto: '',
        placa: '',
        cliente_id: '',
        veiculo_id: '',
        usuario_id: '',
        orgao_responsavel: '',
        dataInfracao: '',
        dataLimiteProtocolo: '',
        dataProtocolo: '',
        faseRecursal: FaseRecursal.DEFESA_PREVIA,
        status: StatusInfracao.RECURSO_A_FAZER,
        acompanhamentoMensal: false,
        intervaloAcompanhamento: 15,
        descricao: '',
        observacoes: ''
    });

    useEffect(() => {
        if (!isOpen) return;

        const loadDepsAndInfracao = async () => {
            try {
                setClientesList(await api.getRecursosClientes());
                setTesesList(await api.getTeses());
                setUsersList(await api.getUsers());

                const infs = await api.getInfracoes();
                const uniqueOrgaos = Array.from(new Set(infs.map(i => i.orgao_responsavel?.trim()).filter(Boolean)));
                const uniqueDescricoes = Array.from(new Set(infs.map(i => i.descricao?.trim()).filter(Boolean)));
                
                setOrgaosOptions(uniqueOrgaos as string[]);
                setDescricoesOptions(uniqueDescricoes as string[]);

                if (editingId) {
                    const inf = infs.find(i => i.id === editingId);
                    if (inf) {
                        setFormData({
                            ...inf,
                            dataProtocolo: inf.dataProtocolo || ''
                        });
                        setSelectedTeses([]);
                    }
                } else {
                    setFormData({
                        numeroAuto: prefilledAuto || '',
                        placa: '',
                        cliente_id: prefilledClienteId || '',
                        veiculo_id: '',
                        usuario_id: '',
                        orgao_responsavel: '',
                        dataInfracao: '',
                        dataLimiteProtocolo: '',
                        dataProtocolo: '',
                        faseRecursal: FaseRecursal.DEFESA_PREVIA,
                        status: StatusInfracao.RECURSO_A_FAZER,
                        acompanhamentoMensal: false,
                        intervaloAcompanhamento: 0,
                        descricao: '',
                        observacoes: ''
                    });
                    setSelectedTeses([]);
                }
            } catch (error) {
                console.error(error);
            }
        };

        loadDepsAndInfracao();
    }, [isOpen, editingId, prefilledAuto, prefilledClienteId]);

    useEffect(() => {
        if (formData.cliente_id) {
            api.getRecursosVeiculos(formData.cliente_id).then(setVeiculosList);
        } else {
            setVeiculosList([]);
        }
    }, [formData.cliente_id]);

    const handleClienteChange = (clienteId: string) => {
        setFormData({ ...formData, cliente_id: clienteId, veiculo_id: '', placa: '' });
    };

    const handleVeiculoChange = (veiculoId: string) => {
        const veiculo = veiculosList.find(v => v.id === veiculoId);
        if (veiculo) {
            setFormData({ ...formData, veiculo_id: veiculoId, placa: veiculo.placa });
        }
    };

    const handlePlacaChange = (val: string) => {
        if (val.length > 8) return;
        setFormData({ ...formData, placa: val.toUpperCase() });
    };

    const handleAssignResponsavel = async (userId: string) => {
        const selectedUser = usersList.find(u => u.id === userId);
        if (!selectedUser) return;
        
        if (!editingId && !formData.numeroAuto) {
            alert("Por favor, preencha pelo menos o número do auto ou salve a infração antes de atribuir.");
            return;
        }

        const title = `Responsável por Infração: ${formData.numeroAuto || 'Nova Infração'}`;
        const desc = `Você foi apontado como responsável pela infração Auto: ${formData.numeroAuto || 'N/A'}, Placa: ${formData.placa || 'N/A'}. Órgão: ${formData.orgao_responsavel || 'N/A'}`;

        try {
            await api.createTarefa({
                titulo: title,
                descricao: desc,
                prioridade: PrioridadeTarefa.MEDIA,
                status: StatusTarefa.PENDENTE,
                atribuidaPara: userId,
                dataPrazo: formData.dataLimiteProtocolo || new Date().toISOString().split('T')[0],
                observacoes: 'Atribuído via painel de infrações.',
                atribuidaPorId: api.getCurrentUser()?.id || ''
            });
            
            setFormData(prev => ({ ...prev, usuario_id: userId }));
            if (editingId) {
                await api.updateInfracao(editingId, { usuario_id: userId });
            }
            
            alert(`Tarefa criada para ${selectedUser.name}!`);
            setIsResponsavelModalOpen(false);
            if (onSave) onSave();
        } catch (error: any) {
            alert("Erro ao criar tarefa: " + (error.message || 'Desconhecido'));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.placa && formData.placa.length > 0 && formData.placa.length < 7) {
            alert("A placa deve ter pelo menos 7 caracteres (ex: ABC1234 ou ABC-1234).");
            return;
        }

        try {
            let result;
            if (editingId) {
                result = await api.updateInfracao(editingId, {
                    ...formData,
                    dataProtocolo: formData.dataProtocolo || null,
                    ultimaVerificacao: (formData.status === StatusInfracao.EM_JULGAMENTO && !formData.ultimaVerificacao) ? new Date().toISOString() : formData.ultimaVerificacao
                } as any);
            } else {
                result = await api.createInfracao({
                    ...formData,
                    dataProtocolo: formData.dataProtocolo || null,
                    ultimaVerificacao: formData.status === StatusInfracao.EM_JULGAMENTO ? new Date().toISOString() : undefined
                } as any);
            }

            if (!result) {
                throw new Error("O servidor não retornou os dados salvos. Verifique sua conexão.");
            }

            alert("Infração salva com sucesso!");
            if (onSave) onSave();
            closeInfracaoModal();
        } catch (e: any) {
            console.error("Error saving infracao:", e);
            alert("Erro ao salvar: " + (e.message || e));
        }
    };

    const generateHeader = () => {
        if (!formData.cliente_id || !formData.veiculo_id) {
            alert("Selecione um Cliente e um Veículo para gerar o cabeçalho.");
            return;
        }

        const cliente = clientesList.find(c => c.id === formData.cliente_id);
        const veiculo = veiculosList.find(v => v.id === formData.veiculo_id);

        if (!cliente || !veiculo) {
            alert("Dados do cliente ou veículo não encontrados.");
            return;
        }

        const orgao = formData.orgao_responsavel ? formData.orgao_responsavel.toUpperCase() : "SECRETARIA DE TRÂNSITO/MG";
        const auto = formData.numeroAuto ? formData.numeroAuto.toUpperCase() : "_________________";
        const descricao = formData.descricao || "XXXXXXXXXXXX";
        const rgText = cliente.rg
            ? `, RG N°${cliente.rg} ${cliente.rg_orgao_emissor || ''} ${cliente.rg_uf || ''}`.trim()
            : '';
            
        const enderecoCompleto = cliente.logradouro
            ? `à ${cliente.logradouro}, nº ${cliente.numero}, Bairro ${cliente.bairro}, ${cliente.cidade}-${cliente.uf}, CEP ${cliente.cep}`
            : cliente.endereco || 'Endereço não informado';

        let text = `AO ILMOS. SENHORES MEMBROS JULGADORES DA ${orgao}.\n\nAUTO DE INFRAÇÃO SOB O Nº ${auto}.\n\n${cliente.nome}, ${cliente.nacionalidade || 'brasileiro(a)'}, ${cliente.estado_civil || 'solteiro(a)'}, ${cliente.profissao || 'autônomo(a)'}, Inscrito CPF N°${cliente.cpf}${rgText}, Residente e Domiciliado ${enderecoCompleto}, condutor do veículo ${veiculo.marca || ''}/${veiculo.modelo}, placa ${veiculo.placa}, RENAVAM ${veiculo.renavam || '___________'}, CHASSI ${veiculo.chassi || '_________________'}.\n\nVem por intermédio de seu advogado, com procuração em anexo, com endereço profissional á Avenida Das Palmeiras, N°512, Centro, Bom Despacho-MG, CEP 35.630-002, e endereço eletrônico ifadvogado214437@gmail.com, muito respeitosamente à presença de vossos senhores apresentar; defesa, baseado na Lei nº 9.503 de 23/09/97 sobre a acusação de ${descricao}.`;

        if (selectedTeses.length > 0) {
            const tesesSelecionadas = selectedTeses.map(id => tesesList.find(t => t.id === id)).filter(Boolean);
            text += `\n\nDO DIREITO:\n`;
            tesesSelecionadas.forEach((tese) => {
                if (tese) text += `\n${tese.texto}\n`;
            });
        }

        setHeaderContent(text);
        setIsHeaderModalOpen(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(headerContent);
        alert("Texto copiado!");
    };

    if (!isOpen) return null;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={closeInfracaoModal}
                title={editingId ? "Editar Infração" : "Nova Infração"}
            >
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input
                        label="Nº Auto"
                        required
                        value={formData.numeroAuto || ''}
                        onChange={e => setFormData({ ...formData, numeroAuto: e.target.value })}
                    />

                    <Select
                        label="Cliente"
                        value={formData.cliente_id || ''}
                        onChange={e => handleClienteChange(e.target.value)}
                    >
                        <option value="">Selecione um Cliente</option>
                        {clientesList.map(c => (
                            <option key={c.id} value={c.id}>{c.nome} - {c.cpf}</option>
                        ))}
                    </Select>

                    {formData.cliente_id ? (
                        <Select
                            label="Veículo"
                            value={formData.veiculo_id || ''}
                            onChange={e => handleVeiculoChange(e.target.value)}
                        >
                            <option value="">Selecione um Veículo</option>
                            {veiculosList.map(v => (
                                <option key={v.id} value={v.id}>{v.modelo} - {v.placa}</option>
                            ))}
                        </Select>
                    ) : (
                        <Input
                            label="Placa (Avulsa)"
                            value={formData.placa || ''}
                            onChange={e => handlePlacaChange(e.target.value)}
                            placeholder="ABC-1234"
                        />
                    )}

                    {formData.cliente_id && (
                        <Input
                            label="Placa (Confirmada)"
                            value={formData.placa || ''}
                            readOnly
                            className="bg-slate-100"
                        />
                    )}

                    <Input
                        label="Órgão Responsável"
                        value={formData.orgao_responsavel || ''}
                        onChange={e => setFormData({ ...formData, orgao_responsavel: e.target.value })}
                        placeholder="Ex: DER/MG, PRF..."
                        list="orgaos-list"
                    />
                    <datalist id="orgaos-list">
                        {orgaosOptions.map((opt, idx) => <option key={idx} value={opt} />)}
                    </datalist>
                    <Input
                        label="Data Infração"
                        type="date"
                        required
                        value={formData.dataInfracao || ''}
                        onChange={e => setFormData({ ...formData, dataInfracao: e.target.value })}
                    />
                    <Input
                        label="Limite Protocolo"
                        type="date"
                        required
                        value={formData.dataLimiteProtocolo || ''}
                        onChange={e => setFormData({ ...formData, dataLimiteProtocolo: e.target.value })}
                    />

                    {(formData.dataProtocolo || editingId) && (
                        <Input
                            label="Data Protocolo Confirmada"
                            type="date"
                            value={formData.dataProtocolo || ''}
                            onChange={e => setFormData({ ...formData, dataProtocolo: e.target.value })}
                        />
                    )}

                    <Select
                        label="Fase Jurídica"
                        value={formData.faseRecursal || FaseRecursal.DEFESA_PREVIA}
                        onChange={e => setFormData({ ...formData, faseRecursal: e.target.value as any })}
                    >
                        <option value={FaseRecursal.DEFESA_PREVIA}>Defesa Prévia</option>
                        <option value={FaseRecursal.PRIMEIRA_INSTANCIA}>1ª Instância (JARI)</option>
                        <option value={FaseRecursal.SEGUNDA_INSTANCIA}>2ª Instância (CETRAN)</option>
                    </Select>
                    <Select
                        label="Acompanhamento (Dias)"
                        value={formData.intervaloAcompanhamento !== undefined ? formData.intervaloAcompanhamento : 0}
                        onChange={e => setFormData({ ...formData, intervaloAcompanhamento: parseInt(e.target.value) as any })}
                    >
                        <option value={0}>Nunca</option>
                        <option value={15}>A cada 15 dias</option>
                        <option value={30}>A cada 30 dias</option>
                    </Select>
                    <Select
                        label="Status Atual"
                        value={formData.status || StatusInfracao.RECURSO_A_FAZER}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    >
                        <option value={StatusInfracao.RECURSO_A_FAZER}>Recurso a Fazer</option>
                        <option value={StatusInfracao.PROTOCOLADO_PENDENTE_COMPROVANTE}>Pendente de Comprovante</option>
                        <option value={StatusInfracao.EM_JULGAMENTO}>Em Julgamento</option>
                        <option value={StatusInfracao.DEFERIDO}>Deferido</option>
                        <option value={StatusInfracao.INDEFERIDO}>Indeferido</option>
                    </Select>
                    <div className="md:col-span-2">
                        <Input
                            label="Descrição da Infração"
                            required
                            value={formData.descricao || ''}
                            onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                            placeholder="Ex: Excesso de velocidade acima de 50%"
                            list="descricoes-list"
                        />
                        <datalist id="descricoes-list">
                            {descricoesOptions.map((opt, idx) => <option key={idx} value={opt} />)}
                        </datalist>
                    </div>


                    <div className="md:col-span-3">
                        <Textarea
                            label="Observações do Processo"
                            value={formData.observacoes || ''}
                            onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                            placeholder="Ex: Cliente aguardando retorno sobre multa municipal (Shift+Enter para nova linha)"
                            rows={3}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                }
                            }}
                        />
                        <div className="mt-3">
                            <Button type="button" variant="outline" onClick={() => setIsTesesModalOpen(true)} className="w-full justify-center">
                                ⚖️ {selectedTeses.length > 0 ? `Teses Incluídas (${selectedTeses.length}) - Editar` : 'Incluir Teses'}
                            </Button>
                        </div>
                    </div>
                    <div className="md:col-span-3 flex justify-between pt-6 border-t border-slate-100">
                        <div className="flex space-x-3">
                            <Button type="button" variant="outline" onClick={generateHeader} icon="📄">
                                Gerar Cabeçalho
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsResponsavelModalOpen(true)} icon="👤">
                                Atribuir Responsável
                            </Button>
                        </div>
                        <div className="flex space-x-3">
                            <Button type="button" variant="ghost" onClick={closeInfracaoModal}>
                                Fechar
                            </Button>
                            <Button type="submit" variant="primary" className="px-12 py-4 rounded-3xl">
                                Salvar Infração
                            </Button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Modal for Selecting Teses */}
            <Modal
                isOpen={isTesesModalOpen}
                onClose={() => setIsTesesModalOpen(false)}
                title="Incluir Teses de Recurso"
            >
                <div className="space-y-4">
                    <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                        <p className="text-xs text-slate-500">
                            Selecione as teses jurídicas que serão adicionadas automaticamente ao gerar o cabeçalho.
                        </p>
                    </div>
                    {tesesList.length === 0 ? (
                        <div className="p-6 text-center border border-slate-200 rounded-xl">
                            <p className="text-sm text-slate-400 font-medium">Nenhuma tese cadastrada.</p>
                            <p className="text-xs text-slate-400 mt-1">Acesse a aba <strong>⚖️ TESES</strong> para cadastrar suas teses de recurso.</p>
                        </div>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
                            {Object.entries(
                                tesesList.reduce((acc, t) => {
                                    const cat = t.categoria || 'Geral';
                                    if (!acc[cat]) acc[cat] = [];
                                    acc[cat].push(t);
                                    return acc;
                                }, {} as Record<string, TeseRecurso[]>)
                            ).map(([cat, lista]: [string, TeseRecurso[]]) => (
                                <div key={cat}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{cat}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {lista.map(tese => (
                                            <label
                                                key={tese.id}
                                                className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-all border ${selectedTeses.includes(tese.id)
                                                        ? 'bg-indigo-50 border-indigo-300'
                                                        : 'bg-white border-slate-100 hover:border-slate-200'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTeses.includes(tese.id)}
                                                    onChange={e => {
                                                        setSelectedTeses(prev =>
                                                            e.target.checked
                                                                ? [...prev, tese.id]
                                                                : prev.filter(id => id !== tese.id)
                                                        );
                                                    }}
                                                    className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
                                                />
                                                <span className={`text-xs font-bold leading-snug flex-1 ${selectedTeses.includes(tese.id) ? 'text-indigo-800' : 'text-slate-600'
                                                    }`}>
                                                    {tese.nome}
                                                </span>
                                                {selectedTeses.includes(tese.id) && (
                                                    <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-black ml-auto shrink-0 border border-indigo-200">
                                                        {selectedTeses.indexOf(tese.id) + 1}
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-between pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsTesesModalOpen(false)}>
                            Voltar
                        </Button>
                        <div className="flex gap-2">
                            <Button onClick={() => setIsTesesModalOpen(false)}>
                                Confirmar Seleção
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isResponsavelModalOpen} onClose={() => setIsResponsavelModalOpen(false)} title="Atribuir Responsável">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Selecione o usuário responsável por esta infração. Ele receberá uma tarefa na agenda.</p>
                    <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">
                        {usersList.map(u => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => handleAssignResponsavel(u.id)}
                                className="w-full text-left p-4 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center justify-between"
                            >
                                <div>
                                    <p className="font-bold text-slate-800">{u.name}</p>
                                    <p className="text-xs text-slate-500">{u.role}</p>
                                </div>
                                <span className="text-indigo-600 font-bold text-sm">Atribuir ➡️</span>
                            </button>
                        ))}
                        {usersList.length === 0 && <p className="text-sm text-slate-500 italic">Nenhum usuário encontrado.</p>}
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button variant="ghost" onClick={() => setIsResponsavelModalOpen(false)}>Cancelar</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isHeaderModalOpen}
                onClose={() => setIsHeaderModalOpen(false)}
                title="Cabeçalho do Recurso"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Copie o texto abaixo e cole no seu editor de texto.</p>
                    <textarea
                        className="w-full h-96 p-4 border rounded-xl text-sm font-serif bg-slate-50 focus:outline-none focus:ring-2 ring-indigo-500"
                        value={headerContent}
                        readOnly
                    />
                    <div className="flex justify-end space-x-3">
                        <Button variant="ghost" onClick={() => setIsHeaderModalOpen(false)}>Fechar</Button>
                        <Button variant="primary" onClick={copyToClipboard}>Copiar Texto</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default InfracaoModal;
