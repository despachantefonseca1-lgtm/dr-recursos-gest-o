import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface InfracaoModalConfig {
    isOpen: boolean;
    id?: string | null;
    numeroAuto?: string;
    onSave?: () => void;
}

export interface ClienteModalConfig {
    isOpen: boolean;
    id?: string | null;
    onSave?: () => void;
}

interface GlobalModalContextType {
    infracaoModal: InfracaoModalConfig;
    clienteModal: ClienteModalConfig;
    openInfracaoModal: (id?: string | null, params?: { numeroAuto?: string, onSave?: () => void }) => void;
    closeInfracaoModal: () => void;
    openClienteModal: (id?: string | null, params?: { onSave?: () => void }) => void;
    closeClienteModal: () => void;
}

const GlobalModalContext = createContext<GlobalModalContextType | undefined>(undefined);

export const GlobalModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [infracaoModal, setInfracaoModal] = useState<InfracaoModalConfig>({ isOpen: false });
    const [clienteModal, setClienteModal] = useState<ClienteModalConfig>({ isOpen: false });

    const openInfracaoModal = (id?: string | null, params?: { numeroAuto?: string, onSave?: () => void }) => {
        setInfracaoModal({
            isOpen: true,
            id: id || null,
            numeroAuto: params?.numeroAuto,
            onSave: params?.onSave,
        });
    };

    const closeInfracaoModal = () => {
        setInfracaoModal(prev => ({ ...prev, isOpen: false }));
    };

    const openClienteModal = (id?: string | null, params?: { onSave?: () => void }) => {
        setClienteModal({
            isOpen: true,
            id: id || null,
            onSave: params?.onSave,
        });
    };

    const closeClienteModal = () => {
        setClienteModal(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <GlobalModalContext.Provider value={{
            infracaoModal,
            clienteModal,
            openInfracaoModal,
            closeInfracaoModal,
            openClienteModal,
            closeClienteModal
        }}>
            {children}
        </GlobalModalContext.Provider>
    );
};

export const useGlobalModal = () => {
    const context = useContext(GlobalModalContext);
    if (!context) {
        throw new Error('useGlobalModal must be used within a GlobalModalProvider');
    }
    return context;
};
