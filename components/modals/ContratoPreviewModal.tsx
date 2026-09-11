import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
    RecursoCliente,
    RecursoVeiculo,
    Infracao,
    RecursoServico,
    FaseRecursal,
    ContratoSnapshot,
    ContratoInfracaoItem,
    ContratoPagamentoInfo
} from '../../types';
import {
    ESCRITORIO_PADRAO,
    formatCurrency,
    validarDadosContrato,
    formatDateBR
} from '../../services/contratoService';

interface ContratoPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    cliente: RecursoCliente;
    veiculos: RecursoVeiculo[];
    infracoes: Infracao[];
    servicos: RecursoServico[];
    versaoDestino: number;
    onConfirmarGeracao: (snapshot: ContratoSnapshot) => Promise<void>;
}

export const ContratoPreviewModal: React.FC<ContratoPreviewModalProps> = ({
    isOpen,
    onClose,
    cliente,
    veiculos,
    infracoes,
    servicos,
    versaoDestino,
    onConfirmarGeracao
}) => {
    // Data de hoje (YYYY-MM-DD)
    const getTodayDate = (): string => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Estados do Formulário da Prévia
    const [selectedVeiculoId, setSelectedVeiculoId] = useState<string>('');
    const [selectedInfracoesIds, setSelectedInfracoesIds] = useState<Set<string>>(new Set());
    const [faseAdministrativa, setFaseAdministrativa] = useState<FaseRecursal>(FaseRecursal.DEFESA_PREVIA);
    const [dataContrato, setDataContrato] = useState<string>(getTodayDate());

    // Pagamento
    const [tipoPagamento, setTipoPagamento] = useState<'A_VISTA' | 'PARCELADO'>('A_VISTA');
    const [formaPagamento, setFormaPagamento] = useState<string>('Pix');
    const [valorHonorarios, setValorHonorarios] = useState<number>(0);
    const [numParcelas, setNumParcelas] = useState<number>(1);
    const [valorParcela, setValorParcela] = useState<number>(0);
    const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState<string>(getTodayDate());
    const [observacaoPagamento, setObservacaoPagamento] = useState<string>('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [erroValidacao, setErroValidacao] = useState<string | null>(null);

    // Inicialização ao abrir modal
    useEffect(() => {
        if (!isOpen) return;

        setErroValidacao(null);
        setDataContrato(getTodayDate());

        // Veículo inicial: primeiro veículo do cliente
        if (veiculos.length > 0) {
            setSelectedVeiculoId(veiculos[0].id);
        } else {
            setSelectedVeiculoId('');
        }

        // Infrações iniciais: todas selecionadas por padrão
        const todosIds = new Set(infracoes.map(inf => inf.id));
        setSelectedInfracoesIds(todosIds);

        // Fase recursal inicial: detectar fase mais recente/relevante das infrações
        if (infracoes.length > 0) {
            const hasDefesa = infracoes.some(i => i.faseRecursal === FaseRecursal.DEFESA_PREVIA);
            const hasJari = infracoes.some(i => i.faseRecursal === FaseRecursal.PRIMEIRA_INSTANCIA);
            if (hasDefesa) {
                setFaseAdministrativa(FaseRecursal.DEFESA_PREVIA);
            } else if (hasJari) {
                setFaseAdministrativa(FaseRecursal.PRIMEIRA_INSTANCIA);
            } else {
                setFaseAdministrativa(infracoes[0].faseRecursal || FaseRecursal.DEFESA_PREVIA);
            }
        } else {
            setFaseAdministrativa(FaseRecursal.DEFESA_PREVIA);
        }

        // Pré-carregamento do pagamento a partir do último serviço financeiro cadastrado, se existir
        if (servicos.length > 0) {
            const ultimoServico = servicos[0];
            const vTotal = ultimoServico.valor_total || 0;
            setValorHonorarios(vTotal);
            setValorParcela(vTotal);
            setTipoPagamento('A_VISTA');
            setFormaPagamento('Pix');
        } else {
            setValorHonorarios(0);
            setValorParcela(0);
            setTipoPagamento('A_VISTA');
            setFormaPagamento('Pix');
        }
    }, [isOpen, veiculos, infracoes, servicos]);

    // Recalcular valor da parcela quando número de parcelas ou valor total mudar
    const handleValorTotalChange = (val: number) => {
        setValorHonorarios(val);
        if (numParcelas > 0) {
            setValorParcela(Math.round((val / numParcelas) * 100) / 100);
        }
    };

    const handleNumParcelasChange = (num: number) => {
        const p = Math.max(1, num);
        setNumParcelas(p);
        if (valorHonorarios > 0) {
            setValorParcela(Math.round((valorHonorarios / p) * 100) / 100);
        }
    };

    const handleTipoPagamentoChange = (tipo: 'A_VISTA' | 'PARCELADO') => {
        setTipoPagamento(tipo);
        if (tipo === 'A_VISTA') {
            setNumParcelas(1);
            setValorParcela(valorHonorarios);
        } else {
            if (numParcelas <= 1) {
                setNumParcelas(2);
                setValorParcela(Math.round((valorHonorarios / 2) * 100) / 100);
            }
        }
    };

    const toggleInfracao = (id: string) => {
        setSelectedInfracoesIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Montagem do snapshot e submissão
    const handleConfirmar = async () => {
        setErroValidacao(null);

        // Montar endereço completo
        const enderecoCompleto = cliente.logradouro
            ? `${cliente.logradouro}, nº ${cliente.numero || 's/n'}${cliente.bairro ? `, Bairro ${cliente.bairro}` : ''}, ${cliente.cidade || ''}/${cliente.uf || ''}, CEP ${cliente.cep || ''}`
            : cliente.endereco || 'Endereço não informado';

        // Veículo selecionado
        const veiculoObj = veiculos.find(v => v.id === selectedVeiculoId) || (veiculos.length > 0 ? veiculos[0] : null);

        // Itens de infração selecionados
        const infracoesSelecionadas: ContratoInfracaoItem[] = infracoes
            .filter(inf => selectedInfracoesIds.has(inf.id))
            .map(inf => ({
                id: inf.id,
                numero_ait: inf.numeroAuto || '',
                descricao: inf.descricao || 'Infração de trânsito',
                orgao_autuador: inf.orgao_responsavel || 'Órgão de Trânsito competente',
                data: inf.dataInfracao || '',
                fase_atual: inf.faseRecursal || FaseRecursal.DEFESA_PREVIA,
                prazo: inf.dataLimiteProtocolo || undefined,
                veiculo_placa: veiculoObj?.placa || inf.placa || '',
                veiculo_marca_modelo: veiculoObj ? `${veiculoObj.marca} ${veiculoObj.modelo}`.trim() : ''
            }));

        // Dados de pagamento
        const pagamentoInfo: ContratoPagamentoInfo = {
            valor_honorarios: valorHonorarios,
            forma_pagamento: formaPagamento,
            tipo_pagamento: tipoPagamento,
            numero_parcelas: tipoPagamento === 'A_VISTA' ? 1 : numParcelas,
            valor_parcela: tipoPagamento === 'A_VISTA' ? valorHonorarios : valorParcela,
            data_primeiro_vencimento: tipoPagamento === 'PARCELADO' ? dataPrimeiroVencimento : undefined,
            observacao: observacaoPagamento.trim() || undefined
        };

        const snapshot: ContratoSnapshot = {
            cliente: {
                id: cliente.id,
                nome: cliente.nome || '',
                cpf_cnpj: cliente.cpf || '',
                rg_ie: cliente.rg ? `${cliente.rg} ${cliente.rg_orgao_emissor || ''}/${cliente.rg_uf || ''}`.trim() : undefined,
                estado_civil: cliente.estado_civil || '',
                profissao: cliente.profissao || '',
                endereco_completo: enderecoCompleto,
                telefone: cliente.telefone || ''
            },
            veiculo: {
                id: veiculoObj?.id,
                placa: veiculoObj?.placa || '',
                marca_modelo: veiculoObj ? `${veiculoObj.marca} ${veiculoObj.modelo}`.trim() : '',
                renavam: veiculoObj?.renavam
            },
            infracoes: infracoesSelecionadas,
            pagamento: pagamentoInfo,
            escritorio: ESCRITORIO_PADRAO,
            fase_administrativa_contratada: faseAdministrativa,
            data_geracao: dataContrato
        };

        // Validação obrigatória da Seção 12
        const validacao = validarDadosContrato(snapshot);
        if (!validacao.isValid) {
            setErroValidacao(validacao.errorMessage || 'Verifique os dados obrigatórios do contrato.');
            return;
        }

        try {
            setIsSubmitting(true);
            await onConfirmarGeracao(snapshot);
        } catch (error: any) {
            setErroValidacao('Erro ao gerar contrato: ' + (error.message || 'Erro inesperado'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const veiculoSelecionado = veiculos.find(v => v.id === selectedVeiculoId);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`📑 Prévia e Confirmação de Dados — Contrato v${versaoDestino}`}
        >
            <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
                {/* Banner de Aviso */}
                <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl">
                    <p className="text-xs text-indigo-900 font-medium">
                        Confira abaixo os dados que serão inseridos no contrato de prestação de serviços advocatícios. O texto das cláusulas jurídicas é estritamente padronizado e determinístico.
                    </p>
                </div>

                {/* Alerta de erro de validação */}
                {erroValidacao && (
                    <div className="bg-rose-50 border-2 border-rose-300 p-3.5 rounded-xl text-rose-800 text-xs font-bold flex items-start gap-2">
                        <span className="text-base">⚠️</span>
                        <div>{erroValidacao}</div>
                    </div>
                )}

                {/* 1. DADOS DO CLIENTE */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-2">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">1. Dados do Contratante (Cliente)</h4>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Snapshot Automático</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                        <div>
                            <span className="text-slate-400 block font-bold text-[10px] uppercase">Nome:</span>
                            <span className="font-bold text-slate-800">{cliente.nome || '—'}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-bold text-[10px] uppercase">CPF/CNPJ:</span>
                            <span className="font-bold text-slate-800">{cliente.cpf || '— (Não informado)'}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-bold text-[10px] uppercase">Telefone:</span>
                            <span className="font-bold text-slate-800">{cliente.telefone || '—'}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                            <span className="text-slate-400 block font-bold text-[10px] uppercase">Endereço Residencial:</span>
                            <span className="font-semibold text-slate-700">
                                {cliente.logradouro
                                    ? `${cliente.logradouro}, nº ${cliente.numero || 's/n'}${cliente.bairro ? `, Bairro ${cliente.bairro}` : ''}, ${cliente.cidade || ''}/${cliente.uf || ''}`
                                    : cliente.endereco || '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. DADOS DO VEÍCULO */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">2. Veículo Vinculado ao Contrato</h4>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Selecione o Veículo</span>
                    </div>

                    {veiculos.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-bold">
                            ⚠️ Nenhum veículo cadastrado para este cliente. Cadastre ao menos um veículo na aba "Veículos" antes de gerar o contrato.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Select
                                label="Veículo Principal"
                                value={selectedVeiculoId}
                                onChange={e => setSelectedVeiculoId(e.target.value)}
                            >
                                {veiculos.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.placa} — {v.marca} {v.modelo} ({v.tipo_vinculo})
                                    </option>
                                ))}
                            </Select>
                            {veiculoSelecionado && (
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs flex flex-col justify-center">
                                    <p><strong className="text-slate-500 text-[10px] uppercase">Placa:</strong> <span className="font-bold text-indigo-700">{veiculoSelecionado.placa}</span></p>
                                    <p><strong className="text-slate-500 text-[10px] uppercase">Renavam:</strong> <span className="font-medium text-slate-700">{veiculoSelecionado.renavam || '—'}</span></p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. DADOS DAS INFRAÇÕES */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <div>
                            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">3. Infrações Abrangidas no Contrato</h4>
                            <p className="text-[10px] text-slate-500">Marque as autuações que constarão na cláusula "DO OBJETO":</p>
                        </div>
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                            {selectedInfracoesIds.size} de {infracoes.length}
                        </span>
                    </div>

                    {infracoes.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-bold">
                            ⚠️ Nenhuma infração vinculada a este cliente. Cadastre ao menos uma infração na aba "Infrações" antes de gerar o contrato.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {infracoes.map(inf => {
                                const isChecked = selectedInfracoesIds.has(inf.id);
                                return (
                                    <label
                                        key={inf.id}
                                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                            isChecked
                                                ? 'bg-indigo-50/50 border-indigo-300'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleInfracao(inf.id)}
                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <div className="flex-1 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-800">
                                                    Auto: {inf.numeroAuto || 'SEM NÚMERO'}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {inf.faseRecursal?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 text-[11px] truncate mt-0.5">{inf.descricao || 'Sem descrição'}</p>
                                            <p className="text-slate-400 text-[10px] mt-0.5">
                                                Órgão: {inf.orgao_responsavel || 'DETRAN/DER/PRF'} • Data: {inf.dataInfracao ? formatDateBR(inf.dataInfracao) : '—'}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 4. FASE ADMINISTRATIVA CONTRATADA */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">4. Fase Administrativa da Contratação</h4>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Regra da Seção 6</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <Select
                            label="Fase Inicial da Contratação"
                            value={faseAdministrativa}
                            onChange={e => setFaseAdministrativa(e.target.value as FaseRecursal)}
                        >
                            <option value={FaseRecursal.DEFESA_PREVIA}>Defesa Prévia / Defesa da Autuação</option>
                            <option value={FaseRecursal.PRIMEIRA_INSTANCIA}>1ª Instância (JARI)</option>
                            <option value={FaseRecursal.SEGUNDA_INSTANCIA}>2ª Instância (CETRAN)</option>
                        </Select>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Texto Jurídico resultante:</span>
                            <p className="text-slate-700 font-medium text-[11px] mt-0.5">
                                {faseAdministrativa === FaseRecursal.DEFESA_PREVIA &&
                                    'Defesa da Autuação/Defesa Prévia, Recurso à JARI e recurso administrativo em segunda instância.'}
                                {faseAdministrativa === FaseRecursal.PRIMEIRA_INSTANCIA &&
                                    'Recurso à JARI e recurso administrativo em segunda instância, se cabível.'}
                                {faseAdministrativa === FaseRecursal.SEGUNDA_INSTANCIA &&
                                    'recurso administrativo em segunda instância.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 5. DADOS DO PAGAMENTO E HONORÁRIOS */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">5. Honorários e Forma de Pagamento</h4>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Cláusula DOS HONORÁRIOS</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input
                            label="Valor Total dos Honorários (R$) *"
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={valorHonorarios || ''}
                            onChange={e => handleValorTotalChange(parseFloat(e.target.value) || 0)}
                            placeholder="0,00"
                        />
                        <Select
                            label="Tipo de Pagamento"
                            value={tipoPagamento}
                            onChange={e => handleTipoPagamentoChange(e.target.value as any)}
                        >
                            <option value="A_VISTA">À Vista</option>
                            <option value="PARCELADO">Parcelado</option>
                        </Select>
                        <Select
                            label="Forma / Meio de Pagamento *"
                            value={formaPagamento}
                            onChange={e => setFormaPagamento(e.target.value)}
                        >
                            <option value="Pix">Pix</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Cartão de Débito">Cartão de Débito</option>
                            <option value="Nota Promissória">Nota Promissória</option>
                            <option value="Boleto Bancário">Boleto Bancário</option>
                            <option value="Transferência Bancária">Transferência Bancária</option>
                        </Select>
                    </div>

                    {tipoPagamento === 'PARCELADO' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <Input
                                label="Qtd. Parcelas *"
                                type="number"
                                min="2"
                                max="60"
                                value={numParcelas}
                                onChange={e => handleNumParcelasChange(parseInt(e.target.value, 10) || 1)}
                            />
                            <Input
                                label="Valor da Parcela (R$)"
                                type="number"
                                step="0.01"
                                value={valorParcela}
                                onChange={e => setValorParcela(parseFloat(e.target.value) || 0)}
                            />
                            <Input
                                label="1º Vencimento *"
                                type="date"
                                value={dataPrimeiroVencimento}
                                onChange={e => setDataPrimeiroVencimento(e.target.value)}
                            />
                        </div>
                    )}

                    <Input
                        label="Observação de Pagamento (Opcional)"
                        value={observacaoPagamento}
                        onChange={e => setObservacaoPagamento(e.target.value)}
                        placeholder="Ex: Entrada no ato e saldo parcelado / pagamento mediante liberação..."
                    />

                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                        <span className="font-bold text-[10px] uppercase text-emerald-700 block">Resumo dos Honorários:</span>
                        <p className="font-semibold mt-0.5">
                            Total: R$ {formatCurrency(valorHonorarios)} • {tipoPagamento === 'A_VISTA' ? 'À vista' : `${numParcelas}x de R$ ${formatCurrency(valorParcela)}`} ({formaPagamento})
                        </p>
                    </div>
                </div>

                {/* 6. DATA E ESCRITÓRIO */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <Input
                        label="Data de Emissão do Contrato *"
                        type="date"
                        value={dataContrato}
                        onChange={e => setDataContrato(e.target.value)}
                    />
                    <div className="text-xs text-slate-500">
                        <strong className="block text-slate-700">Contratado / Advogado:</strong>
                        <span>{ESCRITORIO_PADRAO.nome} — OAB/{ESCRITORIO_PADRAO.uf_oab} nº {ESCRITORIO_PADRAO.numero_oab}</span>
                    </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="flex justify-end gap-3 pt-3 border-t">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleConfirmar}
                        disabled={isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6"
                    >
                        {isSubmitting ? '⏳ Gerando Contrato...' : '📑 Gerar Contrato'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
