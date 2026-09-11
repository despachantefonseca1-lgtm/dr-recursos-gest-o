import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { ContratoCliente } from '../../types';
import { generateContratoPDF } from '../../services/pdfService';
import { api } from '../../lib/api';

interface ContratoViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    contrato: ContratoCliente | null;
    onContratoAtualizado?: (contratoAtualizado: ContratoCliente) => void;
    onContratoExcluido?: (contratoId: string) => void;
}

export const ContratoViewModal: React.FC<ContratoViewModalProps> = ({
    isOpen,
    onClose,
    contrato,
    onContratoAtualizado,
    onContratoExcluido
}) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [copiado, setCopiado] = useState(false);

    // Modo de edição
    const [isEditing, setIsEditing] = useState(false);
    const [textoEditado, setTextoEditado] = useState('');
    const [tituloEditado, setTituloEditado] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (contrato) {
            setTextoEditado(contrato.conteudo_texto || '');
            setTituloEditado(contrato.titulo || '');
            setIsEditing(false);
        }
    }, [contrato, isOpen]);

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
                    @page {
                        size: A4 portrait;
                        margin: 12mm 14mm 12mm 14mm;
                    }
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 8.5pt;
                        line-height: 1.22;
                        color: #000;
                        margin: 0;
                        padding: 0;
                        white-space: pre-wrap;
                        text-align: justify;
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

    // Salvar edição manual
    const handleSalvarEdicao = async () => {
        if (!textoEditado.trim()) {
            alert('O conteúdo do contrato não pode ficar vazio.');
            return;
        }

        try {
            setIsSaving(true);
            const atualizado = await api.updateContratoCliente(contrato.id, contrato.cliente_id, {
                conteudo_texto: textoEditado,
                titulo: tituloEditado.trim() || contrato.titulo
            });

            setIsEditing(false);
            if (onContratoAtualizado) {
                onContratoAtualizado(atualizado);
            }
            alert('Contrato atualizado com sucesso!');
        } catch (error: any) {
            alert('Erro ao salvar contrato: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsSaving(false);
        }
    };

    // Excluir contrato
    const handleExcluir = async () => {
        const confirmou = window.confirm(
            `TEM CERTEZA? Deseja excluir permanentemente o "${contrato.titulo}"? Esta ação removerá este contrato da ficha do cliente.`
        );
        if (!confirmou) return;

        try {
            setIsDeleting(true);
            await api.deleteContratoCliente(contrato.id, contrato.cliente_id);
            if (onContratoExcluido) {
                onContratoExcluido(contrato.id);
            }
            onClose();
            alert('Contrato excluído com sucesso!');
        } catch (error: any) {
            alert('Erro ao excluir contrato: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsDeleting(false);
        }
    };

    const dataFormatada = new Date(contrato.created_at).toLocaleString('pt-BR');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `✏️ Editando: ${contrato.titulo}` : `📄 ${contrato.titulo} — Gerado em ${dataFormatada}`}
        >
            <div className="space-y-4">
                {/* Barra de ações superior */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-xs text-slate-600">
                        <span className="font-bold text-slate-800">{contrato.titulo}</span> •
                        <span className="ml-1 text-slate-500">Versão gerada em {dataFormatada}</span>
                        {contrato.updated_at && contrato.updated_at !== contrato.created_at && (
                            <span className="ml-1 text-amber-600 font-bold">(Editado)</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                    className="text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50"
                                >
                                    ✏️ Editar Contrato
                                </Button>
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
                            </>
                        ) : (
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setTextoEditado(contrato.conteudo_texto);
                                        setTituloEditado(contrato.titulo);
                                        setIsEditing(false);
                                    }}
                                    disabled={isSaving}
                                    className="text-xs"
                                >
                                    Cancelar Edição
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={handleSalvarEdicao}
                                    disabled={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                >
                                    {isSaving ? 'Salvando...' : '💾 Salvar Alterações'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Área de Conteúdo: Visualização ou Edição */}
                {!isEditing ? (
                    <div className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 shadow-inner max-h-[65vh] overflow-y-auto">
                        <div className="font-serif text-slate-900 text-xs leading-relaxed whitespace-pre-wrap select-text selection:bg-indigo-100">
                            {contrato.conteudo_texto}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                                label="Título da Versão"
                                value={tituloEditado}
                                onChange={e => setTituloEditado(e.target.value)}
                                placeholder="Ex: Contrato v1"
                            />
                            <div className="flex items-end">
                                <p className="text-[11px] text-slate-500 pb-2">
                                    💡 Você pode ajustar qualquer cláusula ou valor acordado livremente abaixo.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                Texto do Contrato
                            </label>
                            <textarea
                                value={textoEditado}
                                onChange={e => setTextoEditado(e.target.value)}
                                rows={20}
                                className="w-full p-4 font-serif text-xs leading-relaxed border-2 border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl bg-slate-50 focus:bg-white text-slate-900 resize-y"
                                placeholder="Texto do contrato..."
                            />
                        </div>
                    </div>
                )}

                {/* Rodapé do modal: Excluir à esquerda, Fechar à direita */}
                <div className="flex justify-between items-center pt-2 border-t">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleExcluir}
                        disabled={isDeleting || isSaving}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-bold"
                    >
                        {isDeleting ? 'Excluindo...' : '🗑️ Excluir Contrato'}
                    </Button>

                    <Button variant="ghost" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
