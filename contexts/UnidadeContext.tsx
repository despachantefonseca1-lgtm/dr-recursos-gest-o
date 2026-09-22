import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Unidade, UserRole, User, isMasterAdmin } from '../types';
import { api } from '../lib/api';

interface UnidadeContextType {
  unidades: Unidade[];
  unidadeAtual: Unidade | null;
  unidadeIdSelecionada: string; // UUID ou 'TODAS'
  isTodasUnidades: boolean;
  isMatriz: boolean;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  canSwitchUnidade: boolean;
  carregando: boolean;
  selecionarUnidade: (id: string) => void;
  carregarUnidades: () => Promise<void>;
  salvarUnidade: (unidade: Partial<Unidade>) => Promise<Unidade>;
  excluirUnidade: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'dr_recursos_unidade_selecionada';

// Unidades padrão de contingência caso o banco ainda não tenha retornado
const UNIDADES_FALLBACK: Unidade[] = [
  {
    id: 'matriz-bd',
    nome: 'Matriz - Bom Despacho',
    slug: 'matriz-bd',
    cidade: 'Bom Despacho',
    uf: 'MG',
    endereco_completo: 'Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002',
    telefone: '(37) 99999-9999',
    email: 'ifadvogado214437@gmail.com',
    cidade_emissao: 'Bom Despacho/MG',
    local_pagamento_padrao: 'Bom Despacho/MG',
    advogado_nome: 'Israel Fonseca',
    advogado_oab_numero: '214.437',
    advogado_oab_uf: 'MG',
    advogado_cpf: '073.719.596-71',
    advogado_qualificacao: 'Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório profissional na Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com',
    is_matriz: true,
    ativo: true
  },
  {
    id: 'nova-serrana',
    nome: 'Unidade Nova Serrana',
    slug: 'nova-serrana',
    cidade: 'Nova Serrana',
    uf: 'MG',
    endereco_completo: 'Centro, Nova Serrana/MG',
    telefone: '(37) 99999-9999',
    email: 'ifadvogado214437@gmail.com',
    cidade_emissao: 'Nova Serrana/MG',
    local_pagamento_padrao: 'Nova Serrana/MG',
    advogado_nome: 'Israel Fonseca',
    advogado_oab_numero: '214.437',
    advogado_oab_uf: 'MG',
    advogado_cpf: '073.719.596-71',
    advogado_qualificacao: 'Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório profissional no Centro, Nova Serrana/MG, endereço eletrônico ifadvogado214437@gmail.com',
    is_matriz: false,
    ativo: true
  }
];

const MATRIZ_UUID = '3794fc79-d9ba-4f18-afe2-2086474a282c';
const isMatrizId = (id?: string | null) => id === MATRIZ_UUID || id === 'matriz-bd';

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

export const UnidadeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => api.getCurrentUser());

  // Mantém currentUser sincronizado com mudanças de autenticação/storage
  useEffect(() => {
    const syncUser = () => {
      const u = api.getCurrentUser();
      setCurrentUser(u);
    };

    window.addEventListener('storage', syncUser);
    const interval = setInterval(syncUser, 1000);
    return () => {
      window.removeEventListener('storage', syncUser);
      clearInterval(interval);
    };
  }, []);

  const masterAdmin = isMasterAdmin(currentUser);
  const canSwitchUnidade = masterAdmin;
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const getInitialUnidadeId = () => {
    const user = api.getCurrentUser();
    const isMaster = isMasterAdmin(user);
    // Se o usuário possui uma unidade vinculada e não é o Administrador Geral Master, fixa imediatamente a unidade dele
    if (!isMaster && user?.unidade_id) {
      return user.unidade_id;
    }
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) return savedId;
    return 'TODAS';
  };

  const [unidadeIdSelecionada, setUnidadeIdSelecionada] = useState<string>(getInitialUnidadeId);
  const [carregando, setCarregando] = useState<boolean>(true);

  const carregarUnidades = async () => {
    try {
      setCarregando(true);
      const data = await api.getUnidades();
      if (data && data.length > 0) {
        setUnidades(data);
      } else {
        setUnidades(UNIDADES_FALLBACK);
      }
    } catch (e) {
      console.warn('Erro ao carregar unidades, usando fallback:', e);
      setUnidades(UNIDADES_FALLBACK);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUnidades();
  }, []);

  // Ajusta a unidade selecionada com base no perfil do usuário e no localStorage
  useEffect(() => {
    // Se o usuário não tem permissão de troca global (ex: Rosi em Nova Serrana, ou colaboradores vinculados)
    if (!canSwitchUnidade && currentUser?.unidade_id) {
      if (unidadeIdSelecionada !== currentUser.unidade_id) {
        setUnidadeIdSelecionada(currentUser.unidade_id);
      }
      return;
    }

    if (unidades.length === 0) return;

    // Para o Administrador Geral (ou usuário sem unidade travada), recupera do localStorage
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId && (savedId === 'TODAS' || unidades.some(u => u.id === savedId))) {
      setUnidadeIdSelecionada(savedId);
    } else {
      // Padrão: Matriz ou TODAS
      const matriz = unidades.find(u => u.is_matriz) || unidades[0];
      const defaultId = matriz ? matriz.id : 'TODAS';
      setUnidadeIdSelecionada(defaultId);
    }
  }, [unidades, currentUser?.id, currentUser?.unidade_id, canSwitchUnidade]);

  const selecionarUnidade = (id: string) => {
    // Se o usuário estiver vinculado a uma unidade específica e não for o Master Admin, bloqueia a troca
    if (!canSwitchUnidade) {
      return;
    }
    setUnidadeIdSelecionada(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const salvarUnidade = async (dados: Partial<Unidade>): Promise<Unidade> => {
    const salva = await api.saveUnidade(dados);
    await carregarUnidades();
    return salva;
  };

  const excluirUnidade = async (id: string): Promise<void> => {
    await api.deleteUnidade(id);
    await carregarUnidades();
    if (unidadeIdSelecionada === id) {
      selecionarUnidade('TODAS');
    }
  };

  const effectiveId = (!canSwitchUnidade && currentUser?.unidade_id) ? currentUser.unidade_id : unidadeIdSelecionada;

  const unidadeAtual =
    unidades.find(u => u.id === effectiveId) ||
    (!canSwitchUnidade && currentUser?.unidade_id ? unidades.find(u => u.id === currentUser.unidade_id) : null) ||
    (canSwitchUnidade ? (unidades.find(u => u.is_matriz) || unidades[0] || null) : null);

  const isTodasUnidades = canSwitchUnidade && effectiveId === 'TODAS';
  const isMatriz = !isTodasUnidades && (
    isMatrizId(effectiveId) ||
    (unidadeAtual?.is_matriz === true || unidadeAtual?.slug === 'matriz-bd')
  );

  return (
    <UnidadeContext.Provider
      value={{
        unidades,
        unidadeAtual,
        unidadeIdSelecionada,
        isTodasUnidades,
        isMatriz,
        isAdmin,
        isMasterAdmin: masterAdmin,
        canSwitchUnidade,
        carregando,
        selecionarUnidade,
        carregarUnidades,
        salvarUnidade,
        excluirUnidade
      }}
    >
      {children}
    </UnidadeContext.Provider>
  );
};

export const useUnidade = () => {
  const context = useContext(UnidadeContext);
  if (!context) {
    throw new Error('useUnidade deve ser usado dentro de um UnidadeProvider');
  }
  return context;
};
