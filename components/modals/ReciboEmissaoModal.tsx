import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { RecursoCliente, RecursoServico, Infracao, ReciboCliente, ReciboInfracaoItem } from '../../types';
import { api } from '../../lib/api';
import {
    gerarTextoRecibo,
    formatarQualificacaoClienteRecibo,
    capitalizarPrimeiraLetra
} from '../../services/reciboService';
import {
    formatCurrency,
    valorPorExtenso,
    formatDateBR,
    formatDateExtenso
} from '../../services/contratoService';
import { generateReciboPDF } from '../../services/pdfService';
import { useUnidade } from '../../contexts/UnidadeContext';

interface ReciboEmissaoModalProps {
    isOpen: boolean;
    onClose: () => void;
    cliente: RecursoCliente;
    servico?: RecursoServico | null;
    infracoes: Infracao[];
    onReciboCriado?: (recibo: ReciboCliente) => void;
}

const getTodayString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const ReciboEmissaoModal: React.FC<ReciboEmissaoModalProps> = ({
    isOpen,
    onClose,
    cliente,
    servico,
    infracoes,
    onReciboCriado
}) => {
    const { unidadeAtual } = useUnidade();
    const [valor, setValor] = useState<number>(0);
    const [dataEmissao, setDataEmissao] = useState<string>(getTodayString());
    const [cidade, setCidade] = useState<string>('Bom Despacho');
    const [uf, setUf] = useState<string>('MG');
    const [infracoesSelecionadasIds, setInfracoesSelecionadasIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState<'CONFIG' | 'PREVIEW'>('CONFIG');

    // Inicializa valores ao abrir
    useEffect(() => {
        if (!isOpen) return;

        // Valor padrão: se veio de um serviço, pega valor_pago (ou valor_total)
        let valorInicial = 0;
        if (servico) {
            valorInicial = (servico.valor_pago && servico.valor_pago > 0)
                ? servico.valor_pago
                : (servico.valor_total || 0);
        }
        setValor(valorInicial);
        setDataEmissao(getTodayString());
        setCidade(unidadeAtual?.cidade || cliente.cidade || 'Bom Despacho');
        setUf(unidadeAtual?.uf || cliente.uf || 'MG');

        // Pré-selecionar infrações
        if (infracoes.length > 0) {
            // Se o serviço tiver vínculo com um veículo, seleciona infrações daquele veículo, ou a primeira
            if (servico?.veiculo_id) {
                // Seleciona todas do cliente por padrão para facilitar
                setInfracoesSelecionadasIds(new Set(infracoes.map(i => i.id)));
            } else {
                setInfracoesSelecionadasIds(new Set(infracoes.map(i => i.id)));
            }
        } else {
            setInfracoesSelecionadasIds(new Set());
        }

        setAbaAtiva('CONFIG');
    }, [isOpen, servico, cliente, infracoes]);

    const infracoesSelecionadas = useMemo(() => {
        return infracoes.filter(inf => infracoesSelecionadasIds.has(inf.id));
    }, [infracoes, infracoesSelecionadasIds]);

    const toggleInfracao = (id: string) => {
        setInfracoesSelecionadasIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selecionarTodasInfracoes = () => {
        setInfracoesSelecionadasIds(new Set(infracoes.map(i => i.id)));
    };

    const desmarcarTodasInfracoes = () => {
        setInfracoesSelecionadasIds(new Set());
    };

    const valorExtenso = useMemo(() => {
        if (!valor || valor <= 0) return 'zero reais';
        return capitalizarPrimeiraLetra(valorPorExtenso(valor));
    }, [valor]);

    const textoReciboGerado = useMemo(() => {
        return gerarTextoRecibo({
            cliente,
            servico,
            infracoesSelecionadas,
            valor,
            dataEmissao,
            cidade,
            uf
        });
    }, [cliente, servico, infracoesSelecionadas, valor, dataEmissao, cidade, uf]);

    // Baixar PDF
    const handleDownloadPdf = async () => {
        if (valor <= 0) {
            alert('Por favor, informe um valor válido para o recibo.');
            return;
        }

        try {
            setIsGeneratingPdf(true);
            await generateReciboPDF({
                cliente,
                valor,
                infracoes: infracoesSelecionadas,
                dataEmissao,
                cidade,
                uf
            });
        } catch (error: any) {
            alert('Erro ao gerar PDF do recibo: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Imprimir direto via navegador
    const handlePrint = () => {
        if (valor <= 0) {
            alert('Por favor, informe um valor válido para o recibo.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Permita pop-ups para imprimir o recibo.');
            return;
        }

        const qualificacao = formatarQualificacaoClienteRecibo(cliente);
        const valorFormatado = formatCurrency(valor);
        const pluralInfracao = infracoesSelecionadas.length > 1
            ? 'aos seguintes Autos de Infração:'
            : 'seguinte Auto de Infração:';

        let blocoInfracoesHtml = '';
        if (infracoesSelecionadas.length > 0) {
            blocoInfracoesHtml = infracoesSelecionadas.map(inf => `
                <div class="infracao-item">
                    <strong>Auto de Infração:</strong> ${inf.numeroAuto || '—'}, 
                    <strong>Placa do Veículo:</strong> ${inf.placa || '—'}, 
                    <strong>Infração:</strong> ${(inf.descricao || 'DEFESA ADMINISTRATIVA').toUpperCase()}, 
                    <strong>Data da Infração:</strong> ${formatDateBR(inf.dataInfracao)}
                </div>
            `).join('');
        } else {
            blocoInfracoesHtml = '<div class="infracao-item">Nenhum auto de infração especificado.</div>';
        }

        const dataExtenso = formatDateExtenso(dataEmissao);
        const localData = `${cidade}/${uf}, ${dataExtenso}.`;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Recibo de Pagamento - ${cliente.nome}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 32mm 24mm 28mm 24mm;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 11.2pt;
                        line-height: 1.55;
                        color: #000;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                    }
                    p {
                        text-align: justify;
                        text-justify: inter-word;
                        margin: 0 0 16px 0;
                    }
                    .infracao-bloco {
                        margin: 12px 0 20px 0;
                    }
                    .infracao-item {
                        margin-bottom: 8px;
                        line-height: 1.45;
                    }
                    .local-data {
                        margin-top: 32px;
                        margin-bottom: 50px;
                    }
                    .assinatura-bloco {
                        position: relative;
                        width: 320px;
                    }
                    .assinatura-img {
                        position: absolute;
                        bottom: 12px;
                        left: 15px;
                        width: 220px;
                        height: auto;
                        pointer-events: none;
                    }
                    .assinatura-linha {
                        border-bottom: 1px solid #000;
                        width: 290px;
                        margin-bottom: 6px;
                    }
                    .assinatura-nome {
                        font-size: 11pt;
                        margin-top: 4px;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <p>
                    <strong>RECEBI</strong> de ${qualificacao}, a importância de 
                    <strong>R$ ${valorFormatado} (${valorExtenso})</strong> referente ao pagamento de 
                    <strong>honorários advocatícios</strong> pela prestação de serviços jurídicos consistentes na 
                    <strong>análise técnica, elaboração e apresentação de recurso administrativo contra infração de trânsito</strong>, referente ao ${pluralInfracao}
                </p>

                <div class="infracao-bloco">
                    ${blocoInfracoesHtml}
                </div>

                <p>
                    Declaro que o valor acima mencionado foi recebido, dando à contratante plena, geral e irrevogável quitação exclusivamente quanto aos honorários advocatícios referentes ao serviço acima descrito, não abrangendo custas administrativas, taxas, despesas de protocolo ou quaisquer outros valores eventualmente devidos a órgãos públicos ou terceiros.
                </p>

                <div class="local-data">
                    ${localData}
                </div>

                <div class="assinatura-bloco">
                    <img src="${window.location.origin}/assinatura_israel_fonseca.png" class="assinatura-img" alt="Assinatura Israel Fonseca" />
                    <div class="assinatura-linha"></div>
                    <div class="assinatura-nome">Israel Fonseca</div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Salvar e emitir no banco / histórico
    const handleSalvarEmitir = async () => {
        if (valor <= 0) {
            alert('Por favor, informe um valor válido para o recibo.');
            return;
        }

        try {
            setIsSaving(true);

            const resumoInfracoes: ReciboInfracaoItem[] = infracoesSelecionadas.map(inf => ({
                id: inf.id,
                numeroAuto: inf.numeroAuto || '',
                placa: inf.placa || '',
                descricao: inf.descricao || '',
                dataInfracao: inf.dataInfracao || ''
            }));

            const numeroGerado = `REC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

            const novoRecibo = await api.createReciboCliente({
                cliente_id: cliente.id,
                unidade_id: unidadeAtual?.id,
                servico_id: servico?.id || undefined,
                numero_recibo: numeroGerado,
                valor,
                valor_extenso: valorExtenso,
                data_emissao: dataEmissao,
                cidade_emissao: `${cidade}/${uf}`,
                infracoes_ids: infracoesSelecionadas.map(i => i.id),
                infracoes_resumo: resumoInfracoes,
                conteudo_texto: textoReciboGerado
            });

            if (onReciboCriado) {
                onReciboCriado(novoRecibo);
            }

            alert('Recibo emitido e registrado com sucesso!');
            onClose();
        } catch (error: any) {
            alert('Erro ao salvar recibo: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`🧾 Emitir Recibo de Pagamento — ${cliente.nome}`}
        >
            <div className="space-y-4">
                {/* Abas internas: Configuração / Pré-visualização */}
                <div className="flex border-b pb-2 justify-between items-center">
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={() => setAbaAtiva('CONFIG')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                abaAtiva === 'CONFIG'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            ⚙️ Dados do Recibo
                        </button>
                        <button
                            type="button"
                            onClick={() => setAbaAtiva('PREVIEW')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                abaAtiva === 'PREVIEW'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            👁️ Pré-visualização Assinada
                        </button>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium">
                        Valor: <strong className="text-emerald-700">R$ {formatCurrency(valor)}</strong>
                    </div>
                </div>

                {/* ABA 1: CONFIGURAÇÃO */}
                {abaAtiva === 'CONFIG' && (
                    <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
                        {/* Bloco 1: Valor e Data */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-3">
                            <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wide">
                                💰 Valor e Emissão
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <Input
                                        label="Valor Recebido (R$) *"
                                        type="number"
                                        step="0.01"
                                        value={valor}
                                        onChange={e => setValor(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div>
                                    <Input
                                        label="Data do Recibo *"
                                        type="date"
                                        value={dataEmissao}
                                        onChange={e => setDataEmissao(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    <div className="col-span-2">
                                        <Input
                                            label="Cidade"
                                            value={cidade}
                                            onChange={e => setCidade(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Input
                                            label="UF"
                                            value={uf}
                                            onChange={e => setUf(e.target.value?.toUpperCase())}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Valor por extenso automático */}
                            <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 text-xs">
                                <span className="font-bold text-slate-500 block text-[10px] uppercase">
                                    Valor por extenso (calculado automaticamente):
                                </span>
                                <span className="font-semibold text-emerald-900 italic">
                                    "{valorExtenso}"
                                </span>
                            </div>
                        </div>

                        {/* Bloco 2: Seleção de Infrações */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                        🚗 Infrações Vinculadas a este Recibo
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        Marque as infrações cujo recurso está sendo quitado neste recibo:
                                    </p>
                                </div>
                                {infracoes.length > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={selecionarTodasInfracoes}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                                        >
                                            Todas
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            type="button"
                                            onClick={desmarcarTodasInfracoes}
                                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase"
                                        >
                                            Nenhuma
                                        </button>
                                    </div>
                                )}
                            </div>

                            {infracoes.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {infracoes.map(inf => {
                                        const isChecked = infracoesSelecionadasIds.has(inf.id);
                                        return (
                                            <div
                                                key={inf.id}
                                                onClick={() => toggleInfracao(inf.id)}
                                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}} // tratado no onClick do container
                                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <div className="flex-1 text-xs">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-slate-800">
                                                            {inf.numeroAuto || 'Sem Auto'} • {inf.placa || 'Sem Placa'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {formatDateBR(inf.dataInfracao)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                                                        {inf.descricao || 'Defesa Administrativa de Multa'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                    ⚠️ Nenhuma infração cadastrada para este cliente ainda. O recibo poderá ser emitido, mas é recomendável cadastrar a infração na aba anterior para constar detalhada no texto.
                                </div>
                            )}
                        </div>

                        {/* Bloco 3: Dados Cadastrais do Cliente (Conferência) */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">
                                👤 Dados do Cliente (Extraídos do Cadastro/Procuração)
                            </h4>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                {formatarQualificacaoClienteRecibo(cliente)}
                            </p>
                        </div>
                    </div>
                )}

                {/* ABA 2: PRÉ-VISUALIZAÇÃO COM ASSINATURA */}
                {abaAtiva === 'PREVIEW' && (
                    <div className="space-y-3">
                        <div className="bg-slate-100 p-2.5 rounded-xl text-center text-xs text-slate-600 font-medium border border-slate-200">
                            🔍 Esta é a prévia exata do recibo, formatada com a assinatura digitalizada de <strong>Israel Fonseca</strong> pronta para impressão ou PDF.
                        </div>

                        <div className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 shadow-inner max-h-[60vh] overflow-y-auto font-serif text-slate-900 text-xs sm:text-[13px] leading-relaxed select-text">
                            <p className="text-justify mb-4">
                                <strong>RECEBI</strong> de {formatarQualificacaoClienteRecibo(cliente)}, a importância de{' '}
                                <strong>R$ {formatCurrency(valor)} ({valorExtenso})</strong> referente ao pagamento de{' '}
                                <strong>honorários advocatícios</strong> pela prestação de serviços jurídicos consistentes na{' '}
                                <strong>análise técnica, elaboração e apresentação de recurso administrativo contra infração de trânsito</strong>, referente ao{' '}
                                {infracoesSelecionadas.length > 1 ? 'aos seguintes Autos de Infração:' : 'seguinte Auto de Infração:'}
                            </p>

                            <div className="my-3 space-y-1.5 pl-2 border-l-2 border-slate-300">
                                {infracoesSelecionadas.length > 0 ? (
                                    infracoesSelecionadas.map(inf => (
                                        <div key={inf.id} className="text-slate-800">
                                            <strong>Auto de Infração:</strong> {inf.numeroAuto || '—'},{' '}
                                            <strong>Placa do Veículo:</strong> {inf.placa || '—'},{' '}
                                            <strong>Infração:</strong> {(inf.descricao || 'DEFESA ADMINISTRATIVA').toUpperCase()},{' '}
                                            <strong>Data da Infração:</strong> {formatDateBR(inf.dataInfracao)}
                                        </div>
                                    ))
                                ) : (
                                    <div className="italic text-slate-400">Nenhum auto de infração especificado.</div>
                                )}
                            </div>

                            <p className="text-justify mt-4 mb-6">
                                Declaro que o valor acima mencionado foi recebido, dando à contratante plena, geral e irrevogável quitação exclusivamente quanto aos honorários advocatícios referentes ao serviço acima descrito, não abrangendo custas administrativas, taxas, despesas de protocolo ou quaisquer outros valores eventualmente devidos a órgãos públicos ou terceiros.
                            </p>

                            <div className="my-6">
                                {cidade}/{uf}, {formatDateExtenso(dataEmissao)}.
                            </div>

                            {/* Assinatura sobreposta */}
                            <div className="mt-8 pt-4 relative inline-block">
                                <img
                                    src="/assinatura_israel_fonseca.png"
                                    alt="Assinatura Israel Fonseca"
                                    className="absolute -top-7 left-2 w-48 h-auto pointer-events-none select-none"
                                />
                                <div className="border-b border-black w-64 mb-1"></div>
                                <div className="font-sans text-xs font-medium text-slate-900">Israel Fonseca</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Barra inferior de ações */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="text-xs font-bold"
                        >
                            🖨️ Imprimir
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={isGeneratingPdf}
                            className="text-xs font-bold text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                        >
                            {isGeneratingPdf ? '⏳ Gerando...' : '📥 Baixar PDF'}
                        </Button>

                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handleSalvarEmitir}
                            disabled={isSaving || valor <= 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                            {isSaving ? '⏳ Salvando...' : '💾 Emitir e Salvar'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
