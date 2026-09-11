import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ContratoCliente } from '../../types';
import { generateContratoPDF } from '../../services/pdfService';

interface ContratoViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    contrato: ContratoCliente | null;
}

export const ContratoViewModal: React.FC<ContratoViewModalProps> = ({
    isOpen,
    onClose,
    contrato
}) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [copiado, setCopiado] = useState(false);

    if (!isOpen || !contrato) return null;

    const handleDownloadPdf = async () => {
        try {
            setIsGeneratingPdf(true);
            await generateContratoPDF(
                contrato.conteudo_texto,
                contrato.dados_snapshot?.cliente?.nome || 'cliente',
                contrato.versao
            );
        } catch (error: any) {
            alert('Erro ao gerar PDF: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(contrato.conteudo_texto).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        });
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Permita pop-ups para imprimir o contrato.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${contrato.titulo} - ${contrato.dados_snapshot?.cliente?.nome || ''}</title>
                <style>
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 11pt;
                        line-height: 1.5;
                        color: #000;
                        margin: 20mm 20mm 20mm 25mm;
                        white-space: pre-wrap;
                        text-align: justify;
                    }
                    h1 {
                        text-align: center;
                        font-size: 13pt;
                        font-weight: bold;
                        margin-bottom: 20px;
                    }
                    @media print {
                        body { margin: 15mm; }
                    }
                </style>
            </head>
            <body>
                <div>${contrato.conteudo_texto.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
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

    const dataFormatada = new Date(contrato.created_at).toLocaleString('pt-BR');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`📄 ${contrato.titulo} — Gerado em ${dataFormatada}`}
        >
            <div className="space-y-4">
                {/* Barra de ações superior */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-xs text-slate-600">
                        <span className="font-bold text-slate-800">{contrato.titulo}</span> •
                        <span className="ml-1 text-slate-500">Versão gerada em {dataFormatada}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCopy}
                            className="text-xs"
                        >
                            {copiado ? '✓ Copiado!' : '📋 Copiar Texto'}
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
                            {isGeneratingPdf ? '⏳ Gerando...' : '📥 Baixar PDF'}
                        </Button>
                    </div>
                </div>

                {/* Área de Visualização do Documento (folha de papel formal) */}
                <div className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 shadow-inner max-h-[65vh] overflow-y-auto">
                    <div className="font-serif text-slate-900 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text selection:bg-indigo-100">
                        {contrato.conteudo_texto}
                    </div>
                </div>

                {/* Rodapé do modal */}
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="ghost" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
