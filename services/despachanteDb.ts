import { Cliente, ServicoDespachante } from '../types';

const DB_KEYS = {
    CLIENTES: 'dr_recursos_clientes',
    SERVICOS_DESPACHANTE: 'dr_recursos_servicos_despachante',
    CAIXA: 'dr_recursos_caixa',
};

export class DespachanteDbService {
    private static get<T>(key: string, defaultValue: T): T {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    }

    private static set<T>(key: string, data: T): void {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // --- CLIENTES ---

    static getClientes(): Cliente[] {
        return this.get(DB_KEYS.CLIENTES, []);
    }

    static getClienteById(id: string): Cliente | undefined {
        return this.getClientes().find(c => c.id === id);
    }

    static saveCliente(cliente: Cliente): void {
        const clientes = this.getClientes();
        const index = clientes.findIndex(c => c.id === cliente.id);
        const now = new Date().toISOString();

        // Ensure created_at fits the logic
        const clienteToSave = { ...cliente, updated_at: now };

        if (index >= 0) {
            // Preservation of created_at is handled by the caller or we can enforce it here if we fetched the old one
            clientes[index] = clienteToSave;
        } else {
            clienteToSave.created_at = now;
            clientes.push(clienteToSave);
        }
        this.set(DB_KEYS.CLIENTES, clientes);
    }

    static deleteCliente(id: string): void {
        const clientes = this.getClientes().filter(c => c.id !== id);
        this.set(DB_KEYS.CLIENTES, clientes);

        // Also delete associated services? usually yes, but let's keep it simple for now or cascade delete
        // For safety in this MVP, let's keep services orphaned or we can filter them out later
        const servicos = this.getServicos().filter(s => s.cliente_id !== id);
        this.set(DB_KEYS.SERVICOS_DESPACHANTE, servicos);
    }

    // --- SERVIÇOS ---

    static getServicos(): ServicoDespachante[] {
        return this.get(DB_KEYS.SERVICOS_DESPACHANTE, []);
    }

    static getServicosByClienteId(clienteId: string): ServicoDespachante[] {
        return this.getServicos().filter(s => s.cliente_id === clienteId);
    }

    static getServicoById(id: string): ServicoDespachante | undefined {
        return this.getServicos().find(s => s.id === id);
    }

    static saveServico(servico: ServicoDespachante): void {
        const servicos = this.getServicos();
        const index = servicos.findIndex(s => s.id === servico.id);
        const now = new Date().toISOString();

        let servicoToSave = { ...servico, updated_at: now };

        if (index >= 0) {
            servicoToSave = { ...servicos[index], ...servicoToSave };
        } else {
            servicoToSave.created_at = now;
        }

        // --- CAIXA AUTOMATION ---
        const currentUser = localStorage.getItem('dr_user'); // Poor man's auth check or we can use DbService
        let userName = 'Sistema';
        if (currentUser) {
            try {
                const u = JSON.parse(currentUser);
                userName = u.name || 'Usuário';
            } catch (e) { }
        }

        // 1. If value > 0, ensure Caixa Entry exists or create
        if (servicoToSave.pagamento_valor > 0) {
            // Find client name for the entry
            const cliente = this.getClienteById(servicoToSave.cliente_id);
            const clienteNome = cliente ? cliente.nome : 'Cliente Desconhecido';
            const clienteTel = cliente ? cliente.telefone : '';

            let caixaId = servicoToSave.caixa_lancamento_id;

            // Prepare entry data
            const entryData: any = {
                data: servicoToSave.data_servico.split('T')[0], // YYYY-MM-DD
                tipo: 'ENTRADA',
                descricao: servicoToSave.servico_descricao,
                valor: servicoToSave.pagamento_valor,
                forma_pagamento: servicoToSave.pagamento_forma,
                cliente_nome: clienteNome,
                cliente_telefone: clienteTel,
                cliente_id: servicoToSave.cliente_id,
                servico_id: servicoToSave.id,
                criado_por: userName,
                updated_at: now
            };

            if (caixaId) {
                // Check if exists
                const existing = this.getLancamentos().find(l => l.id === caixaId);
                if (existing) {
                    // Update
                    const updatedEntry = { ...existing, ...entryData };
                    this.saveLancamentoInternal(updatedEntry);
                } else {
                    // Re-create if ID existed but entry didn't? Or create new
                    const newEntry = this.createNewLancamento(entryData, now);
                    servicoToSave.caixa_lancamento_id = newEntry.id;
                    this.saveLancamentoInternal(newEntry);
                }
            } else {
                // Create new
                const newEntry = this.createNewLancamento(entryData, now);
                servicoToSave.caixa_lancamento_id = newEntry.id;
                this.saveLancamentoInternal(newEntry);
            }

        } else if (servicoToSave.caixa_lancamento_id) {
            // Value is 0 but had entry -> Soft delete the entry
            this.deleteLancamento(servicoToSave.caixa_lancamento_id);
            // Optional: keep the ID in service or remove it? Let's keep it to know it WAS there, or remove.
            // Requirement says "marcar deletado lógico". 
        }
        // ------------------------

        if (index >= 0) {
            servicos[index] = servicoToSave;
        } else {
            servicos.push(servicoToSave);
        }
        this.set(DB_KEYS.SERVICOS_DESPACHANTE, servicos);
    }

    static deleteServico(id: string): void {
        // Also soft-delete the associated caixa entry if exists
        const servico = this.getServicoById(id);
        if (servico && servico.caixa_lancamento_id) {
            this.deleteLancamento(servico.caixa_lancamento_id);
        }

        const servicos = this.getServicos().filter(s => s.id !== id);
        this.set(DB_KEYS.SERVICOS_DESPACHANTE, servicos);
    }

    // --- CAIXA ---

    static getLancamentos(): import('../types').CaixaLancamento[] {
        return this.get(DB_KEYS.CAIXA, []);
    }

    static saveLancamento(lancamento: import('../types').CaixaLancamento): void {
        this.saveLancamentoInternal(lancamento);
    }

    private static createNewLancamento(data: any, now: string): import('../types').CaixaLancamento {
        return {
            id: crypto.randomUUID(),
            created_at: now,
            deleted_at: undefined,
            ...data
        };
    }

    private static saveLancamentoInternal(lancamento: import('../types').CaixaLancamento): void {
        const list = this.getLancamentos();
        const index = list.findIndex(l => l.id === lancamento.id);
        const now = new Date().toISOString();
        const toSave = { ...lancamento, updated_at: now };

        if (index >= 0) {
            list[index] = toSave;
        } else {
            toSave.created_at = toSave.created_at || now;
            list.push(toSave);
        }
        this.set(DB_KEYS.CAIXA, list);
    }

    static deleteLancamento(id: string): void {
        const list = this.getLancamentos();
        const index = list.findIndex(l => l.id === id);
        if (index >= 0) {
            list[index].deleted_at = new Date().toISOString();
            this.set(DB_KEYS.CAIXA, list);
        }
    }
}
