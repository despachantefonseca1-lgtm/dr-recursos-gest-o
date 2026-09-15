import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ReciboCliente, RecursoCliente } from '../../types';
import { api } from '../../lib/api';
import { generateReciboPDF } from '../../services/pdfService';
import { formatCurrency, formatDateBR, formatDateExtenso } from '../../services/contratoService';
import { formatarQualificacaoClienteRecibo } from '../../services/reciboService';

interface ReciboViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    recibo: ReciboCliente;
    cliente: RecursoCliente;
    onReciboExcluido?: (id: string) => void;
}

export const ReciboViewModal: React.FC<ReciboViewModalProps> = ({
    isOpen,
    onClose,
    recibo,
    cliente,
    onReciboExcluido
}) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [copiado, setCopiado] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(recibo.conteudo_texto).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        });
    };

    const handleDownloadPdf = async () => {
        try {
            setIsGeneratingPdf(true);
            await generateReciboPDF({
                cliente,
                valor: recibo.valor,
                infracoes: recibo.infracoes_resumo || [],
                dataEmissao: recibo.data_emissao,
                cidade: recibo.cidade_emissao?.split('/')[0]?.trim() || 'Bom Despacho',
                uf: recibo.cidade_emissao?.split('/')[1]?.trim() || 'MG',
                numeroRecibo: recibo.numero_recibo
            });
        } catch (error: any) {
            alert('Erro ao gerar PDF: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Permita pop-ups para imprimir o recibo.');
            return;
        }

        const qualificacao = formatarQualificacaoClienteRecibo(cliente);
        const valorFormatado = formatCurrency(recibo.valor);
        const pluralInfracao = (recibo.infracoes_resumo && recibo.infracoes_resumo.length > 1)
            ? 'aos seguintes Autos de Infração:'
            : 'seguinte Auto de Infração:';

        let blocoInfracoesHtml = '';
        if (recibo.infracoes_resumo && recibo.infracoes_resumo.length > 0) {
            blocoInfracoesHtml = recibo.infracoes_resumo.map(inf => `
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

        const dataExtenso = formatDateExtenso(recibo.data_emissao);
        const localData = `${recibo.cidade_emissao || 'Bom Despacho/MG'}, ${dataExtenso}.`;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Recibo ${recibo.numero_recibo} - ${cliente.nome}</title>
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
                    <strong>R$ ${valorFormatado} (${recibo.valor_extenso})</strong> referente ao pagamento de 
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

    const handleExcluir = async () => {
        const confirmou = window.confirm(
            `TEM CERTEZA? Deseja excluir permanentemente o Recibo "${recibo.numero_recibo}" de R$ ${formatCurrency(recibo.valor)}?`
        );
        if (!confirmou) return;

        try {
            setIsDeleting(true);
            await api.deleteReciboCliente(recibo.id, recibo.cliente_id);
            if (onReciboExcluido) {
                onReciboExcluido(recibo.id);
            }
            onClose();
            alert('Recibo excluído com sucesso!');
        } catch (error: any) {
            alert('Erro ao excluir recibo: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsDeleting(false);
        }
    };

    const dataEmissaoFormatada = new Date(recibo.created_at || recibo.data_emissao).toLocaleDateString('pt-BR');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`📄 Recibo ${recibo.numero_recibo} — R$ ${formatCurrency(recibo.valor)}`}
        >
            <div className="space-y-4">
                {/* Barra de ações superior */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-xs text-slate-600">
                        <span className="font-bold text-slate-800">{recibo.numero_recibo}</span> •
                        <span className="ml-1 text-slate-500">Emitido em {dataEmissaoFormatada}</span> •
                        <span className="ml-1 font-bold text-emerald-700">R$ {formatCurrency(recibo.valor)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCopy}
                            className="text-xs"
                        >
                            {copiado ? '✓ Copiado!' : '📋 Copiar'}
                        </Button>
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
                            variant="primary"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={isGeneratingPdf}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                        >
                            {isGeneratingPdf ? '⏳ Gerando...' : '📥 Baixar PDF (A4)'}
                        </Button>
                    </div>
                </div>

                {/* Exibição Visual do Recibo */}
                <div className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 shadow-inner max-h-[65vh] overflow-y-auto font-serif text-slate-900 text-xs sm:text-[13px] leading-relaxed select-text">
                    <p className="text-justify mb-4">
                        <strong>RECEBI</strong> de {formatarQualificacaoClienteRecibo(cliente)}, a importância de{' '}
                        <strong>R$ {formatCurrency(recibo.valor)} ({recibo.valor_extenso})</strong> referente ao pagamento de{' '}
                        <strong>honorários advocatícios</strong> pela prestação de serviços jurídicos consistentes na{' '}
                        <strong>análise técnica, elaboração e apresentação de recurso administrativo contra infração de trânsito</strong>, referente ao{' '}
                        {(recibo.infracoes_resumo && recibo.infracoes_resumo.length > 1) ? 'aos seguintes Autos de Infração:' : 'seguinte Auto de Infração:'}
                    </p>

                    <div className="my-3 space-y-1.5 pl-2 border-l-2 border-slate-300">
                        {recibo.infracoes_resumo && recibo.infracoes_resumo.length > 0 ? (
                            recibo.infracoes_resumo.map((inf, idx) => (
                                <div key={inf.id || idx} className="text-slate-800">
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
                        {recibo.cidade_emissao || 'Bom Despacho/MG'}, {formatDateExtenso(recibo.data_emissao)}.
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

                {/* Rodapé: Excluir e Fechar */}
                <div className="flex justify-between items-center pt-2 border-t">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleExcluir}
                        disabled={isDeleting}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-bold"
                    >
                        {isDeleting ? 'Excluindo...' : '🗑️ Excluir Recibo'}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                    >
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
