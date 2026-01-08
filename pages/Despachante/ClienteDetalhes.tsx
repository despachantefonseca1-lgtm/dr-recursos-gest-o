import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DespachanteDbService } from '../../services/despachanteDb';
import { Cliente, ServicoDespachante } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

const ClienteDetalhes: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [servicos, setServicos] = useState<ServicoDespachante[]>([]);

    // Edit Client Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editObs, setEditObs] = useState('');

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        const c = await DespachanteDbService.getClienteById(id);
        if (!c) {
            navigate('/despachante/clientes');
            return;
        }
        setCliente(c);
        setEditName(c.nome);
        setEditPhone(c.telefone);
        setEditObs(c.observacoes_cliente || '');

        const s = await DespachanteDbService.getServicosByClienteId(id);
        // sort by date desc
        s.sort((a, b) => new Date(b.data_servico).getTime() - new Date(a.data_servico).getTime());
        setServicos(s);
    };

    // Helper function to format date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
    // WITHOUT creating a Date object (which would cause timezone conversion)
    const formatDateString = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const handleUpdateCliente = async () => {
        if (!cliente || !editName || !editPhone) return;

        const updated: Cliente = {
            ...cliente,
            nome: editName,
            telefone: editPhone,
            observacoes_cliente: editObs,
            updated_at: new Date().toISOString()
        };

        await DespachanteDbService.saveCliente(updated);
        setCliente(updated);
        setIsEditModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este serviço? Esta ação também removerá o lançamento do caixa.')) {
            try {
                await DespachanteDbService.deleteServico(id);
                alert('Serviço excluído com sucesso!');
                await loadData();
            } catch (error: any) {
                console.error('Error deleting servico:', error);
                alert('Erro ao excluir serviço: ' + (error.message || 'Erro desconhecido'));
            }
        }
    };

    const handlePrint = (servico: ServicoDespachante) => {
        // Open print window
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        // Helper to safely display values
        const display = (value: any): string => {
            if (value === null || value === undefined || value === '') return '';
            return String(value);
        };

        const html = `
        <html>
          <head>
            <title>Ficha do Cliente - ${cliente?.nome || ''}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
              .section { margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; border-radius: 4px; }
              .row { display: flex; margin-bottom: 5px; }
              .label { font-weight: bold; width: 150px; }
              .value { flex: 1; border-bottom: 1px dotted #999; min-height: 16px; }
              .checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
              .check-item { display: flex; align-items: center; }
              .box { width: 14px; height: 14px; border: 1px solid #000; margin-right: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .checked { background-color: #000; color: #fff; }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
                .box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 18px;">FICHA DO CLIENTE</h1>
            </div>

            <div class="section">
              <div class="row"><div class="label">NOME:</div><div class="value">${display(cliente?.nome)}</div></div>
              <div class="row"><div class="label">DATA:</div><div class="value">${new Date(servico.data_servico).toLocaleDateString('pt-BR')}</div></div>
              <div class="row"><div class="label">TELEFONE:</div><div class="value">${display(cliente?.telefone)}</div></div>
              <div class="row"><div class="label">VEÍCULO:</div><div class="value">${display(servico.veiculo)}</div></div>
              <div class="row"><div class="label">PLACA:</div><div class="value">${display(servico.placa)}</div></div>
            </div>

            <div class="section">
              <div class="row"><div class="label">SERVIÇO:</div><div class="value">${display(servico.servico_descricao)}</div></div>
              <div class="row"><div class="label">FORMA PAGAMENTO:</div><div class="value">${display(servico.pagamento_forma)}</div></div>
              <div class="row"><div class="label">VALOR:</div><div class="value">R$ ${servico.pagamento_valor ? servico.pagamento_valor.toFixed(2) : '0.00'}</div></div>
              <div class="row"><div class="label">OBS PAGAMENTO:</div><div class="value">${display(servico.pagamento_obs)}</div></div>
              <div class="row"><div class="label">MELHOR HORÁRIO VISTORIA:</div><div class="value">${display(servico.melhor_horario_vistoria)}</div></div>
              <div class="row"><div class="label">OBSERVAÇÕES SERVIÇO:</div><div class="value">${display(servico.observacoes_servico)}</div></div>
            </div>

            <h3>DADOS A SER CONFERIDOS</h3>
            <div class="section checklist-grid">
              ${Object.entries(servico.checklist || {}).map(([key, value]) => {
            const label = key.replace(/_/g, ' ').toUpperCase();
            return `<div class="check-item"><span class="box ${value ? 'checked' : ''}">${value ? 'X' : '&nbsp;'}</span> ${label}</div>`;
        }).join('')}
            </div>

            <div class="section">
               <div class="row"><div class="label">COMPLEMENTAÇÃO:</div><div class="value">${display(servico.complementacao)}</div></div>
            </div>

            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    if (!cliente) return <div>Carregando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={() => navigate('/despachante/clientes')} className="text-slate-400 hover:text-slate-600">
                    ← Voltar
                </button>
                <h1 className="text-2xl font-bold text-slate-800 flex-1">Detalhes do Cliente</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">{cliente.nome}</h2>
                    <p className="text-slate-500 mt-1 flex items-center space-x-2">
                        <span>📞 {cliente.telefone}</span>
                    </p>
                    {cliente.observacoes_cliente && (
                        <p className="mt-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 max-w-2xl">
                            <span className="font-bold block text-xs uppercase text-slate-400 mb-1">Observações do Cliente:</span>
                            {cliente.observacoes_cliente}
                        </p>
                    )}
                </div>
                <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
                    Editar Cliente
                </Button>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">Histórico de Serviços</h3>
                <Button onClick={() => navigate(`/despachante/clientes/${id}/novo-servico`)}>
                    + Novo Serviço
                </Button>
            </div>

            <div className="grid gap-4">
                {servicos.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <p className="text-slate-400">Nenhum serviço registrado para este cliente.</p>
                    </div>
                ) : (
                    servicos.map(servico => (
                        <div key={servico.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-1">
                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                        {formatDateString(servico.data_servico)}
                                    </span>
                                    <span className="font-bold text-slate-700">{servico.veiculo} - {servico.placa}</span>
                                </div>
                                <p className="text-slate-600">{servico.servico_descricao}</p>
                                {servico.pagamento_valor > 0 && (
                                    <p className="text-sm font-medium text-emerald-600 mt-1">
                                        R$ {servico.pagamento_valor.toFixed(2)}
                                    </p>
                                )}
                            </div>
                            <div className="flex space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button variant="secondary" onClick={() => navigate(`/despachante/clientes/${id}/servicos/${servico.id}`)}>
                                    Editar
                                </Button>
                                <Button onClick={() => handlePrint(servico)}>
                                    Imprimir
                                </Button>
                                <Button className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100" onClick={() => handleDelete(servico.id)}>
                                    🗑️
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Editar Cliente"
            >
                <div className="space-y-4">
                    <Input
                        label="Nome Completo *"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                    />
                    <Input
                        label="Telefone *"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                    />
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Observações</label>
                        <textarea
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-24 text-sm"
                            value={editObs}
                            onChange={(e) => setEditObs(e.target.value)}
                        />
                    </div>
                    <div className="pt-4 flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleUpdateCliente}>
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ClienteDetalhes;
