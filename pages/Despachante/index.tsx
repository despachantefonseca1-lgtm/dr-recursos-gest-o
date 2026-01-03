import React from 'react';
import { useNavigate } from 'react-router-dom';

const DespachanteLanding: React.FC = () => {
    const navigate = useNavigate();

    const cards = [
        {
            title: 'Cadastro de Serviço',
            description: 'Abre o formulário externo de serviços do Google Apps Script.',
            icon: '📝',
            action: () => window.open('https://script.google.com/macros/s/AKfycbwzmGb4kABJw9hxQMhmQS21uOz6JZbEeB8U3FAa3KakbkEucmAITBr9NMMGhxnu447qGA/exec', '_blank'),
            external: true,
        },
        {
            title: 'Cadastro de Cliente',
            description: 'Módulo interno completo para gerenciamento de clientes e serviços.',
            icon: '👥',
            action: () => navigate('/despachante/clientes'),
            external: false,
        },
        {
            title: 'Parcelamento de Débitos',
            description: 'Abre o sistema externo Parcela Fácil.',
            icon: '💳',
            action: () => window.open('https://parcelafacil.vercel.app/', '_blank'),
            external: true,
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Módulo Despachante</h1>
                    <p className="text-slate-500">Selecione uma das opções abaixo para prosseguir</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card, index) => (
                    <div
                        key={index}
                        onClick={card.action}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group"
                    >
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                            {card.icon}
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                {card.title}
                            </h3>
                            {card.external && (
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Externo ↗</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            {card.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DespachanteLanding;
