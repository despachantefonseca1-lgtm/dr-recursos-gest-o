import React, { useState } from 'react';
import { useUnidade } from '../../contexts/UnidadeContext';
import { Unidade } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const UnidadesPage: React.FC = () => {
  const { unidades, carregarUnidades, salvarUnidade, excluirUnidade, carregando, selecionarUnidade, unidadeIdSelecionada } = useUnidade();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const initialForm: Partial<Unidade> = {
    nome: '',
    slug: '',
    cidade: '',
    uf: 'MG',
    endereco_completo: '',
    telefone: '',
    email: '',
    cidade_emissao: '',
    local_pagamento_padrao: '',
    advogado_nome: 'Israel Fonseca',
    advogado_oab_numero: '214.437',
    advogado_oab_uf: 'MG',
    advogado_cpf: '073.719.596-71',
    advogado_qualificacao: 'Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório profissional na Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com',
    is_matriz: false,
    ativo: true
  };

  const [formData, setFormData] = useState<Partial<Unidade>>(initialForm);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData(initialForm);
    setIsModalOpen(true);
  };

  const handleEdit = (u: Unidade) => {
    setEditingId(u.id);
    setFormData({ ...u });
    setIsModalOpen(true);
  };

  const handleCidadeChange = (cidade: string) => {
    setFormData(prev => {
      const uf = prev.uf || 'MG';
      const cidadeUf = cidade ? `${cidade}/${uf}` : '';
      return {
        ...prev,
        cidade,
        cidade_emissao: prev.cidade_emissao || cidadeUf,
        local_pagamento_padrao: prev.local_pagamento_padrao || cidadeUf
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.cidade || !formData.endereco_completo) {
      alert('Por favor, preencha o Nome da Unidade, Cidade e Endereço Completo.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<Unidade> = {
        ...formData,
        id: editingId || undefined,
        cidade_emissao: formData.cidade_emissao || `${formData.cidade}/${formData.uf || 'MG'}`,
        local_pagamento_padrao: formData.local_pagamento_padrao || `${formData.cidade}/${formData.uf || 'MG'}`
      };

      await salvarUnidade(payload);
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err: any) {
      console.error('Erro ao salvar unidade:', err);
      alert('Erro ao salvar unidade: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: Unidade) => {
    if (u.is_matriz) {
      alert('A unidade Matriz não pode ser excluída.');
      return;
    }
    if (confirm(`Tem certeza de que deseja excluir a unidade "${u.nome}"?`)) {
      try {
        await excluirUnidade(u.id);
      } catch (err: any) {
        alert('Erro ao excluir unidade: ' + (err.message || 'Erro desconhecido'));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Unidades e Filiais</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre os endereços, cidades de emissão e parâmetros de cada escritório para emissão automática de documentos.
          </p>
        </div>

        <Button
          onClick={handleOpenNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-100 flex items-center gap-2"
        >
          <span>➕</span> Nova Unidade
        </Button>
      </div>

      {/* Grid de Unidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {unidades.map((u) => {
          const isAtivaSelecionada = unidadeIdSelecionada === u.id;
          return (
            <div
              key={u.id}
              className={`bg-white rounded-2xl p-6 border transition-all relative flex flex-col justify-between shadow-sm hover:shadow-md ${
                isAtivaSelecionada ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-800">{u.nome}</h3>
                      {u.is_matriz && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          Matriz
                        </span>
                      )}
                      {!u.is_matriz && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          Filial
                        </span>
                      )}
                      {isAtivaSelecionada && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          ● Ativa no Topo
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-indigo-600">
                      📍 {u.cidade} / {u.uf}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(u)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar Unidade"
                    >
                      ✏️
                    </button>
                    {!u.is_matriz && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Excluir Unidade"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Detalhes de Endereço e Contato */}
                <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl text-xs text-slate-600 border border-slate-100 mb-4">
                  <div>
                    <span className="font-bold text-slate-700 block">Endereço Completo:</span>
                    <span className="text-slate-600">{u.endereco_completo || 'Não informado'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="font-bold text-slate-700 block">Cidade de Emissão:</span>
                      <span className="text-slate-600">{u.cidade_emissao || 'Padrão da Cidade'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 block">Local Pgto Promissória:</span>
                      <span className="text-slate-600">{u.local_pagamento_padrao || 'Padrão da Cidade'}</span>
                    </div>
                  </div>

                  {(u.telefone || u.email) && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      {u.telefone && (
                        <div>
                          <span className="font-bold text-slate-700 block">Telefone:</span>
                          <span className="text-slate-600">{u.telefone}</span>
                        </div>
                      )}
                      {u.email && (
                        <div>
                          <span className="font-bold text-slate-700 block">E-mail:</span>
                          <span className="text-slate-600 truncate block">{u.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {u.advogado_nome && (
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="font-bold text-slate-700 block">Advogado Responsável:</span>
                      <span className="text-slate-600">
                        {u.advogado_nome} (OAB/{u.advogado_oab_uf || 'MG'} nº {u.advogado_oab_numero || '214.437'})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botão de Alternar Rápido */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {isAtivaSelecionada ? 'Unidade atualmente selecionada' : 'Visualizar dados desta unidade'}
                </span>
                {!isAtivaSelecionada && (
                  <button
                    onClick={() => selecionarUnidade(u.id)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                  >
                    Alternar para esta ➔
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Criação / Edição */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Editar Unidade / Filial' : 'Cadastrar Nova Unidade'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Input
                label="Nome da Unidade *"
                placeholder="Ex: Unidade Nova Serrana ou Matriz Bom Despacho"
                value={formData.nome || ''}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo da Unidade</label>
              <div className="flex items-center h-10 gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_matriz || false}
                    onChange={(e) => setFormData({ ...formData, is_matriz: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                  />
                  É a Matriz Principal
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Input
                label="Cidade *"
                placeholder="Ex: Nova Serrana"
                value={formData.cidade || ''}
                onChange={(e) => handleCidadeChange(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                label="Estado (UF) *"
                placeholder="MG"
                value={formData.uf || 'MG'}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                maxLength={2}
                required
              />
            </div>
          </div>

          <div>
            <Input
              label="Endereço Completo (para Documentos e Contratos) *"
              placeholder="Ex: Rua Coronel Martinho, nº 123, Sala 4, Centro, Nova Serrana/MG, CEP 35590-000"
              value={formData.endereco_completo || ''}
              onChange={(e) => setFormData({ ...formData, endereco_completo: e.target.value })}
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Este endereço será impresso na qualificação do escritório nas Procurações e Contratos de Honorários.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Telefone / WhatsApp de Contato"
              placeholder="(37) 99999-9999"
              value={formData.telefone || ''}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
            />
            <Input
              label="E-mail de Contato"
              type="email"
              placeholder="contato@escritorio.com"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {/* Configurações de Emissão de Documentos */}
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>📄</span> Parâmetros de Impressão de Documentos
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Input
                  label="Cidade de Emissão nos Documentos *"
                  placeholder="Ex: Nova Serrana/MG"
                  value={formData.cidade_emissao || ''}
                  onChange={(e) => setFormData({ ...formData, cidade_emissao: e.target.value })}
                  required
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Aparece no rodapé de data (ex: <i>"Nova Serrana/MG, 16 de setembro de 2026"</i>).
                </p>
              </div>

              <div>
                <Input
                  label="Local Padrão de Pagamento (Nota Promissória) *"
                  placeholder="Ex: Nova Serrana/MG"
                  value={formData.local_pagamento_padrao || ''}
                  onChange={(e) => setFormData({ ...formData, local_pagamento_padrao: e.target.value })}
                  required
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Preenchido no campo <i>"Pagável em: ..."</i> das Promissórias.
                </p>
              </div>
            </div>
          </div>

          {/* Dados do Advogado / Responsável Técnico */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚖️</span> Responsável Legal / Advogado da Unidade
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Input
                  label="Nome do Advogado"
                  value={formData.advogado_nome || 'Israel Fonseca'}
                  onChange={(e) => setFormData({ ...formData, advogado_nome: e.target.value })}
                />
              </div>
              <div>
                <Input
                  label="Número da OAB"
                  value={formData.advogado_oab_numero || '214.437'}
                  onChange={(e) => setFormData({ ...formData, advogado_oab_numero: e.target.value })}
                />
              </div>
              <div>
                <Input
                  label="UF da OAB"
                  value={formData.advogado_oab_uf || 'MG'}
                  onChange={(e) => setFormData({ ...formData, advogado_oab_uf: e.target.value.toUpperCase() })}
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <Input
                  label="CPF do Advogado/Credor"
                  value={formData.advogado_cpf || '073.719.596-71'}
                  onChange={(e) => setFormData({ ...formData, advogado_cpf: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Qualificação Resumida (Opcional)"
                  placeholder="Ex: brasileiro, casado, advogado..."
                  value={formData.advogado_qualificacao || ''}
                  onChange={(e) => setFormData({ ...formData, advogado_qualificacao: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              disabled={saving}
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar Unidade'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UnidadesPage;
