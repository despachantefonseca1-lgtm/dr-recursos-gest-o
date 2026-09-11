import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import {
    RecursoCliente,
    RecursoVeiculo,
    RecursoServico,
    Infracao,
    ContratoCliente,
    ContratoSnapshot
} from '../../types';
import { api } from '../../lib/api';
import { ContratoPreviewModal } from './ContratoPreviewModal';
import { ContratoViewModal } from './ContratoViewModal';
import { gerarTextoContrato, formatCurrency } from '../../services/contratoService';
import { generateContratoPDF } from '../../services/pdfService';

interface ContratoSecaoProps {
    clienteId: string;
    cliente: RecursoCliente;
    veiculos: RecursoVeiculo[];
    servicos: RecursoServico[];
    infracoes: Infracao[];
}

export const ContratoSecao: React.FC<ContratoSecaoProps> = ({
    clienteId,
    cliente,
    veiculos,
    servicos,
    infracoes
}) => {
    const [contratos, setContratos] = useState<ContratoCliente[]>([]);
    const [loading, setLoading] = useState(true);

    // Modais
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingContrato, setViewingContrato] = useState<ContratoCliente | null>(null);

    const carregarContratos = useCallback(async () => {
        if (!clienteId) return;
        setLoading(true);
        try {
            const data = await api.getContratosCliente(clienteId);
            setContratos(data);
        } catch (error) {
            console.error('Erro ao carregar contratos do cliente:', error);
        } finally {
            setLoading(false);
        }
    }, [clienteId]);

    useEffect(() => {
        carregarContratos();
    }, [carregarContratos]);

    const ultimoContrato = contratos.length > 0 ? contratos[0] : null;
    const versaoProxima = ultimoContrato ? ultimoContrato.versao + 1 : 1;

    // Ação ao confirmar geração na prévia
    const handleConfirmarGeracao = async (snapshot: ContratoSnapshot) => {
        const textoContrato = gerarTextoContrato(snapshot);
        const currentUser = api.getCurrentUser();

        const novoContratoPayload: Omit<ContratoCliente, 'id' | 'created_at' | 'updated_at'> = {
            cliente_id: clienteId,
            versao: versaoProxima,
            titulo: `Contrato v${versaoProxima}`,
            conteudo_texto: textoContrato,
            dados_snapshot: snapshot,
            criado_por: currentUser?.name || 'Sistema'
        };

        const criado = await api.createContratoCliente(novoContratoPayload);

        setIsPreviewModalOpen(false);
        await carregarContratos();

        // Abre automaticamente o modal de visualização do contrato recém-gerado
        setViewingContrato(criado);
        setIsViewModalOpen(true);
    };

    const handleVisualizar = (c: ContratoCliente) => {
        setViewingContrato(c);
        setIsViewModalOpen(true);
    };

    const handleBaixarPdf = async (c: ContratoCliente) => {
        try {
            await generateContratoPDF(
                c.conteudo_texto,
                c.dados_snapshot?.cliente?.nome || cliente.nome || 'cliente',
                c.versao
            );
        } catch (error: any) {
            alert('Erro ao baixar PDF: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleExcluirContrato = async (c: ContratoCliente) => {
        const confirmou = window.confirm(
            `TEM CERTEZA? Deseja excluir permanentemente o "${c.titulo}"? Caso todas as versões sejam excluídas, o status do cliente voltará para "Não gerado".`
        );
        if (!confirmou) return;

        try {
            await api.deleteContratoCliente(c.id, clienteId);
            await carregarContratos();
            if (viewingContrato?.id === c.id) {
                setIsViewModalOpen(false);
                setViewingContrato(null);
            }
            alert('Contrato excluído com sucesso!');
        } catch (error: any) {
            alert('Erro ao excluir contrato: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleContratoAtualizado = async (atualizado: ContratoCliente) => {
        setViewingContrato(atualizado);
        await carregarContratos();
    };

    const handleContratoExcluido = async () => {
        setIsViewModalOpen(false);
        setViewingContrato(null);
        await carregarContratos();
    };

    return (
        <div className="space-y-5">
            {/* Header da Seção CONTRATO */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-slate-50 to-indigo-50/50 p-4 rounded-2xl border border-slate-200 gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📑</span>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            Contrato de Prestação de Serviços
                        </h4>
                        {ultimoContrato ? (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Gerado (v{ultimoContrato.versao})
                            </span>
                        ) : (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                Não gerado
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Gere e gerencie o Contrato de Defesa Administrativa de Infrações de Trânsito do cliente.
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {ultimoContrato ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVisualizar(ultimoContrato)}
                                className="font-bold text-indigo-700 border-indigo-300 hover:bg-indigo-50 flex-1 sm:flex-initial text-xs"
                            >
                                👁️ Visualizar / Editar
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setIsPreviewModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex-1 sm:flex-initial text-xs shadow"
                            >
                                ➕ Gerar Nova Versão (v{versaoProxima})
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setIsPreviewModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md px-5"
                        >
                            📑 Gerar Contrato
                        </Button>
                    )}
                </div>
            </div>

            {/* Card de Status do Contrato Mais Recente */}
            {ultimoContrato ? (
                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
                                Versão Vigente Atual
                            </span>
                            <h5 className="font-black text-slate-800 text-base flex items-center gap-2">
                                {ultimoContrato.titulo}
                                {ultimoContrato.updated_at && ultimoContrato.updated_at !== ultimoContrato.created_at && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        Editado
                                    </span>
                                )}
                            </h5>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                            <span>Gerado em: </span>
                            <strong className="text-slate-700">
                                {new Date(ultimoContrato.created_at).toLocaleString('pt-BR')}
                            </strong>
                            {ultimoContrato.criado_por && (
                                <span className="block text-[11px] text-slate-400">
                                    por {ultimoContrato.criado_por}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-3 pt-1">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Honorários</span>
                            <span className="font-bold text-slate-800">
                                R$ {formatCurrency(ultimoContrato.dados_snapshot?.pagamento?.valor_honorarios || 0)}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Pagamento</span>
                            <span className="font-semibold text-slate-700">
                                {ultimoContrato.dados_snapshot?.pagamento?.tipo_pagamento === 'PARCELADO'
                                    ? `${ultimoContrato.dados_snapshot?.pagamento?.numero_parcelas}x (${ultimoContrato.dados_snapshot?.pagamento?.forma_pagamento})`
                                    : `À vista (${ultimoContrato.dados_snapshot?.pagamento?.forma_pagamento})`}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Autuações</span>
                            <span className="font-semibold text-slate-700">
                                {ultimoContrato.dados_snapshot?.infracoes?.length || 0} infração(ões)
                            </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Veículo</span>
                            <span className="font-semibold text-slate-700">
                                {ultimoContrato.dados_snapshot?.veiculo?.placa || '—'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => handleExcluirContrato(ultimoContrato)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                        >
                            🗑️ Excluir Este Contrato
                        </button>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBaixarPdf(ultimoContrato)}
                                className="text-xs font-bold text-slate-700"
                            >
                                📥 Baixar PDF
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVisualizar(ultimoContrato)}
                                className="text-xs font-bold text-indigo-600 border-indigo-200"
                            >
                                👁️ Visualizar / Editar
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-2xl">
                        📝
                    </div>
                    <div>
                        <h5 className="font-black text-slate-700 text-sm">Nenhum contrato gerado até o momento</h5>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                            Clique no botão abaixo para buscar automaticamente os dados do cliente, veículo, honorários e infrações cadastradas e gerar a minuta do contrato.
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6"
                    >
                        📑 Gerar Contrato Agora
                    </Button>
                </div>
            )}

            {/* Histórico de Versões do Contrato */}
            {contratos.length > 0 && (
                <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            Histórico de Versões ({contratos.length})
                        </h5>
                        <span className="text-[10px] text-slate-400">
                            Versões anteriores preservadas
                        </span>
                    </div>

                    <div className="space-y-2">
                        {contratos.map(c => {
                            const isMaisRecente = c.id === ultimoContrato?.id;
                            const dataHora = new Date(c.created_at).toLocaleString('pt-BR');
                            return (
                                <div
                                    key={c.id}
                                    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl border bg-white transition-all gap-2 ${
                                        isMaisRecente
                                            ? 'border-indigo-300 ring-1 ring-indigo-200'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                                            isMaisRecente ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            v{c.versao}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-800">{c.titulo}</span>
                                                {isMaisRecente && (
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        Atual
                                                    </span>
                                                )}
                                                {c.updated_at && c.updated_at !== c.created_at && (
                                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                                        Editado
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500">
                                                {dataHora} {c.criado_por ? `• Criado por ${c.criado_por}` : ''}
                                                {c.dados_snapshot?.pagamento?.valor_honorarios ? ` • R$ ${formatCurrency(c.dados_snapshot.pagamento.valor_honorarios)}` : ''}
                                                {c.dados_snapshot?.infracoes ? ` • ${c.dados_snapshot.infracoes.length} infração(ões)` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <button
                                            type="button"
                                            onClick={() => handleBaixarPdf(c)}
                                            className="text-slate-600 hover:text-slate-900 text-xs font-bold px-2 py-1 rounded hover:bg-slate-100"
                                            title="Baixar PDF"
                                        >
                                            📥 PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVisualizar(c)}
                                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100"
                                            title="Visualizar e Editar"
                                        >
                                            👁️ Ver / Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleExcluirContrato(c)}
                                            className="text-rose-500 hover:text-rose-700 text-xs font-bold px-2 py-1 rounded hover:bg-rose-50"
                                            title="Excluir versão"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal de Prévia antes da Geração */}
            {isPreviewModalOpen && (
                <ContratoPreviewModal
                    isOpen={isPreviewModalOpen}
                    onClose={() => setIsPreviewModalOpen(false)}
                    cliente={cliente}
                    veiculos={veiculos}
                    infracoes={infracoes}
                    servicos={servicos}
                    versaoDestino={versaoProxima}
                    onConfirmarGeracao={handleConfirmarGeracao}
                />
            )}

            {/* Modal de Visualização do Contrato */}
            {isViewModalOpen && viewingContrato && (
                <ContratoViewModal
                    isOpen={isViewModalOpen}
                    onClose={() => {
                        setIsViewModalOpen(false);
                        setViewingContrato(null);
                    }}
                    contrato={viewingContrato}
                    onContratoAtualizado={handleContratoAtualizado}
                    onContratoExcluido={handleContratoExcluido}
                />
            )}
        </div>
    );
};
