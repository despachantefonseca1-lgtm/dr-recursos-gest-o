// Temporary script to verify Supabase data presence
import { supabase } from '../lib/supabase';

async function countRows(table: string) {
    const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error(`Erro ao contar ${table}:`, error);
        return;
    }
    console.log(`${table}: ${count} registros`);
}

async function main() {
    await Promise.all([
        countRows('infracoes'),
        countRows('recursos_clientes'),
        countRows('recursos_servicos'),
        countRows('tarefas')
    ]);
    process.exit();
}

main();
