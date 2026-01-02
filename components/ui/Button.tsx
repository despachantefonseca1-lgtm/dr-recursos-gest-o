import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2";
  
  const variants = {
    primary: "bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 shadow-indigo-100",
    secondary: "bg-slate-900 text-white shadow-xl hover:bg-slate-800 shadow-slate-200",
    danger: "bg-rose-600 text-white shadow-xl hover:bg-rose-700 shadow-rose-100",
    success: "bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 shadow-emerald-100",
    ghost: "text-slate-400 hover:text-slate-700 hover:bg-slate-50",
    outline: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm"
  };

  const sizes = {
    sm: "text-[10px] px-4 py-2 rounded-xl",
    md: "text-xs px-6 py-3 rounded-2xl",
    lg: "text-xs px-8 py-4 rounded-3xl"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="animate-pulse">Loading...</span>
      ) : (
        <>
          {icon && <span>{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};
