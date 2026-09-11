import {
    ContratoSnapshot,
    ContratoInfracaoItem,
    FaseRecursal,
    ContratoEscritorioInfo,
    ContratoPagamentoInfo
} from '../types';

// ============================================================
// DADOS PADRÃO DO ESCRITÓRIO
// ============================================================
export const ESCRITORIO_PADRAO: ContratoEscritorioInfo = {
    nome: 'Israel Fonseca',
    uf_oab: 'MG',
    numero_oab: '214.437',
    endereco_completo: 'Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002',
    cidade: 'Bom Despacho/MG'
};

// ============================================================
// AUXILIARES DE FORMATAÇÃO E EXTENSO
// ============================================================
export const formatCurrency = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const valorPorExtenso = (valor: number): string => {
    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
        'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const centenas = ['', 'cem', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
        'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (valor === 0) return 'zero reais';

    const partes = valor.toFixed(2).split('.');
    const inteiro = parseInt(partes[0]);
    const centavos = parseInt(partes[1]);

    const converterGrupo = (n: number): string => {
        if (n === 0) return '';
        if (n === 100) return 'cem';
        let resultado = '';
        const c = Math.floor(n / 100);
        const r = n % 100;
        if (c > 0) resultado += centenas[c];
        if (c > 0 && r > 0) resultado += ' e ';
        if (r > 0 && r < 20) {
            resultado += unidades[r];
        } else if (r >= 20) {
            resultado += dezenas[Math.floor(r / 10)];
            if (r % 10 > 0) resultado += ' e ' + unidades[r % 10];
        }
        return resultado;
    };

    let resultado = '';

    if (inteiro > 0) {
        const milhoes = Math.floor(inteiro / 1000000);
        const milhares = Math.floor((inteiro % 1000000) / 1000);
        const resto = inteiro % 1000;

        const partesGrupo: string[] = [];
        if (milhoes > 0) partesGrupo.push(converterGrupo(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'));
        if (milhares > 0) partesGrupo.push(converterGrupo(milhares) + ' mil');
        if (resto > 0) partesGrupo.push(converterGrupo(resto));

        resultado = partesGrupo.join(' e ');
        resultado += inteiro === 1 ? ' real' : ' reais';
    }

    if (centavos > 0) {
        if (inteiro > 0) resultado += ' e ';
        resultado += converterGrupo(centavos);
        resultado += centavos === 1 ? ' centavo' : ' centavos';
    }

    return resultado.trim();
};

export const numeroPorExtenso = (num: number): string => {
    const unidades = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
        'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
    if (num >= 0 && num <= 20) return unidades[num];
    return String(num);
};

export const formatDateBR = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};

export const formatDateExtenso = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const mesIndex = parseInt(month, 10) - 1;
    const mesNome = meses[mesIndex] || '';
    return `${parseInt(day, 10)} de ${mesNome} de ${year}`;
};

const toRoman = (num: number): string => {
    const lookup: Record<string, number> = {
        M: 1000, CM: 900, D: 500, CD: 400,
        C: 100, XC: 90, L: 50, XL: 40,
        X: 10, IX: 9, V: 5, IV: 4, I: 1
    };
    let roman = '';
    for (const i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
};

// ============================================================
// VALIDAÇÃO DOS DADOS OBRIGATÓRIOS
// ============================================================
export interface ValidationResult {
    isValid: boolean;
    missingFields: string[];
    errorMessage?: string;
}

export const validarDadosContrato = (snapshot: Partial<ContratoSnapshot>): ValidationResult => {
    const missing: string[] = [];

    if (!snapshot.cliente?.nome?.trim()) {
        missing.push('Nome do cliente');
    }
    if (!snapshot.cliente?.cpf_cnpj?.trim()) {
        missing.push('CPF/CNPJ');
    }
    if (!snapshot.veiculo?.placa?.trim()) {
        missing.push('Pelo menos um veículo vinculado com placa');
    }
    if (!snapshot.infracoes || snapshot.infracoes.length === 0) {
        missing.push('Pelo menos uma infração selecionada');
    } else {
        const semAit = snapshot.infracoes.some(inf => !inf.numero_ait?.trim());
        if (semAit) {
            missing.push('Número do Auto de Infração preenchido em todas as infrações');
        }
    }
    if (!snapshot.pagamento?.valor_honorarios || snapshot.pagamento.valor_honorarios <= 0) {
        missing.push('Valor dos honorários');
    }
    if (!snapshot.pagamento?.forma_pagamento?.trim()) {
        missing.push('Forma de pagamento');
    }
    if (!snapshot.escritorio?.nome?.trim() || !snapshot.escritorio?.numero_oab?.trim()) {
        missing.push('Dados do escritório/advogado');
    }

    if (missing.length > 0) {
        return {
            isValid: false,
            missingFields: missing,
            errorMessage: `Não foi possível gerar o contrato. Verifique os seguintes campos obrigatórios: ${missing.join(', ')}.`
        };
    }

    return { isValid: true, missingFields: [] };
};

// ============================================================
// GERAÇÃO DOS BLOCOS DO CONTRATO
// ============================================================

/**
 * Gera a redação das fases cabíveis com base na fase administrativa contratada
 * Regra da Seção 6:
 * - Defesa prévia: Defesa da Autuação/Defesa Prévia, Recurso à JARI e recurso administrativo em segunda instância.
 * - JARI: Recurso à JARI e recurso administrativo em segunda instância, se cabível.
 * - 2ª instância: recurso administrativo em segunda instância.
 */
export const obterFasesCabiveis = (fase: FaseRecursal): string => {
    switch (fase) {
        case FaseRecursal.DEFESA_PREVIA:
            return 'Defesa da Autuação/Defesa Prévia, Recurso à JARI e recurso administrativo em segunda instância.';
        case FaseRecursal.PRIMEIRA_INSTANCIA:
            return 'Recurso à JARI e recurso administrativo em segunda instância, se cabível.';
        case FaseRecursal.SEGUNDA_INSTANCIA:
            return 'recurso administrativo em segunda instância.';
        default:
            return 'Defesa da Autuação/Defesa Prévia, Recurso à JARI e recurso administrativo em segunda instância.';
    }
};

/**
 * Formata um item individual de infração
 */
const formatarItemInfracao = (inf: ContratoInfracaoItem, prefixo?: string): string => {
    const ait = inf.numero_ait || 'N/A';
    const orgao = inf.orgao_autuador || 'Órgão de Trânsito';
    const desc = inf.descricao || 'Infração de Trânsito';
    const dataFormatada = inf.data ? formatDateBR(inf.data) : 'data não informada';
    const veiculo = inf.veiculo_marca_modelo ? `${inf.veiculo_marca_modelo}, ` : '';
    const placa = inf.veiculo_placa || 'placa não informada';

    const trechoHora = inf.hora ? `, às ${inf.hora}` : '';
    const trechoLocal = inf.local ? `, no local ${inf.local}` : '';

    const corpo = `Auto de Infração nº ${ait}, lavrado por ${orgao}, referente à infração ${desc}, ocorrida em ${dataFormatada}${trechoHora}${trechoLocal}, envolvendo o veículo ${veiculo}placa ${placa}.`;

    if (prefixo) {
        return `${prefixo} – ${corpo}`;
    }
    return corpo;
};

/**
 * Monta o bloco dinâmico de infrações conforme Regra 5:
 * - Se apenas uma infração: não é obrigatório algarismo romano
 * - Se múltiplas: I –, II –, III –, etc.
 */
export const gerarBlocoDinamicoInfracoes = (infracoes: ContratoInfracaoItem[]): string => {
    if (!infracoes || infracoes.length === 0) {
        return 'Nenhuma autuação especificada.';
    }

    if (infracoes.length === 1) {
        return formatarItemInfracao(infracoes[0]);
    }

    return infracoes
        .map((inf, index) => formatarItemInfracao(inf, toRoman(index + 1)))
        .join('\n\n');
};

/**
 * Monta a descrição completa do pagamento
 */
export const gerarDescricaoPagamento = (pag: ContratoPagamentoInfo): string => {
    const valorTotalStr = `R$ ${formatCurrency(pag.valor_honorarios)} (${valorPorExtenso(pag.valor_honorarios)})`;
    const forma = pag.forma_pagamento?.trim() || 'a combinar';
    const obs = pag.observacao?.trim() ? ` (${pag.observacao.trim()})` : '';

    if (pag.tipo_pagamento === 'PARCELADO' && pag.numero_parcelas > 1) {
        const numExtenso = numeroPorExtenso(pag.numero_parcelas);
        const valorParcStr = `R$ ${formatCurrency(pag.valor_parcela)} (${valorPorExtenso(pag.valor_parcela)})`;
        const vencimento = pag.data_primeiro_vencimento
            ? `com o primeiro vencimento em ${formatDateBR(pag.data_primeiro_vencimento)} e as demais no mesmo dia dos meses subsequentes`
            : 'com vencimentos mensais sucessivos';

        return `parcelado em ${pag.numero_parcelas} (${numExtenso}) parcelas de ${valorParcStr}, ${vencimento}, via ${forma}${obs}.`;
    }

    // À vista
    return `à vista, no valor total de ${valorTotalStr}, via ${forma}${obs}, no ato da contratação.`;
};

// ============================================================
// TEMPLATE JURÍDICO IMUTÁVEL (SEÇÃO 10 DA ESPECIFICAÇÃO)
// ============================================================
export const gerarTextoContrato = (snapshot: ContratoSnapshot): string => {
    const { cliente, veiculo, infracoes, pagamento, escritorio, fase_administrativa_contratada, data_geracao } = snapshot;

    const blocoInfracoes = gerarBlocoDinamicoInfracoes(infracoes);
    const fasesCabiveis = obterFasesCabiveis(fase_administrativa_contratada);
    const valorHonorariosTotal = `R$ ${formatCurrency(pagamento.valor_honorarios)} (${valorPorExtenso(pagamento.valor_honorarios)})`;
    const descricaoPagamento = pagamento.descricao_completa || gerarDescricaoPagamento(pagamento);
    const dataExtenso = formatDateExtenso(data_geracao);
    const cidadeEscritorio = escritorio.cidade.split('/')[0].trim();

    return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

CONTRATANTE: ${cliente.nome}, inscrito(a) no CPF/CNPJ sob nº ${cliente.cpf_cnpj}, residente/sediado(a) em ${cliente.endereco_completo}.

CONTRATADO: ${escritorio.nome}, inscrito na OAB/${escritorio.uf_oab} sob nº ${escritorio.numero_oab}, com endereço profissional em ${escritorio.endereco_completo}.

DO OBJETO

O presente contrato tem por objeto a prestação de serviços advocatícios destinados à análise, elaboração, protocolo e acompanhamento das medidas administrativas cabíveis em relação à(s) seguinte(s) autuação(ões) de trânsito:

${blocoInfracoes}

A contratação compreende as medidas administrativas ainda juridicamente cabíveis no momento da contratação, conforme a fase de cada procedimento, podendo abranger ${fasesCabiveis}

Não estão incluídos neste contrato processos de suspensão ou cassação do direito de dirigir, indicação de condutor, outras autuações ou processos não descritos acima, bem como qualquer medida judicial, inclusive ação anulatória, mandado de segurança ou recurso judicial, salvo contratação posterior, expressa e específica.

DOS HONORÁRIOS

Pelos serviços contratados, o CONTRATANTE pagará o valor total de ${valorHonorariosTotal}, da seguinte forma: ${descricaoPagamento}

Os honorários remuneram a atividade profissional contratada e são devidos independentemente do resultado final, por se tratar de obrigação de meio, inexistindo garantia de cancelamento da autuação, multa, pontuação ou penalidade.

Despesas extraordinárias, taxas, custas, deslocamentos, cópias, diligências ou serviços de terceiros não estão incluídos, salvo ajuste expresso em sentido contrário.

DAS COMUNICAÇÕES E DO ACOMPANHAMENTO

O CONTRATANTE declara estar ciente de que notificações, decisões e demais comunicações dos órgãos de trânsito poderão ser encaminhadas diretamente ao proprietário, condutor ou interessado, sem prévia ciência do CONTRATADO.

Por essa razão, o CONTRATANTE obriga-se a encaminhar imediatamente ao escritório toda notificação, decisão, correspondência, e-mail, mensagem ou documento relacionado ao processo, preferencialmente no mesmo dia de seu recebimento.

Caso não receba qualquer comunicação ou notícia do processo, o CONTRATANTE obriga-se a entrar em contato com o escritório, no mínimo, a cada 30 (trinta) dias, solicitando consulta e atualização do andamento administrativo.

O contato periódico constitui dever de cooperação do CONTRATANTE e não implica monitoramento diário ou contínuo, pelo CONTRATADO, de todos os sistemas dos órgãos de trânsito.

DOS PRAZOS E DAS RESPONSABILIDADES DO CONTRATANTE

Os prazos administrativos obedecem às regras do órgão competente e não se iniciam a partir da comunicação ao escritório.

O CONTRATADO não responderá por perda de prazo ou prejuízo decorrente de omissão, atraso ou falta de comunicação do CONTRATANTE, inclusive quando este deixar de encaminhar documento recebido, deixar de realizar o contato periódico de 30 (trinta) dias ou fornecer informações ou documentos incompletos, incorretos ou fora de tempo hábil.

Recebida a informação ou documentação tempestivamente, o CONTRATADO adotará as providências profissionais cabíveis dentro do objeto contratado.

DOS DOCUMENTOS E DADOS

O CONTRATANTE responsabiliza-se pela veracidade, integridade e atualização das informações e documentos fornecidos, comprometendo-se a comunicar alterações de endereço, telefone, e-mail, veículo, habilitação ou outros dados relevantes.

A ausência ou demora no fornecimento de documento indispensável poderá inviabilizar determinada defesa ou recurso, sem responsabilidade do CONTRATADO quando o documento depender do CONTRATANTE ou de terceiro.

DOS LIMITES DA CONTRATAÇÃO

A contratação administrativa não compreende automaticamente ajuizamento de ação, mandado de segurança, ação anulatória, recurso judicial, processo de suspensão ou cassação, nova autuação ou qualquer outro procedimento não expressamente descrito neste instrumento.

Qualquer serviço adicional dependerá de nova contratação e novo ajuste de honorários.

DO ENCERRAMENTO

Os serviços serão considerados concluídos com o esgotamento das medidas administrativas abrangidas pelo objeto contratado, com a decisão administrativa final, desistência do CONTRATANTE, revogação dos poderes conferidos ou outra causa legal de encerramento da representação.

Permanecem devidos os honorários correspondentes aos serviços contratados e realizados.

DISPOSIÇÕES FINAIS

O CONTRATANTE declara ter recebido informações claras sobre o objeto, os limites da contratação, a inexistência de garantia de resultado e suas obrigações de cooperação, especialmente quanto ao envio imediato de qualquer comunicação recebida e ao contato com o escritório a cada 30 (trinta) dias na ausência de notícias do processo.

${cidadeEscritorio}, ${dataExtenso}.

__________________________________
${cliente.nome}
CONTRATANTE

__________________________________
${escritorio.nome}
CONTRATADO`;
};
