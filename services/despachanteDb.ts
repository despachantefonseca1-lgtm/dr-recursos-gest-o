import { Cliente, ServicoDespachante } from '../types';

const DB_KEYS = {
    CLIENTES: 'dr_recursos_clientes',
    SERVICOS_DESPACHANTE: 'dr_recursos_servicos_despachante',
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

        const servicoToSave = { ...servico, updated_at: now };

        if (index >= 0) {
            servicos[index] = servicoToSave;
        } else {
            servicoToSave.created_at = now;
            servicos.push(servicoToSave);
        }
        this.set(DB_KEYS.SERVICOS_DESPACHANTE, servicos);
    }

    static deleteServico(id: string): void {
        const servicos = this.getServicos().filter(s => s.id !== id);
        this.set(DB_KEYS.SERVICOS_DESPACHANTE, servicos);
    }
}
