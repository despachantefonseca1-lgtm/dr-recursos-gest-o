import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 border border-white/20"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-8 border-b border-slate-100">
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex items-center justify-center font-bold text-xl"
                        aria-label="Fechar modal"
                    >
                        ×
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {children}
                </div>

                {footer && (
                    <div className="p-6 bg-slate-50 border-t border-slate-100 rounded-b-[2.5rem] flex justify-end space-x-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
