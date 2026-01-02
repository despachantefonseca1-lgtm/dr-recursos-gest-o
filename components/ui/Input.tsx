import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
    const baseStyles = "w-full border border-slate-300 rounded-xl p-3 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium disabled:opacity-50 disabled:bg-slate-50";

    return (
        <div className="space-y-1 w-full">
            {label && (
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <input
                className={`${baseStyles} ${error ? 'border-rose-500 focus:ring-rose-500' : ''} ${className}`}
                {...props}
            />
            {error && <span className="text-[10px] text-rose-500 font-bold ml-1">{error}</span>}
        </div>
    );
};
