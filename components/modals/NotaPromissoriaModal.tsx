import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
    RecursoCliente, RecursoVeiculo,
    NotaPromissoria, NotaParcela,
    SituacaoParcela, SituacaoNota, Periodicidade,
    Avalista, RegistroPagamentoPayload
} from '../../types';
import { api } from '../../lib/api';
import {
    generateNotaPromissoriaPDF,
    NotaPromissoriaParaImpressao
} from '../../services/pdfService';
import { formatCpfCnpj, formatPhone, formatCEP } from '../../lib/masks';

// ─── Constantes de Credor Padrão ────────────────────────────────────────────
const CREDOR_PADRAO = {
    nome: 'Israel Fonseca',
    cpf_cnpj: '073.719.596-71',
    endereco: 'Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002'
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hoje = (): string => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

const addDias = (dateStr: string, dias: number): string => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
};

const addMeses = (dateStr: string, meses: number): string => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setMonth(d.getMonth() + meses);
    return d.toISOString().split('T')[0];
};

const calcularVencimentos = (
    dataBase: string,
    numParcelas: number,
    periodicidade: Periodicidade
): string[] => {
    const datas: string[] = [];
    for (let i = 0; i < numParcelas; i++) {
        let data: string;
        switch (periodicidade) {
            case Periodicidade.MENSAL:
                data = addMeses(dataBase, i);
                break;
            case Periodicidade.QUINZENAL:
                data = addDias(dataBase, i * 15);
                break;
            case Periodicidade.SEMANAL:
                data = addDias(dataBase, i * 7);
                break;
            default:
                data = addMeses(dataBase, i);
        }
        datas.push(data);
    }
    return datas;
};

const calcularParcelas = (valorTotal: number, numParcelas: number): number[] => {
    if (numParcelas <= 0) return [];
    const valorBase = Math.floor((valorTotal / numParcelas) * 100) / 100;
    const soma = valorBase * (numParcelas - 1);
    const ultima = Math.round((valorTotal - soma) * 100) / 100;
    return [...Array(numParcelas - 1).fill(valorBase), ultima];
};

const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateBR = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const situacaoConfig: Record<string, { label: string; color: string }> = {
    A_VENCER: { label: 'A Vencer', color: 'bg-blue-100 text-blue-700' },
    VENCIDA: { label: 'Vencida', color: 'bg-red-100 text-red-700' },
    PAGA: { label: 'Paga', color: 'bg-emerald-100 text-emerald-700' },
    PARCIALMENTE_PAGA: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-700' },
    RENEGOCIADA: { label: 'Renegociada', color: 'bg-purple-100 text-purple-700' },
    CANCELADA: { label: 'Cancelada', color: 'bg-slate-100 text-slate-500' }
};

const notaSituacaoConfig: Record<string, { label: string; color: string }> = {
    ATIVA: { label: 'Ativa', color: 'bg-emerald-100 text-emerald-700' },
    CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
    QUITADA: { label: 'Quitada', color: 'bg-slate-100 text-slate-600' }
};

// ─── Tipos internos do wizard ────────────────────────────────────────────────
interface ParcelaRascunho {
    numero: number;
    data_vencimento: string;
    valor: number;
}

interface WizardData {
    // Etapa 1 — Devedor
    devedor_nome: string;
    devedor_cpf_cnpj: string;
    devedor_logradouro: string;
    devedor_numero: string;
    devedor_bairro: string;
    devedor_cidade: string;
    devedor_uf: string;
    devedor_cep: string;
    devedor_telefone: string;
    // Etapa 2 — Credor
    credor_nome: string;
    credor_cpf_cnpj: string;
    credor_endereco: string;
    // Etapa 3 — Negociação
    descricao: string;
    valor_total: number;
    num_parcelas: number;
    data_primeiro_vencimento: string;
    periodicidade: Periodicidade;
    local_pagamento: string;
    data_emissao: string;
    observacoes_internas: string;
    parcelas: ParcelaRascunho[];
    // Etapa 4 — Avalistas
    tem_avalista: 'nao' | 'um' | 'dois';
    avalistas: Avalista[];
}

const avalista_vazio: Avalista = {
    nome: '', cpf_cnpj: '', endereco: '', telefone: '', estado_civil: '', profissao: ''
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface NotaPromissoriaModalProps {
    isOpen: boolean;
    onClose: () => void;
    cliente: RecursoCliente;
    onGerado: () => void;
}

export const NotaPromissoriaModal: React.FC<NotaPromissoriaModalProps> = ({
    isOpen, onClose, cliente, onGerado
}) => {
    const [etapa, setEtapa] = useState(1);
    const [salvando, setSalvando] = useState(false);

    const usuarioAtual = api.getCurrentUser();

    const initWizard = (): WizardData => ({
        devedor_nome: cliente.nome || '',
        devedor_cpf_cnpj: cliente.cpf || '',
        devedor_logradouro: cliente.logradouro || '',
        devedor_numero: cliente.numero || '',
        devedor_bairro: cliente.bairro || '',
        devedor_cidade: cliente.cidade || '',
        devedor_uf: cliente.uf || '',
        devedor_cep: cliente.cep || '',
        devedor_telefone: cliente.telefone || '',
        credor_nome: CREDOR_PADRAO.nome,
        credor_cpf_cnpj: CREDOR_PADRAO.cpf_cnpj,
        credor_endereco: CREDOR_PADRAO.endereco,
        descricao: '',
        valor_total: 0,
        num_parcelas: 1,
        data_primeiro_vencimento: hoje(),
        periodicidade: Periodicidade.MENSAL,
        local_pagamento: 'Bom Despacho/MG',
        data_emissao: hoje(),
        observacoes_internas: '',
        parcelas: [],
        tem_avalista: 'nao',
        avalistas: [{ ...avalista_vazio }]
    });

    const [data, setData] = useState<WizardData>(initWizard);

    useEffect(() => {
        if (isOpen) {
            setData(initWizard());
            setEtapa(1);
        }
    }, [isOpen]);

    const set = (campo: keyof WizardData, valor: any) =>
        setData(prev => ({ ...prev, [campo]: valor }));

    // Recalcular parcelas ao mudar valor, nº ou periodicidade
    const recalcularParcelas = (
        valorTotal: number,
        numParcelas: number,
        dataPrimeiro: string,
        periodicidade: Periodicidade
    ) => {
        const valores = calcularParcelas(valorTotal, numParcelas);
        const datas = calcularVencimentos(dataPrimeiro, numParcelas, periodicidade);
        const parcelas: ParcelaRascunho[] = valores.map((v, i) => ({
            numero: i + 1,
            data_vencimento: datas[i],
            valor: v
        }));
        setData(prev => ({ ...prev, parcelas }));
    };

    const handleValorOuParcelasChange = (
        valorTotal: number,
        numParcelas: number,
        dataPrimeiro?: string,
        periodicidade?: Periodicidade
    ) => {
        const dt = dataPrimeiro ?? data.data_primeiro_vencimento;
        const per = periodicidade ?? data.periodicidade;
        setData(prev => ({ ...prev, valor_total: valorTotal, num_parcelas: numParcelas }));
        if (valorTotal > 0 && numParcelas > 0) {
            recalcularParcelas(valorTotal, numParcelas, dt, per);
        }
    };

    const handleGerarNotas = async () => {
        setSalvando(true);
        try {
            const nota: Omit<NotaPromissoria, 'id' | 'created_at' | 'updated_at' | 'parcelas'> = {
                cliente_id: cliente.id,
                devedor_nome: data.devedor_nome,
                devedor_cpf_cnpj: data.devedor_cpf_cnpj,
                devedor_logradouro: data.devedor_logradouro,
                devedor_numero: data.devedor_numero,
                devedor_bairro: data.devedor_bairro,
                devedor_cidade: data.devedor_cidade,
                devedor_uf: data.devedor_uf,
                devedor_cep: data.devedor_cep,
                devedor_telefone: data.devedor_telefone,
                credor_nome: data.credor_nome,
                credor_cpf_cnpj: data.credor_cpf_cnpj,
                credor_endereco: data.credor_endereco,
                descricao: data.descricao,
                valor_total: data.valor_total,
                num_parcelas: data.num_parcelas,
                data_emissao: data.data_emissao,
                local_pagamento: data.local_pagamento,
                periodicidade: data.periodicidade,
                observacoes_internas: data.observacoes_internas,
                avalistas: data.tem_avalista === 'nao' ? [] :
                    data.tem_avalista === 'um' ? [data.avalistas[0]] :
                        data.avalistas.slice(0, 2),
                situacao: SituacaoNota.ATIVA,
                criado_por: usuarioAtual?.name || 'Sistema'
            };

            const parcelasPayload = data.parcelas.map(p => ({
                cliente_id: cliente.id,
                numero_parcela: p.numero,
                total_parcelas: data.num_parcelas,
                data_vencimento: p.data_vencimento,
                valor: p.valor,
                situacao: SituacaoParcela.A_VENCER,
                valor_pago: 0,
                nota_id: '' // será preenchido pelo api
            }));

            await api.createNotaComParcelas(nota, parcelasPayload);
            alert('Notas promissórias geradas com sucesso!');
            onGerado();
            onClose();
        } catch (e: any) {
            alert('Erro ao gerar notas: ' + (e.message || JSON.stringify(e)));
        } finally {
            setSalvando(false);
        }
    };

    if (!isOpen) return null;

    // ── Render por Etapa ──────────────────────────────────────────────────────
    const StepIndicator = () => (
        <div className="flex items-center justify-center gap-1 mb-5">
            {[1, 2, 3, 4, 5].map(n => (
                <React.Fragment key={n}>
                    <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all
                            ${etapa === n ? 'bg-emerald-600 text-white shadow-md' :
                            etapa > n ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                    >
                        {etapa > n ? '✓' : n}
                    </div>
                    {n < 5 && <div className={`h-0.5 w-8 ${etapa > n ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </React.Fragment>
            ))}
        </div>
    );

    const etapaTitulos = ['Devedor', 'Credor', 'Negociação', 'Avalistas', 'Revisão'];

    const UfSelect: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
        <Select label={label} value={value} onChange={e => onChange(e.target.value)}>
            <option value="">Selecione</option>
            {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
            ))}
        </Select>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`📝 Gerar Notas Promissórias — ${etapaTitulos[etapa - 1]}`}
        >
            <StepIndicator />

            {/* ── ETAPA 1: Devedor ─────────────────────────────────────────── */}
            {etapa === 1 && (
                <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <p className="text-xs text-blue-700 font-semibold">
                            ℹ️ Dados pré-preenchidos do cliente. Você pode editá-los sem alterar o cadastro original.
                        </p>
                    </div>
                    <Input label="Nome Completo / Razão Social *" value={data.devedor_nome}
                        onChange={e => set('devedor_nome', e.target.value)} />
                    <Input label="CPF / CNPJ *" value={data.devedor_cpf_cnpj}
                        onChange={e => set('devedor_cpf_cnpj', formatCpfCnpj(e.target.value))}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                    <Input label="Telefone" value={data.devedor_telefone}
                        onChange={e => set('devedor_telefone', formatPhone(e.target.value))}
                        placeholder="(00) 00000-0000" />
                    <div className="grid grid-cols-5 gap-2">
                        <div className="col-span-1">
                            <Input label="CEP" value={data.devedor_cep}
                                onChange={e => set('devedor_cep', formatCEP(e.target.value))}
                                placeholder="00000-000" />
                        </div>
                        <div className="col-span-3">
                            <Input label="Logradouro" value={data.devedor_logradouro}
                                onChange={e => set('devedor_logradouro', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <Input label="Número" value={data.devedor_numero}
                                onChange={e => set('devedor_numero', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <Input label="Bairro" value={data.devedor_bairro}
                            onChange={e => set('devedor_bairro', e.target.value)} />
                        <Input label="Cidade" value={data.devedor_cidade}
                            onChange={e => set('devedor_cidade', e.target.value)} />
                        <UfSelect label="UF" value={data.devedor_uf}
                            onChange={v => set('devedor_uf', v)} />
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button variant="primary" onClick={() => setEtapa(2)}
                            disabled={!data.devedor_nome || !data.devedor_cpf_cnpj}>
                            Próximo →
                        </Button>
                    </div>
                </div>
            )}

            {/* ── ETAPA 2: Credor ──────────────────────────────────────────── */}
            {etapa === 2 && (
                <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 font-semibold">
                            ℹ️ Dados do credor pré-preenchidos. Edite apenas se necessário para esta nota.
                        </p>
                    </div>
                    <Input label="Nome / Razão Social do Credor *" value={data.credor_nome}
                        onChange={e => set('credor_nome', e.target.value)} />
                    <Input label="CPF / CNPJ do Credor *" value={data.credor_cpf_cnpj}
                        onChange={e => set('credor_cpf_cnpj', formatCpfCnpj(e.target.value))}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Endereço do Credor (local de pagamento)
                        </label>
                        <textarea
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm resize-none"
                            rows={2}
                            value={data.credor_endereco}
                            onChange={e => set('credor_endereco', e.target.value)}
                        />
                    </div>
                    <div className="flex justify-between pt-2">
                        <Button variant="ghost" onClick={() => setEtapa(1)}>← Voltar</Button>
                        <Button variant="primary" onClick={() => setEtapa(3)}
                            disabled={!data.credor_nome || !data.credor_cpf_cnpj}>
                            Próximo →
                        </Button>
                    </div>
                </div>
            )}

            {/* ── ETAPA 3: Negociação ──────────────────────────────────────── */}
            {etapa === 3 && (
                <div className="space-y-3">
                    <Input label="Descrição da cobrança / serviço *" value={data.descricao}
                        onChange={e => set('descricao', e.target.value)} />

                    <div className="grid grid-cols-3 gap-2">
                        <Input
                            label="Valor Total (R$) *"
                            type="number"
                            value={data.valor_total || ''}
                            onChange={e => {
                                const v = Number(e.target.value);
                                setData(prev => ({ ...prev, valor_total: v }));
                                if (v > 0 && data.num_parcelas > 0) {
                                    recalcularParcelas(v, data.num_parcelas, data.data_primeiro_vencimento, data.periodicidade);
                                }
                            }}
                        />
                        <Input
                            label="Nº de Parcelas *"
                            type="number"
                            value={data.num_parcelas || ''}
                            onChange={e => {
                                const n = Math.max(1, parseInt(e.target.value) || 1);
                                setData(prev => ({ ...prev, num_parcelas: n }));
                                if (data.valor_total > 0) {
                                    recalcularParcelas(data.valor_total, n, data.data_primeiro_vencimento, data.periodicidade);
                                }
                            }}
                        />
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Valor por Parcela
                            </label>
                            <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700">
                                {data.num_parcelas > 0 && data.valor_total > 0
                                    ? formatCurrency(Math.floor((data.valor_total / data.num_parcelas) * 100) / 100)
                                    : '—'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            label="Data do 1º Vencimento *"
                            type="date"
                            value={data.data_primeiro_vencimento}
                            onChange={e => {
                                const v = e.target.value;
                                setData(prev => ({ ...prev, data_primeiro_vencimento: v }));
                                if (data.valor_total > 0 && data.num_parcelas > 0) {
                                    recalcularParcelas(data.valor_total, data.num_parcelas, v, data.periodicidade);
                                }
                            }}
                        />
                        <Select
                            label="Periodicidade"
                            value={data.periodicidade}
                            onChange={e => {
                                const per = e.target.value as Periodicidade;
                                setData(prev => ({ ...prev, periodicidade: per }));
                                if (data.valor_total > 0 && data.num_parcelas > 0) {
                                    recalcularParcelas(data.valor_total, data.num_parcelas, data.data_primeiro_vencimento, per);
                                }
                            }}
                        >
                            <option value={Periodicidade.MENSAL}>Mensal</option>
                            <option value={Periodicidade.QUINZENAL}>Quinzenal</option>
                            <option value={Periodicidade.SEMANAL}>Semanal</option>
                            <option value={Periodicidade.PERSONALIZADA}>Personalizada (editar datas)</option>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Input label="Local de Pagamento" value={data.local_pagamento}
                            onChange={e => set('local_pagamento', e.target.value)} />
                        <Input label="Data de Emissão" type="date" value={data.data_emissao}
                            onChange={e => set('data_emissao', e.target.value)} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Observações Internas
                        </label>
                        <textarea
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm resize-none"
                            rows={2}
                            value={data.observacoes_internas}
                            onChange={e => set('observacoes_internas', e.target.value)}
                            placeholder="Uso interno — não aparece na nota"
                        />
                    </div>

                    {/* Preview de Parcelas */}
                    {data.parcelas.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <h4 className="text-xs font-black text-slate-600 uppercase mb-2">
                                Prévia das Parcelas
                            </h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {data.parcelas.map((p, idx) => (
                                    <div key={idx} className="grid grid-cols-3 gap-2 items-center bg-white p-2 rounded-lg border border-slate-100">
                                        <div className="text-xs font-bold text-slate-700 text-center">
                                            {String(p.numero).padStart(2, '0')}/{String(data.num_parcelas).padStart(2, '0')}
                                        </div>
                                        <Input
                                            label=""
                                            type="date"
                                            value={p.data_vencimento}
                                            onChange={e => {
                                                const updated = [...data.parcelas];
                                                updated[idx] = { ...updated[idx], data_vencimento: e.target.value };
                                                setData(prev => ({ ...prev, parcelas: updated }));
                                            }}
                                        />
                                        <Input
                                            label=""
                                            type="number"
                                            value={p.valor}
                                            onChange={e => {
                                                const updated = [...data.parcelas];
                                                updated[idx] = { ...updated[idx], valor: Number(e.target.value) };
                                                setData(prev => ({ ...prev, parcelas: updated }));
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Total: {formatCurrency(data.parcelas.reduce((s, p) => s + p.valor, 0))}
                            </p>
                        </div>
                    )}

                    <div className="flex justify-between pt-2">
                        <Button variant="ghost" onClick={() => setEtapa(2)}>← Voltar</Button>
                        <Button variant="primary"
                            onClick={() => setEtapa(4)}
                            disabled={!data.descricao || data.valor_total <= 0 || data.parcelas.length === 0}>
                            Próximo →
                        </Button>
                    </div>
                </div>
            )}

            {/* ── ETAPA 4: Avalistas ───────────────────────────────────────── */}
            {etapa === 4 && (
                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-slate-700 mb-3">A nota promissória terá avalista?</p>
                        <div className="flex gap-3">
                            {[
                                { val: 'nao', label: 'Não' },
                                { val: 'um', label: 'Sim, um avalista' },
                                { val: 'dois', label: 'Sim, dois avalistas' }
                            ].map(opt => (
                                <button
                                    key={opt.val}
                                    onClick={() => set('tem_avalista', opt.val as any)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all
                                        ${data.tem_avalista === opt.val
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {data.tem_avalista !== 'nao' && (
                        <div className="space-y-4">
                            {[0, ...(data.tem_avalista === 'dois' ? [1] : [])].map(avIdx => (
                                <div key={avIdx} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                    <h4 className="text-xs font-black text-amber-700 uppercase mb-2">
                                        Avalista {avIdx + 1}
                                    </h4>
                                    {(['nome', 'cpf_cnpj', 'endereco', 'telefone', 'estado_civil', 'profissao'] as (keyof Avalista)[]).map(campo => (
                                        <div key={campo} className="mb-2">
                                            <Input
                                                label={campo.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                value={data.avalistas[avIdx]?.[campo] || ''}
                                                placeholder={
                                                    campo === 'cpf_cnpj' ? '000.000.000-00 ou 00.000.000/0000-00' :
                                                    campo === 'telefone' ? '(00) 00000-0000' : undefined
                                                }
                                                onChange={e => {
                                                    const novos = [...data.avalistas];
                                                    if (!novos[avIdx]) novos[avIdx] = { ...avalista_vazio };
                                                    let val = e.target.value;
                                                    if (campo === 'cpf_cnpj') val = formatCpfCnpj(val);
                                                    if (campo === 'telefone') val = formatPhone(val);
                                                    novos[avIdx] = { ...novos[avIdx], [campo]: val };
                                                    setData(prev => ({ ...prev, avalistas: novos }));
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between pt-2">
                        <Button variant="ghost" onClick={() => setEtapa(3)}>← Voltar</Button>
                        <Button variant="primary" onClick={() => setEtapa(5)}>
                            Revisar →
                        </Button>
                    </div>
                </div>
            )}

            {/* ── ETAPA 5: Revisão e Geração ───────────────────────────────── */}
            {etapa === 5 && (
                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
                        <h4 className="font-black text-slate-700 uppercase text-xs tracking-wider">Resumo da Negociação</h4>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Devedor</p>
                                <p className="font-semibold text-slate-800">{data.devedor_nome}</p>
                                <p className="text-xs text-slate-500">{data.devedor_cpf_cnpj}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Credor</p>
                                <p className="font-semibold text-slate-800">{data.credor_nome}</p>
                                <p className="text-xs text-slate-500">{data.credor_cpf_cnpj}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Descrição</p>
                                <p className="text-slate-700">{data.descricao}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Valor Total</p>
                                <p className="font-bold text-emerald-700 text-lg">{formatCurrency(data.valor_total)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Parcelas</p>
                                <p className="text-slate-700">{data.num_parcelas}x de {formatCurrency(data.parcelas[0]?.valor || 0)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Local de Pagamento</p>
                                <p className="text-slate-700">{data.local_pagamento}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Emissão</p>
                                <p className="text-slate-700">{formatDateBR(data.data_emissao)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Avalistas</p>
                                <p className="text-slate-700">
                                    {data.tem_avalista === 'nao' ? 'Sem avalista' :
                                        data.tem_avalista === 'um' ? data.avalistas[0]?.nome || '—' :
                                            `${data.avalistas[0]?.nome || '—'} / ${data.avalistas[1]?.nome || '—'}`}
                                </p>
                            </div>
                        </div>

                        {/* Lista de vencimentos */}
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Vencimentos</p>
                            <div className="flex flex-wrap gap-1.5">
                                {data.parcelas.map(p => (
                                    <span key={p.numero}
                                        className="bg-white border border-slate-200 text-xs px-2 py-0.5 rounded-full font-medium text-slate-700">
                                        {String(p.numero).padStart(2, '0')}/{String(data.num_parcelas).padStart(2, '0')} · {formatDateBR(p.data_vencimento)} · {formatCurrency(p.valor)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setEtapa(4)} disabled={salvando}>
                            ← Voltar e Editar
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={salvando}
                                onClick={async () => {
                                    try {
                                        const notasParaPDF: NotaPromissoriaParaImpressao[] = data.parcelas.map(p => ({
                                            numero_parcela: p.numero,
                                            total_parcelas: data.num_parcelas,
                                            data_vencimento: p.data_vencimento,
                                            valor: p.valor,
                                            credor_nome: data.credor_nome,
                                            credor_cpf_cnpj: data.credor_cpf_cnpj,
                                            devedor_nome: data.devedor_nome,
                                            devedor_cpf_cnpj: data.devedor_cpf_cnpj,
                                            devedor_logradouro: data.devedor_logradouro,
                                            devedor_numero: data.devedor_numero,
                                            devedor_bairro: data.devedor_bairro,
                                            devedor_cidade: data.devedor_cidade,
                                            devedor_uf: data.devedor_uf,
                                            devedor_cep: data.devedor_cep,
                                            local_pagamento: data.local_pagamento,
                                            data_emissao: data.data_emissao,
                                            descricao: data.descricao,
                                            avalistas: data.tem_avalista === 'nao' ? [] :
                                                data.tem_avalista === 'um' ? [data.avalistas[0]] :
                                                    data.avalistas.slice(0, 2)
                                        }));
                                        await generateNotaPromissoriaPDF({ notas: notasParaPDF });
                                    } catch (e: any) {
                                        alert('Erro ao gerar PDF: ' + e.message);
                                    }
                                }}
                            >
                                📄 Prévia PDF
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleGerarNotas}
                                disabled={salvando}
                            >
                                {salvando ? '⏳ Gerando...' : '✅ Gerar Notas Promissórias'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

// ─── MODAL DE REGISTRO DE PAGAMENTO ─────────────────────────────────────────

interface PagamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    parcela: NotaParcela | null;
    onSalvo: () => void;
}

export const PagamentoModal: React.FC<PagamentoModalProps> = ({
    isOpen, onClose, parcela, onSalvo
}) => {
    const usuarioAtual = api.getCurrentUser();
    const [form, setForm] = useState({
        data_pagamento: hoje(),
        valor_pago: 0,
        forma_pagamento: 'PIX',
        obs_pagamento: ''
    });
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (isOpen && parcela) {
            setForm({
                data_pagamento: hoje(),
                valor_pago: parcela.valor - (parcela.valor_pago || 0),
                forma_pagamento: 'PIX',
                obs_pagamento: ''
            });
        }
    }, [isOpen, parcela]);

    const handleSalvar = async () => {
        if (!parcela) return;
        setSalvando(true);
        try {
            await api.registrarPagamentoParcela({
                parcelaId: parcela.id,
                data_pagamento: form.data_pagamento,
                valor_pago: form.valor_pago,
                forma_pagamento: form.forma_pagamento,
                obs_pagamento: form.obs_pagamento,
                pago_por: usuarioAtual?.name || 'Sistema'
            });
            alert('Pagamento registrado com sucesso!');
            onSalvo();
            onClose();
        } catch (e: any) {
            alert('Erro ao registrar pagamento: ' + e.message);
        } finally {
            setSalvando(false);
        }
    };

    if (!isOpen || !parcela) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="💰 Registrar Pagamento">
            <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm">
                    <p className="font-bold text-emerald-800">Parcela {parcela.numero_parcela}/{parcela.total_parcelas}</p>
                    <p className="text-emerald-700">Vencimento: {formatDateBR(parcela.data_vencimento)}</p>
                    <p className="text-emerald-700">Valor: {formatCurrency(parcela.valor)}</p>
                    {parcela.valor_pago > 0 && (
                        <p className="text-amber-700">Já pago: {formatCurrency(parcela.valor_pago)} · Saldo: {formatCurrency(parcela.valor - parcela.valor_pago)}</p>
                    )}
                </div>
                <Input label="Data do Pagamento *" type="date" value={form.data_pagamento}
                    onChange={e => setForm(p => ({ ...p, data_pagamento: e.target.value }))} />
                <Input label="Valor Pago (R$) *" type="number" value={form.valor_pago}
                    onChange={e => setForm(p => ({ ...p, valor_pago: Number(e.target.value) }))} />
                <Select label="Forma de Pagamento" value={form.forma_pagamento}
                    onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value }))}>
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="TRANSFERÊNCIA">Transferência</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="CARTÃO_DÉBITO">Cartão Débito</option>
                    <option value="CARTÃO_CRÉDITO">Cartão Crédito</option>
                    <option value="CHEQUE">Cheque</option>
                </Select>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                    <textarea
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm resize-none"
                        rows={2}
                        value={form.obs_pagamento}
                        onChange={e => setForm(p => ({ ...p, obs_pagamento: e.target.value }))}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSalvar} disabled={salvando || form.valor_pago <= 0}>
                        {salvando ? '⏳ Salvando...' : '✅ Confirmar Pagamento'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// ─── MODAL DE CANCELAMENTO ───────────────────────────────────────────────────

interface CancelamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    notaId: string | null;
    onCancelado: () => void;
}

export const CancelamentoModal: React.FC<CancelamentoModalProps> = ({
    isOpen, onClose, notaId, onCancelado
}) => {
    const usuarioAtual = api.getCurrentUser();
    const [motivo, setMotivo] = useState('');
    const [cancelando, setCancelando] = useState(false);

    useEffect(() => {
        if (isOpen) setMotivo('');
    }, [isOpen]);

    const handleCancelar = async () => {
        if (!notaId || !motivo.trim()) { alert('Informe o motivo do cancelamento.'); return; }
        if (!confirm('Confirmar cancelamento desta negociação? Esta ação não pode ser desfeita.')) return;
        setCancelando(true);
        try {
            await api.cancelarNota(notaId, motivo, usuarioAtual?.name || 'Sistema');
            alert('Negociação cancelada com sucesso.');
            onCancelado();
            onClose();
        } catch (e: any) {
            alert('Erro ao cancelar: ' + e.message);
        } finally {
            setCancelando(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="❌ Cancelar Negociação">
            <div className="space-y-3">
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-red-800">⚠️ Atenção</p>
                    <p className="text-xs text-red-700 mt-1">
                        O cancelamento encerrará esta negociação e todas as parcelas pendentes.
                        Esta ação ficará registrada no histórico e não poderá ser desfeita.
                    </p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Motivo do Cancelamento *
                    </label>
                    <textarea
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm resize-none"
                        rows={3}
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Descreva o motivo do cancelamento..."
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={cancelando}>Fechar</Button>
                    <Button
                        onClick={handleCancelar}
                        disabled={cancelando || !motivo.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm"
                    >
                        {cancelando ? '⏳ Cancelando...' : '❌ Confirmar Cancelamento'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// ─── SEÇÃO DE NOTAS PROMISSÓRIAS (dentro da aba Financeiro/Serviços) ─────────

interface NotasPromissoriasSecaoProps {
    clienteId: string;
    cliente: RecursoCliente;
}

export const NotasPromissoriasSecao: React.FC<NotasPromissoriasSecaoProps> = ({
    clienteId, cliente
}) => {
    const [notas, setNotas] = useState<NotaPromissoria[]>([]);
    const [parcelasPorNota, setParcelasPorNota] = useState<Record<string, NotaParcela[]>>({});
    const [notaExpandida, setNotaExpandida] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Modais
    const [wizardOpen, setWizardOpen] = useState(false);
    const [pagamentoOpen, setPagamentoOpen] = useState(false);
    const [pagamentoParcela, setPagamentoParcela] = useState<NotaParcela | null>(null);
    const [cancelamentoOpen, setCancelamentoOpen] = useState(false);
    const [cancelamentoNotaId, setCancelamentoNotaId] = useState<string | null>(null);
    const [modeloPDF, setModeloPDF] = useState<'ECONOMICO' | 'AMPLIADO'>('ECONOMICO');

    const carregarNotas = async () => {
        setLoading(true);
        try {
            await api.atualizarSituacoesParcelas(clienteId);
            const data = await api.getNotasPromissorias(clienteId);
            setNotas(data);
            // Carregar parcelas de todas as notas
            const parcMap: Record<string, NotaParcela[]> = {};
            await Promise.all(data.map(async nota => {
                parcMap[nota.id] = await api.getNotasParcelas(nota.id);
            }));
            setParcelasPorNota(parcMap);
        } catch (e) {
            console.error('Erro ao carregar notas', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (clienteId) carregarNotas();
    }, [clienteId]);

    // ── Estatísticas ──────────────────────────────────────────────────────────
    const todasParcelas: NotaParcela[] = (Object.values(parcelasPorNota) as NotaParcela[][]).flat();
    const parcelasAbertas = todasParcelas.filter(p =>
        p.situacao === 'A_VENCER' || p.situacao === 'PARCIALMENTE_PAGA');
    const parcelasVencidas = todasParcelas.filter(p => p.situacao === 'VENCIDA');
    const valorAberto = parcelasAbertas.reduce((s, p) => s + (p.valor - (p.valor_pago || 0)), 0);
    const valorRecebido = todasParcelas
        .filter(p => p.situacao === 'PAGA' || p.situacao === 'PARCIALMENTE_PAGA')
        .reduce((s, p) => s + (p.valor_pago || 0), 0);

    // ── Gerar PDF de uma negociação ───────────────────────────────────────────
    const handleGerarPDF = async (nota: NotaPromissoria) => {
        const parcelas = parcelasPorNota[nota.id] || [];
        const notasParaPDF: NotaPromissoriaParaImpressao[] = parcelas.map(p => ({
            numero_parcela: p.numero_parcela,
            total_parcelas: p.total_parcelas,
            data_vencimento: p.data_vencimento,
            valor: p.valor,
            credor_nome: nota.credor_nome,
            credor_cpf_cnpj: nota.credor_cpf_cnpj,
            devedor_nome: nota.devedor_nome,
            devedor_cpf_cnpj: nota.devedor_cpf_cnpj,
            devedor_logradouro: nota.devedor_logradouro,
            devedor_numero: nota.devedor_numero,
            devedor_bairro: nota.devedor_bairro,
            devedor_cidade: nota.devedor_cidade,
            devedor_uf: nota.devedor_uf,
            devedor_cep: nota.devedor_cep,
            local_pagamento: nota.local_pagamento,
            data_emissao: nota.data_emissao,
            descricao: nota.descricao,
            avalistas: nota.avalistas || []
        }));
        try {
            await generateNotaPromissoriaPDF({ notas: notasParaPDF });
            const ids = parcelas.map(p => p.id);
            const usuario = api.getCurrentUser();
            await api.marcarPdfGerado(ids, usuario?.name || 'Sistema');
        } catch (e: any) {
            alert('Erro ao gerar PDF: ' + e.message);
        }
    };

    const handleEnviarWhatsApp = (nota: NotaPromissoria) => {
        const tel = cliente.telefone?.replace(/\D/g, '') || '';
        const texto = encodeURIComponent(
            `Olá ${nota.devedor_nome}! Segue a nota promissória referente a "${nota.descricao}". ` +
            `Total: ${formatCurrency(nota.valor_total)} em ${nota.num_parcelas}x. ` +
            `Para visualizar ou obter o PDF, entre em contato conosco.`
        );
        window.open(`https://wa.me/55${tel}?text=${texto}`, '_blank');
    };

    return (
        <>
            {/* ── CARD DE RESUMO ── */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white mb-4 shadow-lg">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider">📋 Notas Promissórias</h3>
                        <p className="text-emerald-200 text-xs mt-0.5">Gestão completa de promissórias deste cliente</p>
                    </div>
                    <Button
                        onClick={() => setWizardOpen(true)}
                        className="bg-white/90 text-emerald-700 hover:bg-white font-black text-xs px-4 py-2 rounded-xl shadow-md border border-white/50 transition-all"
                    >
                        + Gerar Notas
                    </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                        { label: 'Em Aberto', val: parcelasAbertas.length + ' parcelas', sub: formatCurrency(valorAberto), color: 'bg-white/20' },
                        { label: 'Vencidas', val: parcelasVencidas.length + ' parcelas', sub: formatCurrency(parcelasVencidas.reduce((s, p) => s + p.valor, 0)), color: 'bg-red-500/30' },
                        { label: 'Recebido', val: formatCurrency(valorRecebido), sub: '', color: 'bg-emerald-500/30' },
                        { label: 'Negociações', val: notas.filter(n => n.situacao === 'ATIVA').length + ' ativas', sub: notas.length + ' total', color: 'bg-white/10' }
                    ].map(stat => (
                        <div key={stat.label} className={`${stat.color} rounded-xl p-2.5`}>
                            <p className="text-[10px] font-bold uppercase text-white/80">{stat.label}</p>
                            <p className="text-sm font-black text-white">{stat.val}</p>
                            {stat.sub && <p className="text-[10px] text-white/70">{stat.sub}</p>}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── LISTA DE NEGOCIAÇÕES ── */}
            {loading ? (
                <p className="text-center text-sm text-slate-500 py-4">⏳ Carregando notas...</p>
            ) : notas.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="text-sm font-bold text-slate-600">Nenhuma nota promissória emitida</p>
                    <p className="text-xs text-slate-400 mt-1">Clique em "+ Gerar Notas" para emitir a primeira.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notas.map(nota => {
                        const parcelas = parcelasPorNota[nota.id] || [];
                        const valorPago = parcelas.reduce((s, p) => s + (p.valor_pago || 0), 0);
                        const saldo = nota.valor_total - valorPago;
                        const cfg = notaSituacaoConfig[nota.situacao] || notaSituacaoConfig['ATIVA'];
                        const isExpanded = notaExpandida === nota.id;

                        return (
                            <div key={nota.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Cabeçalho da negociação */}
                                <div
                                    className="flex justify-between items-start p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => setNotaExpandida(isExpanded ? null : nota.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-sm text-slate-800 truncate">{nota.descricao}</p>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 mt-1 flex-wrap">
                                            <span className="text-xs text-slate-500">📅 {formatDateBR(nota.data_emissao)}</span>
                                            <span className="text-xs text-slate-500">💰 {formatCurrency(nota.valor_total)}</span>
                                            <span className="text-xs text-slate-500">{nota.num_parcelas}x</span>
                                            {saldo > 0 && nota.situacao === 'ATIVA' && (
                                                <span className="text-xs text-amber-600 font-bold">Saldo: {formatCurrency(saldo)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                        <span className="text-slate-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                                    </div>
                                </div>

                                {/* Ações */}
                                <div className="flex flex-wrap gap-1 px-3 pb-2 border-t border-slate-50 pt-1.5">
                                    <div className="flex gap-1 flex-wrap">
                                        <button
                                            onClick={() => handleGerarPDF(nota)}
                                            className="text-[10px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-lg transition-colors"
                                        >
                                            📄 Imprimir PDF
                                        </button>
                                        <button
                                            onClick={() => handleEnviarWhatsApp(nota)}
                                            className="text-[10px] font-bold bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded-lg transition-colors"
                                        >
                                            📲 WhatsApp
                                        </button>
                                        {nota.situacao === 'ATIVA' && (
                                            <button
                                                onClick={() => { setCancelamentoNotaId(nota.id); setCancelamentoOpen(true); }}
                                                className="text-[10px] font-bold bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded-lg transition-colors"
                                            >
                                                ❌ Cancelar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Lista de Parcelas expandida */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50 p-3">
                                        <h5 className="text-[10px] font-black text-slate-500 uppercase mb-2">Parcelas</h5>
                                        <div className="space-y-1.5">
                                            {parcelas.map(p => {
                                                const pcfg = situacaoConfig[p.situacao] || situacaoConfig['A_VENCER'];
                                                return (
                                                    <div key={p.id}
                                                        className="flex justify-between items-center bg-white rounded-xl px-3 py-2 border border-slate-100">
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-700 mr-2">
                                                                {String(p.numero_parcela).padStart(2, '0')}/{String(p.total_parcelas).padStart(2, '0')}
                                                            </span>
                                                            <span className="text-xs text-slate-500 mr-2">
                                                                {formatDateBR(p.data_vencimento)}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-800 mr-2">
                                                                {formatCurrency(p.valor)}
                                                            </span>
                                                            {p.valor_pago > 0 && (
                                                                <span className="text-[10px] text-emerald-600">
                                                                    Pago: {formatCurrency(p.valor_pago)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pcfg.color}`}>
                                                                {pcfg.label}
                                                            </span>
                                                            {(p.situacao === 'A_VENCER' || p.situacao === 'VENCIDA' || p.situacao === 'PARCIALMENTE_PAGA') && (
                                                                <button
                                                                    onClick={() => {
                                                                        setPagamentoParcela(p);
                                                                        setPagamentoOpen(true);
                                                                    }}
                                                                    className="text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded-lg transition-colors"
                                                                >
                                                                    💰 Pagar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── MODAIS ── */}
            <NotaPromissoriaModal
                isOpen={wizardOpen}
                onClose={() => setWizardOpen(false)}
                cliente={cliente}
                onGerado={carregarNotas}
            />
            <PagamentoModal
                isOpen={pagamentoOpen}
                onClose={() => setPagamentoOpen(false)}
                parcela={pagamentoParcela}
                onSalvo={carregarNotas}
            />
            <CancelamentoModal
                isOpen={cancelamentoOpen}
                onClose={() => setCancelamentoOpen(false)}
                notaId={cancelamentoNotaId}
                onCancelado={carregarNotas}
            />
        </>
    );
};
