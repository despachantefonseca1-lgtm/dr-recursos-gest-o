import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DespachanteDbService } from '../../services/despachanteDb';
import { Cliente, ServicoDespachante, ChecklistServico } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';

const INITIAL_CHECKLIST: ChecklistServico = {
    vencimento_crv: false,
    autenticacoes_crv: false,
    selos: false,
    crlv: false,
    xerox_cpf_rg: false,
    documento_adicional: false,
    ipva_licenciamento: false,
    carteira_despachante: false,
    carimbo_despachante: false,
    laudo_vistoria: false,
    conferencia_veiculo: false,
};

const NovoServico: React.FC = () => {
    const { id, servicoId } = useParams<{ id: string; servicoId?: string }>();
    const navigate = useNavigate();
    const [cliente, setCliente] = useState<Cliente | null>(null);

    // Helper to get current local date
    const getLocalDateString = (): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Form Fields
    const [dataServico, setDataServico] = useState(getLocalDateString());
    const [veiculo, setVeiculo] = useState('');
    const [placa, setPlaca] = useState('');
    const [descricao, setDescricao] = useState('');
    const [pagamentoForma, setPagamentoForma] = useState('');
    const [pagamentoValor, setPagamentoValor] = useState('');
    const [pagamentoObs, setPagamentoObs] = useState('');
    const [melhorHorario, setMelhorHorario] = useState('');
    const [obsServico, setObsServico] = useState('');
    const [complementacao, setComplementacao] = useState('');

    const [checklist, setChecklist] = useState<ChecklistServico>(INITIAL_CHECKLIST);

    useEffect(() => {
        const load = async () => {
            if (id) {
                const c = await DespachanteDbService.getClienteById(id);
                if (!c) {
                    navigate('/despachante/clientes');
                    return;
                }
                setCliente(c);

                if (servicoId) {
                    const s = await DespachanteDbService.getServicoById(servicoId);
                    if (s) {
                        setDataServico(s.data_servico);
                        setVeiculo(s.veiculo);
                        setPlaca(s.placa);
                        setDescricao(s.servico_descricao);
                        setPagamentoForma(s.pagamento_forma || '');
                        setPagamentoValor(s.pagamento_valor.toString());
                        setPagamentoObs(s.pagamento_obs || '');
                        setMelhorHorario(s.melhor_horario_vistoria || '');
                        setObsServico(s.observacoes_servico || '');
                        setComplementacao(s.complementacao || '');
                        setChecklist(s.checklist || INITIAL_CHECKLIST);
                    }
                }
            }
        };
        load();
    }, [id, servicoId]);

    const handleChecklistChange = (key: keyof ChecklistServico) => {
        setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (!id || !dataServico) {
            alert('Preencha a data do serviço');
            return;
        }

        const valor = parseFloat(pagamentoValor.replace(',', '.')) || 0;

        // For updates, use full type with ID; for new services, use Partial without ID
        const servico: Partial<ServicoDespachante> = servicoId ? {
            id: servicoId,
            cliente_id: id,
            data_servico: dataServico,
            veiculo,
            placa,
            servico_descricao: descricao,
            pagamento_forma: pagamentoForma,
            pagamento_valor: valor,
            pagamento_obs: pagamentoObs,
            melhor_horario_vistoria: melhorHorario,
            observacoes_servico: obsServico,
            complementacao,
            checklist
        } : {
            cliente_id: id,
            data_servico: dataServico,
            veiculo,
            placa,
            servico_descricao: descricao,
            pagamento_forma: pagamentoForma,
            pagamento_valor: valor,
            pagamento_obs: pagamentoObs,
            melhor_horario_vistoria: melhorHorario,
            observacoes_servico: obsServico,
            complementacao,
            checklist
        };

        try {
            await DespachanteDbService.saveServico(servico);
            alert('Serviço salvo com sucesso!');
            navigate(`/despachante/clientes/${id}`);
        } catch (error: any) {
            console.error(error);
            alert('Erro ao salvar serviço: ' + (error.message || 'Erro desconhecido'));
        }
    };

    if (!cliente) return <div>Carregando...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div className="flex items-center space-x-4">
                <button onClick={() => navigate(`/despachante/clientes/${id}`)} className="text-slate-400 hover:text-slate-600">
                    ← Voltar
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{servicoId ? 'Editar Serviço' : 'Novo Serviço'}</h1>
                    <p className="text-slate-500 text-sm">Cliente: <span className="font-bold text-slate-700">{cliente.nome}</span></p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Informações do Serviço</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Data do Serviço *"
                        type="date"
                        value={dataServico}
                        onChange={(e) => setDataServico(e.target.value)}
                    />
                    <Input
                        label="Placa"
                        value={placa}
                        onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                    />
                    <Input
                        label="Veículo"
                        value={veiculo}
                        onChange={(e) => setVeiculo(e.target.value)}
                        placeholder="Modelo / Cor"
                    />
                    <Input
                        label="Descrição do Serviço"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                    />
                </div>

                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2 pt-2">Pagamento e Detalhes</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                        label="Forma de Pagamento"
                        value={pagamentoForma}
                        onChange={(e) => setPagamentoForma(e.target.value)}
                    />
                    <Input
                        label="Valor (R$)"
                        value={pagamentoValor}
                        onChange={(e) => setPagamentoValor(e.target.value)}
                        type="number"
                        placeholder="0.00"
                    />
                    <Input
                        label="Melhor Horário Vistoria"
                        value={melhorHorario}
                        onChange={(e) => setMelhorHorario(e.target.value)}
                    />
                </div>

                <Input
                    label="Obs Pagamento"
                    value={pagamentoObs}
                    onChange={(e) => setPagamentoObs(e.target.value)}
                />

                <div className="pt-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Observações Gerais</label>
                    <Textarea
                        value={obsServico}
                        onChange={(e) => setObsServico(e.target.value)}
                        rows={3}
                    />
                </div>

                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2 pt-2">Dados a Ser Conferidos (Checklist)</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(checklist).map(([key, value]) => (
                        <label key={key} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100">
                            <input
                                type="checkbox"
                                checked={value}
                                onChange={() => handleChecklistChange(key as keyof ChecklistServico)}
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-slate-700 uppercase text-xs">
                                {key.replace(/_/g, ' ')}
                            </span>
                        </label>
                    ))}
                </div>

                <div className="pt-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Complementação</label>
                    <Textarea
                        value={complementacao}
                        onChange={(e) => setComplementacao(e.target.value)}
                        rows={2}
                    />
                </div>

                <div className="pt-6 flex justify-end space-x-3 border-t border-slate-100">
                    <Button variant="secondary" onClick={() => navigate(`/despachante/clientes/${id}`)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} className="px-8">
                        Salvar Serviço
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NovoServico;
