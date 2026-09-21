/**
 * Utilitários de formatação e máscaras para documentos brasileiros e contatos.
 */

// Formata CPF: 000.000.000-00
export const formatCPF = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Formata CNPJ: 00.000.000/0000-00
export const formatCNPJ = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// Formata dinamicamente tanto CPF quanto CNPJ conforme a quantidade de dígitos
export const formatCpfCnpj = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
        return digits
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return digits
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// Formata Telefone: (00) 0000-0000 ou (00) 00000-0000
export const formatPhone = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
        return digits
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    }
    return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};

// Formata CEP: 00000-000
export const formatCEP = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
};

// Validação matemática de CPF (dígitos verificadores)
export const isValidCPF = (cpf: string): boolean => {
    if (!cpf) return false;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(clean.charAt(i), 10) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(9), 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(clean.charAt(i), 10) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    return rev === parseInt(clean.charAt(10), 10);
};

/**
 * Converte qualquer formato de entrada monetária (numérico ou textual) em número decimal (float).
 * Aceita entradas como: 100, "100", "100,50", "100.50", "1.500,00", "R$ 1.500,50", "1500,75", etc.
 */
export const parseCurrency = (value: string | number | undefined | null): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;

    let clean = String(value).trim();
    // Remove símbolos como R$, espaços e letras
    clean = clean.replace(/[^\d.,+-]/g, '');
    if (!clean) return 0;

    const hasComma = clean.includes(',');
    const hasDot = clean.includes('.');

    if (hasComma && hasDot) {
        // Ex: 1.500,50 ou 1,500.50
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
            // Padrão brasileiro: 1.500,50 -> remove os pontos e troca vírgula por ponto
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            // Padrão americano: 1,500.50 -> remove as vírgulas
            clean = clean.replace(/,/g, '');
        }
    } else if (hasComma) {
        // Apenas vírgula: padrão brasileiro (150,50 ou 1500,00)
        clean = clean.replace(',', '.');
    } else if (hasDot) {
        // Apenas ponto:
        const parts = clean.split('.');
        if (parts.length > 2) {
            // Mais de um ponto: milhares (ex: 1.000.000)
            clean = clean.replace(/\./g, '');
        } else if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
            // Exato 3 dígitos após ponto sem vírgula (ex: 1.500) -> milhar brasileiro
            clean = clean.replace('.', '');
        }
        // Caso contrário (ex: 150.50 ou 150.5), mantém o ponto como decimal
    }

    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
};

/**
 * Formata um valor numérico ou string no formato contábil brasileiro: R$ 1.500,00
 */
export const formatCurrency = (value: number | string | undefined | null): string => {
    const num = parseCurrency(value);
    return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * Máscara em tempo real para campos de digitação monetária (ex: 1250 vira R$ 12,50).
 */
export const formatCurrencyInput = (value: string | number): string => {
    if (value === undefined || value === null) return 'R$ 0,00';
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return '';
    const num = (parseInt(digits, 10) / 100);
    return formatCurrency(num);
};

