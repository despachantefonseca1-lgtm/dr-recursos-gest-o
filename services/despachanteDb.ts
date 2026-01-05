import { Cliente, ServicoDespachante, CaixaLancamento } from '../types';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

export class DespachanteDbService {

    // --- CLIENTES ---

    static async getClientes(): Promise<Cliente[]> {
        const { data, error } = await supabase.from('despachante_clientes').select('*').order('nome', { ascending: true });
        if (error) {
            console.error('Error fetching clientes:', error);
            alert("Erro buscar clientes: " + error.message);
            return [];
        }
        // alert(`DEBUG: Encontrados ${data?.length} clientes.`);
        return data as Cliente[];
    }

    static async getClienteById(id: string): Promise<Cliente | undefined> {
        const { data, error } = await supabase.from('despachante_clientes').select('*').eq('id', id).single();
        if (error) return undefined;
        return data as Cliente;
    }

    static async saveCliente(cliente: Partial<Cliente>): Promise<Cliente | null> {
        const { id, ...rest } = cliente;

        const valOrNull = (v: any) => (v === '' ? null : v);

        // Explicit map to match DB columns
        const dbPayload = {
            nome: cliente.nome,
            telefone: cliente.telefone,
            cpf: valOrNull(cliente.cpf || ''),
            rg: valOrNull(cliente.rg || ''),
            observacoes_cliente: valOrNull(cliente.observacoes_cliente),
        };

        if (id) {
            const { data, error } = await supabase
                .from('despachante_clientes')
                .update({ ...dbPayload, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as Cliente;
        } else {
            const { data, error } = await supabase
                .from('despachante_clientes')
                .insert({ ...dbPayload })
                .select()
                .single();
            if (error) throw error;
            return data as Cliente;
        }
    }

    static async deleteCliente(id: string): Promise<void> {
        const { error } = await supabase.from('despachante_clientes').delete().eq('id', id);
        if (error) throw error;
    }

    // --- SERVIÇOS ---

    static async getServicos(): Promise<ServicoDespachante[]> {
        const { data, error } = await supabase.from('despachante_servicos').select('*').order('data_servico', { ascending: false });
        if (error) {
            console.error('Error fetching servicos:', error);
            return [];
        }
        return (data || []).map(this.mapDbServico);
    }

    static async getServicosByClienteId(clienteId: string): Promise<ServicoDespachante[]> {
        const { data, error } = await supabase.from('despachante_servicos').select('*').eq('cliente_id', clienteId).order('data_servico', { ascending: false });
        if (error) return [];
        return (data || []).map(this.mapDbServico);
    }

    static mapDbServico(row: any): ServicoDespachante {
        return {
            id: row.id,
            cliente_id: row.cliente_id,
            data_servico: row.data_servico,
            veiculo: '', // DB doesn't have confirmed 'veiculo' column, UI handles description
            placa: row.placa_veiculo,
            servico_descricao: row.servico_descricao,
            pagamento_forma: row.pagamento_forma,
            pagamento_valor: Number(row.pagamento_valor),
            observacoes_servico: row.observacoes,
            checklist: row.checklist || {},
            caixa_lancamento_id: row.caixa_lancamento_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            custo_servico: Number(row.custo_servico || 0),
            status: row.status
        } as ServicoDespachante;
    }

    static async getServicoById(id: string): Promise<ServicoDespachante | undefined> {
        const { data, error } = await supabase.from('despachante_servicos').select('*').eq('id', id).single();
        if (error) return undefined;
        return this.mapDbServico(data);
    }

    static async saveServico(servico: Partial<ServicoDespachante>): Promise<void> {
        const now = new Date().toISOString();
        const { id, ...rest } = servico;

        const valOrNull = (v: any) => (v === '' ? null : v);
        const valOrZero = (v: any) => (v === '' || isNaN(Number(v)) ? 0 : Number(v));

        const dbPayload = {
            cliente_id: valOrNull(rest.cliente_id),
            // Combine veiculo into description if present
            servico_descricao: rest.veiculo ? `${rest.servico_descricao} [${rest.veiculo}]` : rest.servico_descricao,
            placa_veiculo: rest.placa,
            data_servico: valOrNull(rest.data_servico),
            pagamento_valor: valOrZero(rest.pagamento_valor),
            pagamento_forma: rest.pagamento_forma,
            checklist: rest.checklist,
            observacoes: rest.observacoes_servico,
            caixa_lancamento_id: valOrNull(rest.caixa_lancamento_id)
        };

        let resultServico: ServicoDespachante | null = null;
        let savedData: any = null;

        // 1. Save/Update Service
        if (id) {
            const { data, error } = await supabase.from('despachante_servicos').update({ ...dbPayload, updated_at: now }).eq('id', id).select().single();
            if (error) throw error;
            savedData = data;
        } else {
            const { data, error } = await supabase.from('despachante_servicos').insert({ ...dbPayload, created_at: now }).select().single();
            if (error) throw error;
            savedData = data;
        }

        if (!savedData) throw new Error("Erro desconhecido ao salvar serviço");

        // Map back for local usage
        resultServico = this.mapDbServico(savedData);

        // --- CAIXA AUTOMATION ---
        const currentUser = api.getCurrentUser();
        let userName = 'Sistema';
        if (currentUser) {
            userName = currentUser.name || 'Usuário';
        }

        if (resultServico.pagamento_valor > 0) {
            const cliente = await this.getClienteById(resultServico.cliente_id);
            const clienteNome = cliente ? cliente.nome : 'Cliente Desconhecido';
            const clienteTel = cliente ? cliente.telefone : '';

            const entryData = {
                data: (resultServico.data_servico || now).split('T')[0],
                tipo: 'ENTRADA',
                descricao: resultServico.servico_descricao,
                valor: resultServico.pagamento_valor,
                forma_pagamento: resultServico.pagamento_forma,
                cliente_nome: clienteNome,
                cliente_telefone: clienteTel,
                cliente_id: resultServico.cliente_id,
                servico_id: resultServico.id,
                criado_por: userName,
                updated_at: now
            };

            if (resultServico.caixa_lancamento_id) {
                // Update existing
                await supabase.from('despachante_caixa').update(entryData).eq('id', resultServico.caixa_lancamento_id);
            } else {
                // Create new
                const { data: newEntry, error: insertError } = await supabase.from('despachante_caixa').insert(entryData).select().single();
                if (!insertError && newEntry) {
                    await supabase.from('despachante_servicos').update({ caixa_lancamento_id: newEntry.id }).eq('id', resultServico.id);
                }
            }
        } else if (resultServico.caixa_lancamento_id) {
            // Value 0 so remove entry
            await this.deleteLancamento(resultServico.caixa_lancamento_id);
            await supabase.from('despachante_servicos').update({ caixa_lancamento_id: null }).eq('id', resultServico.id);
        }
    }

    static async deleteServico(id: string): Promise<void> {
        // First, remove the foreign key reference from caixa entries
        // Set servico_id to NULL for all entries that reference this service
        const { error: updateError } = await supabase
            .from('despachante_caixa')
            .update({ servico_id: null })
            .eq('servico_id', id);

        if (updateError) {
            console.error('Error removing servico_id from caixa entries:', updateError);
        }

        // Now safe to delete the service (FK constraint removed)
        const { error } = await supabase.from('despachante_servicos').delete().eq('id', id);
        if (error) throw error;
    }

    // --- CAIXA ---

    static async getLancamentos(): Promise<CaixaLancamento[]> {
        const { data, error } = await supabase.from('despachante_caixa').select('*').order('data', { ascending: false });
        if (error) {
            console.error('Error fetching caixa:', error);
            alert("Erro ao buscar caixa: " + error.message);
            return [];
        }
        // alert(`DEBUG: Encontrados ${data?.length} lançamentos.`);
        return data as CaixaLancamento[];
    }

    static async saveLancamento(lancamento: Partial<CaixaLancamento>): Promise<void> {
        const { id, ...rest } = lancamento;
        const valOrZero = (v: any) => (v === '' || isNaN(Number(v)) ? 0 : Number(v));
        const valOrNull = (v: any) => (v === '' ? null : v);

        // Explicit Map to avoid mismatches
        const dbPayload = {
            data: rest.data,
            tipo: rest.tipo,
            descricao: rest.descricao,
            valor: valOrZero(rest.valor),
            forma_pagamento: valOrNull(rest.forma_pagamento),
            cliente_nome: valOrNull(rest.cliente_nome),
            cliente_telefone: valOrNull(rest.cliente_telefone),
            cliente_id: valOrNull(rest.cliente_id),
            servico_id: valOrNull(rest.servico_id),
            criado_por: rest.criado_por
        };

        if (id) {
            const { error } = await supabase
                .from('despachante_caixa')
                .update({ ...dbPayload, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('despachante_caixa').insert(dbPayload);
            if (error) throw error;
        }
    }

    static async deleteLancamento(id: string): Promise<void> {
        // Soft delete using deleted_at timestamp
        const { error } = await supabase
            .from('despachante_caixa')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    }
}
