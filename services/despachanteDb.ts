import { Cliente, ServicoDespachante, CaixaLancamento } from '../types';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

export class DespachanteDbService {

    // --- CLIENTES ---

    static async getClientes(): Promise<Cliente[]> {
        const { data, error } = await supabase.from('despachante_clientes').select('*').order('nome', { ascending: true });
        if (error) {
            console.error('Error fetching clientes:', error);
            return [];
        }
        return data as Cliente[];
    }

    static async getClienteById(id: string): Promise<Cliente | undefined> {
        const { data, error } = await supabase.from('despachante_clientes').select('*').eq('id', id).single();
        if (error) return undefined;
        return data as Cliente;
    }

    static async saveCliente(cliente: Partial<Cliente>): Promise<Cliente | null> {
        // If ID exists and is valid UUID, try update, else insert
        const { id, ...rest } = cliente;

        if (id) {
            const { data, error } = await supabase
                .from('despachante_clientes')
                .update({ ...rest, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as Cliente;
        } else {
            const { data, error } = await supabase
                .from('despachante_clientes')
                .insert({ ...rest })
                .select()
                .single();
            if (error) throw error;
            return data as Cliente;
        }
    }

    static async deleteCliente(id: string): Promise<void> {
        const { error } = await supabase.from('despachante_clientes').delete().eq('id', id);
        if (error) console.error('Error deleting cliente:', error);
    }

    // --- SERVIÇOS ---

    static async getServicos(): Promise<ServicoDespachante[]> {
        const { data, error } = await supabase.from('despachante_servicos').select('*').order('data_servico', { ascending: false });
        if (error) {
            console.error('Error fetching servicos:', error);
            return [];
        }
        return data as ServicoDespachante[];
    }

    static async getServicosByClienteId(clienteId: string): Promise<ServicoDespachante[]> {
        const { data, error } = await supabase.from('despachante_servicos').select('*').eq('cliente_id', clienteId).order('data_servico', { ascending: false });
        if (error) return [];
        return data as ServicoDespachante[];
    }

    static async getServicoById(id: string): Promise<ServicoDespachante | undefined> {
        const { data, error } = await supabase.from('despachante_servicos').select('*').eq('id', id).single();
        if (error) return undefined;
        return data as ServicoDespachante;
    }

    static async saveServico(servico: Partial<ServicoDespachante>): Promise<void> {
        const now = new Date().toISOString();
        const { id, ...rest } = servico;

        // Helper
        const valOrNull = (v: any) => (v === '' ? null : v);
        const valOrZero = (v: any) => (v === '' || isNaN(Number(v)) ? 0 : Number(v));

        const sanitized = {
            ...rest,
            cliente_id: valOrNull(rest.cliente_id),
            veiculo: valOrNull(rest.veiculo), // assuming veiculo is string
            placa: rest.placa, // string
            data_servico: valOrNull(rest.data_servico),
            pagamento_valor: valOrZero(rest.pagamento_valor),
            caixa_lancamento_id: valOrNull(rest.caixa_lancamento_id)
        };

        let resultServico: ServicoDespachante | null = null;

        // 1. Save/Update Service
        if (id) {
            const { data, error } = await supabase.from('despachante_servicos').update({ ...sanitized, updated_at: now }).eq('id', id).select().single();
            if (error) throw error;
            resultServico = data;
        } else {
            const { data, error } = await supabase.from('despachante_servicos').insert({ ...sanitized, created_at: now }).select().single();
            if (error) throw error;
            resultServico = data;
        }

        if (!resultServico) throw new Error("Erro desconhecido ao salvar serviço");

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
                    // Update service with link
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
        const servico = await this.getServicoById(id);
        if (servico && servico.caixa_lancamento_id) {
            await this.deleteLancamento(servico.caixa_lancamento_id);
        }
        await supabase.from('despachante_servicos').delete().eq('id', id);
    }

    // --- CAIXA ---

    static async getLancamentos(): Promise<CaixaLancamento[]> {
        const { data, error } = await supabase.from('despachante_caixa').select('*').is('deleted_at', null).order('data', { ascending: false });
        if (error) {
            console.error('Error fetching caixa:', error);
            alert("Erro ao buscar caixa: " + error.message);
            return [];
        }
        return data as CaixaLancamento[];
    }

    static async saveLancamento(lancamento: Partial<CaixaLancamento>): Promise<void> {
        const { id, ...rest } = lancamento;
        const valOrZero = (v: any) => (v === '' || isNaN(Number(v)) ? 0 : Number(v));

        const sanitized = {
            ...rest,
            valor: valOrZero(rest.valor)
        };

        if (id) {
            const { error } = await supabase.from('despachante_caixa').update({ ...sanitized, updated_at: new Date().toISOString() }).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('despachante_caixa').insert(sanitized);
            if (error) throw error;
        }
    }

    static async deleteLancamento(id: string): Promise<void> {
        // Soft Delete
        await supabase.from('despachante_caixa').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    }
}
