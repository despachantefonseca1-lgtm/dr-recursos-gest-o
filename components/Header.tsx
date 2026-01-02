
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LOGO_IMAGE } from '../constants';
import { api } from '../lib/api';
import { DbService } from '../services/db';
import { Tarefa, StatusTarefa, UserRole, User } from '../types';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingTasks, setPendingTasks] = useState<Tarefa[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const currentUser = DbService.getCurrentUser();
    setUser(currentUser);
    
    const checkTasks = async () => {
      const tasks = await api.getTarefas();
      const now = new Date();
      
      const pending = tasks.filter(t => {
        if (t.status === StatusTarefa.CONCLUIDA) return false;
        
        // Se estiver em análise, só notifica se passar de 2 dias (48h)
        if (t.status === StatusTarefa.EM_ANALISE) {
          const lastUpdate = t.ultimaNotificacaoCobranca ? new Date(t.ultimaNotificacaoCobranca) : new Date(t.dataCriacao);
          const diffHours = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));
          return diffHours >= 48; // Reaparece após 2 dias sem conclusão
        }
        
        // Tarefas pendentes sempre aparecem
        return true;
      });
      
      setPendingTasks(pending);
    };
    checkTasks();
    const interval = setInterval(checkTasks, 10000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleLogout = () => {
    DbService.logout();
    navigate('/login');
  };

  if (!user && location.pathname !== '/login') return null;
  if (location.pathname === '/login') return null;

  const navItems = [
    { path: '/', label: 'Painel', icon: '📊' },
    { path: '/infracoes', label: 'Infrações', icon: '⚖️' },
    { path: '/tarefas', label: 'Tarefa', icon: '📝' },
  ];

  if (user?.role === UserRole.ADMIN) {
    navItems.push({ path: '/usuarios', label: 'Usuários', icon: '👤' });
  }

  return (
    <div className="flex flex-col sticky top-0 z-40">
      {pendingTasks.length > 0 && (
        <div className="bg-rose-600 text-white text-[11px] py-1.5 px-4 flex justify-center items-center font-black uppercase tracking-widest animate-pulse border-b border-rose-700 shadow-lg">
          <span className="bg-white text-rose-600 px-2 py-0.5 rounded mr-2">ATENÇÃO {user?.name.toUpperCase()}</span>
          Você possui {pendingTasks.length} pendências aguardando sua ação imediata!
        </div>
      )}
      
      <header className="bg-slate-900 text-white shadow-2xl border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-700 shadow-inner group">
                 <img 
                   src={LOGO_IMAGE} 
                   alt="Doutor Recursos" 
                   className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                 />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight leading-none">Doutor <span className="text-indigo-400">Recursos</span></span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mt-1">Law Management System</span>
              </div>
            </div>
            
            <nav className="flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${
                    location.pathname === item.path 
                      ? 'bg-slate-800 text-white shadow-inner ring-1 ring-slate-700' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <span className="relative">
                    {item.icon}
                    {item.path === '/tarefas' && pendingTasks.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping border-2 border-slate-900"></span>
                    )}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
              
              <div className="ml-6 pl-6 border-l border-slate-800 flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-white">{user?.name}</p>
                  <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">{user?.role === UserRole.ADMIN ? 'Administrador' : 'Colaborador'}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-black border border-slate-700 shadow-lg transition-all hover:bg-rose-600 hover:border-rose-500"
                  title="Sair do sistema"
                >
                  🚪
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Header;
