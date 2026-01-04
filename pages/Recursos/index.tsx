import React, { useState } from 'react';
import Processos from './Processos';
import Clientes from './Clientes';
import Caixa from './Caixa';
import { UserRole } from '../../types';
import { DbService } from '../../services/db';

const Recursos: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'PROCESSOS' | 'CLIENTES' | 'CAIXA'>('PROCESSOS');
    const user = DbService.getCurrentUser();
    const isAdmin = user?.role === UserRole.ADMIN;

    return (
        <div className="container mx-auto px-4 py-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                        Gestão de <span className="text-indigo-600">Recursos</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Gerencie processos, clientes e financeiro</p>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-2xl mb-8 w-fit">
                <button
                    onClick={() => setActiveTab('PROCESSOS')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'PROCESSOS'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    PROCESSOS
                </button>
                <button
                    onClick={() => setActiveTab('CLIENTES')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'CLIENTES'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    CLIENTES
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('CAIXA')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'CAIXA'
                                ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        CAIXA
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
                {activeTab === 'PROCESSOS' && <Processos />}
                {activeTab === 'CLIENTES' && <Clientes />}
                {activeTab === 'CAIXA' && isAdmin && <Caixa />}
            </div>
        </div>
    );
};

export default Recursos;
