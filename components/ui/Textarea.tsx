import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, className = '', ...props }) => {
    const baseStyles = "w-full border border-slate-300 rounded-xl p-3 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium disabled:opacity-50 disabled:bg-slate-50 min-h-[80px]";

    return (
        <div className="space-y-1 w-full">
            {label && (
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <textarea
                className={`${baseStyles} ${error ? 'border-rose-500 focus:ring-rose-500' : ''} ${className}`}
                {...props}
            />
            {error && <span className="text-[10px] text-rose-500 font-bold ml-1">{error}</span>}
        </div>
    );
};
