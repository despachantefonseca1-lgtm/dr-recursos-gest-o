import { RecursoCliente, RecursoServico, Infracao, ReciboCliente, ReciboInfracaoItem } from '../types';
import { formatCurrency, valorPorExtenso, formatDateBR, formatDateExtenso } from './contratoService';

export interface DadosEmissaoRecibo {
    cliente: RecursoCliente;
    servico?: RecursoServico | null;
    infracoesSelecionadas: Infracao[];
    valor: number;
    dataEmissao: string; // YYYY-MM-DD
    cidade?: string;
    uf?: string;
}

export const capitalizarPrimeiraLetra = (str: string): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatarEnderecoClienteRecibo = (cliente: RecursoCliente): string => {
    if (cliente.logradouro) {
        const parts = [
            `à ${cliente.logradouro}`,
            cliente.numero ? `nº ${cliente.numero}` : '',
            cliente.bairro ? `Bairro ${cliente.bairro}` : '',
            (cliente.cidade && cliente.uf) ? `${cliente.cidade}-${cliente.uf}` : (cliente.cidade || ''),
            cliente.cep ? `CEP ${cliente.cep}` : ''
        ].filter(Boolean);
        return parts.join(', ');
    }
    return cliente.endereco ? `à ${cliente.endereco}` : '';
};

export const formatarQualificacaoClienteRecibo = (cliente: RecursoCliente): string => {
    const nome = (cliente.nome || '').toUpperCase();
    const nacionalidade = (cliente.nacionalidade || 'brasileiro(a)').toLowerCase();
    const estadoCivil = (cliente.estado_civil || 'solteiro(a)').toLowerCase();
    const profissao = (cliente.profissao || '').toLowerCase();

    let rgStr = '';
    if (cliente.rg) {
        let rgCompleto = cliente.rg;
        if (cliente.rg_orgao_emissor || cliente.rg_uf) {
            const orgaoUf = [cliente.rg_orgao_emissor, cliente.rg_uf].filter(Boolean).join('/');
            rgCompleto = `${cliente.rg} ${orgaoUf}`;
        }
        rgStr = `, RG Nº ${rgCompleto}`;
    }

    const endereco = formatarEnderecoClienteRecibo(cliente);
    const dadosArray = [
        nome,
        nacionalidade,
        estadoCivil,
        profissao || null,
        `Inscrito CPF Nº ${cliente.cpf}${rgStr}`,
        endereco ? `Residente E Domiciliado ${endereco}` : null
    ].filter(Boolean);

    return dadosArray.join(', ');
};

export const formatarBlocoInfracoesRecibo = (infracoes: (Infracao | ReciboInfracaoItem)[]): string => {
    if (!infracoes || infracoes.length === 0) {
        return 'Nenhum auto de infração especificado.';
    }

    return infracoes.map(inf => {
        const dataInf = 'dataInfracao' in inf ? inf.dataInfracao : '';
        const dataFormatada = formatDateBR(dataInf);
        const auto = inf.numeroAuto || '—';
        const placa = inf.placa || '—';
        const desc = inf.descricao ? inf.descricao.toUpperCase() : 'DEFESA ADMINISTRATIVA';

        return `Auto de Infração: ${auto}, Placa do Veículo: ${placa}, Infração: ${desc}, Data da Infração: ${dataFormatada}`;
    }).join('\n\n');
};

export const gerarTextoRecibo = (dados: DadosEmissaoRecibo): string => {
    const { cliente, infracoesSelecionadas, valor, dataEmissao, cidade = 'Bom Despacho', uf = 'MG' } = dados;

    const qualificacao = formatarQualificacaoClienteRecibo(cliente);
    const valorFormatado = formatCurrency(valor);
    const extenso = capitalizarPrimeiraLetra(valorPorExtenso(valor));
    const blocoInfracoes = formatarBlocoInfracoesRecibo(infracoesSelecionadas);
    const pluralInfracao = infracoesSelecionadas.length > 1 ? 'aos seguintes Autos de Infração:' : 'seguinte Auto de Infração:';
    const dataExtenso = formatDateExtenso(dataEmissao);
    const localData = `${cidade}/${uf}, ${dataExtenso}.`;

    return `RECEBI de ${qualificacao}, a importância de R$ ${valorFormatado} (${extenso}) referente ao pagamento de honorários advocatícios pela prestação de serviços jurídicos consistentes na análise técnica, elaboração e apresentação de recurso administrativo contra infração de trânsito, referente ao ${pluralInfracao}
${blocoInfracoes}

Declaro que o valor acima mencionado foi recebido, dando à contratante plena, geral e irrevogável quitação exclusivamente quanto aos honorários advocatícios referentes ao serviço acima descrito, não abrangendo custas administrativas, taxas, despesas de protocolo ou quaisquer outros valores eventualmente devidos a órgãos públicos ou terceiros.

${localData}

____________________________________
Israel Fonseca`;
};
