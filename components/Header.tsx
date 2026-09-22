
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LOGO_IMAGE } from '../constants';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Tarefa, StatusTarefa, UserRole, User, Infracao, StatusInfracao, hasPermission } from '../types';
import { useChatContext } from '../contexts/ChatContext';
import { useGlobalModal } from '../contexts/GlobalModalContext';
import { useUnidade } from '../contexts/UnidadeContext';

// Inner component that safely uses ChatContext inside Header
const ChatNavButton: React.FC = () => {
  const { toggleChat, unreadCount, onlineUsers } = useChatContext();
  const hasUnread = unreadCount > 0;
  const hasOnline = onlineUsers.length > 0;

  return (
    <button
      onClick={toggleChat}
      id="chat-nav-btn"
      title={`Chat interno${hasOnline ? ` · ${onlineUsers.length} online` : ''}`}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-lg border transition-all ${
        hasUnread
          ? 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40'
          : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
      }`}
    >
      💬

      {/* Unread badge — pulses when there are new messages */}
      {hasUnread && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-500 rounded-full text-[9px] text-white font-black flex items-center justify-center border-2 border-slate-900 animate-pulse shadow-md">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}

      {/* Online indicator dot when someone is online */}
      {!hasUnread && hasOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900" />
      )}
    </button>
  );
};

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openInfracaoModal } = useGlobalModal();
  const { unidades, unidadeAtual, unidadeIdSelecionada, selecionarUnidade, isAdmin, canSwitchUnidade, isMatriz } = useUnidade();
  const [pendingTasks, setPendingTasks] = useState<Tarefa[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [vencendoHoje, setVencendoHoje] = useState<Infracao[]>([]);
  const [vencidas, setVencidas] = useState<Infracao[]>([]);

  useEffect(() => {
    const currentUser = api.getCurrentUser();

    // Check for legacy user ID (migration fix)
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (currentUser && !isUuid(currentUser.id)) {
      alert("Sua sessão precisa ser atualizada para o novo sistema. Por favor, faça login novamente.");
      api.logout();
      navigate('/login');
      return;
    }

    setUser(currentUser);

    const checkAppStatus = async () => {
      // Diagnostic check
      const session = await supabase.auth.getSession();
      const hasSession = !!session.data.session;

      if (!currentUser) return;

      if (!hasSession) {
        setDebugInfo("Erro: Sessão Supabase perdida. Faça login novamente.");
        return;
      }

      try {
        const MATRIZ_UUID = '3794fc79-d9ba-4f18-afe2-2086474a282c';
        const effectiveUnidadeId = (!canSwitchUnidade && currentUser?.unidade_id)
          ? currentUser.unidade_id
          : (unidadeIdSelecionada || currentUser.unidade_id);
        const effectiveIsMatriz = (!canSwitchUnidade && currentUser?.unidade_id)
          ? (currentUser.unidade_id === MATRIZ_UUID || currentUser.unidade_id === 'matriz-bd')
          : isMatriz;

        const [tasks, notifs, infracoes] = await Promise.all([
          api.getTarefas(effectiveUnidadeId, effectiveIsMatriz),
          api.getNotifications(currentUser.id),
          currentUser.responsavelProtocolar ? api.getInfracoes(effectiveUnidadeId, effectiveIsMatriz) : Promise.resolve([])
        ]);

        // Debug output
        setDebugInfo(`User: ${currentUser.id.substring(0, 4)}... | Notifs: ${notifs.length} | Sessão: OK`);

        // 1. Check Tasks (Alerts)
        const now = new Date();
        const pending = tasks.filter(t => {
          if (t.status === StatusTarefa.CONCLUIDA) return false;
          // Ensure task is assigned specifically to this user (no unassigned tasks)
          if (!t.atribuidaPara || t.atribuidaPara !== currentUser.id) return false;

          // Se estiver em análise, só notifica se passar de 2 dias (48h)
          if (t.status === StatusTarefa.EM_ANALISE || t.status === StatusTarefa.AGUARDANDO_RESPOSTA) {
            const lastUpdate = t.ultimaNotificacaoCobranca ? new Date(t.ultimaNotificacaoCobranca) : new Date(t.dataCriacao);
            const diffHours = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));
            return diffHours >= 48; // Reaparece após 2 dias sem conclusão
          }

          return true;
        });
        setPendingTasks(pending);

        // 2. Check Notifications - Se o usuário pertence a uma filial específica, exibe apenas notificações da sua unidade
        let filteredNotifs = notifs;
        if (!canSwitchUnidade && currentUser?.unidade_id) {
          const userUnitId = currentUser.unidade_id;
          const isMatrizUser = userUnitId === MATRIZ_UUID || userUnitId === 'matriz-bd';
          if (!isMatrizUser) {
            filteredNotifs = notifs.filter(n => {
              let matchId: string | null = null;
              if (n.link) {
                const m = n.link.match(/edit_infracao=([^&]+)/);
                if (m && m[1]) matchId = m[1];
              }
              let matchAuto: string | null = null;
              if (n.titulo) {
                const mAuto = n.titulo.match(/(?:Acompanhamento|ALERTA DE PRESCRIÇÃO|Cobrança|Auto)[:\s]+([^\s\[\]]+)/i);
                if (mAuto && mAuto[1]) matchAuto = mAuto[1];
              }
              return infracoes.some(inf => 
                (matchId && inf.id === matchId) || 
                (matchAuto && inf.numeroAuto && inf.numeroAuto.trim().toLowerCase() === matchAuto.trim().toLowerCase())
              );
            });
          }
        }
        setNotifications(filteredNotifs);

        // 3. Check Protocol deadliness for responsavelProtocolar
        if (currentUser.responsavelProtocolar) {
          const getLocalDateString = (): string => {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          const todayStr = getLocalDateString();

          const todayList = infracoes.filter(inf => 
            inf.status === StatusInfracao.RECURSO_A_FAZER && 
            inf.dataLimiteProtocolo === todayStr
          );

          const expiredList = infracoes.filter(inf => 
            inf.status === StatusInfracao.RECURSO_A_FAZER && 
            inf.dataLimiteProtocolo && 
            inf.dataLimiteProtocolo < todayStr
          );

          setVencendoHoje(todayList);
          setVencidas(expiredList);
        } else {
          setVencendoHoje([]);
          setVencidas([]);
        }
      } catch (error: any) {
        console.error("Error creating notifications:", error);
        setDebugInfo(`Erro API: ${error.message || error.toString()}`);
      }
    };

    checkAppStatus();
    const interval = setInterval(checkAppStatus, 10000);
    return () => clearInterval(interval);
  }, [location.pathname, navigate, unidadeIdSelecionada, isMatriz]);

  const deleteNotification = async (id: string) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
    }
  };

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  const markAsRead = async (n: any) => {
    if (!n.lida) {
      await api.markNotificationAsRead(n.id);
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, lida: true } : item));
    }
    setShowNotifications(false);

    if (n.link) {
      // Check if notification targets an infraction edit
      const match = n.link.match(/edit_infracao=([^&]+)/);
      if (match && match[1]) {
        const infId = match[1];
        navigate(n.link);
        openInfracaoModal(infId);
        return;
      }

      // Fallback: If it's a notification mentioning an Auto in title
      const autoMatch = n.titulo?.match(/(?:Acompanhamento|ALERTA DE PRESCRIÇÃO|Cobrança|Prazo Próximo|PRAZO HOJE|Novo Recurso a Fazer):\s*(?:Auto\s*)?([^\s\[\]]+)/i);
      if (autoMatch && autoMatch[1]) {
        navigate('/recursos?tab=PROCESSOS');
        openInfracaoModal(null, { numeroAuto: autoMatch[1] });
        return;
      }

      navigate(n.link);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await api.markAllNotificationsAsRead(user.id);
      setNotifications(prev => prev.map(item => ({ ...item, lida: true })));
    } catch (e) {
      console.error("Erro ao marcar todas como lidas:", e);
    }
  };

  if (!user && location.pathname !== '/login') return null;
  if (location.pathname === '/login') return null;

  const navItems: { path: string; label: string; icon: string }[] = [];

  if (hasPermission(user, 'painel')) {
    navItems.push({ path: '/', label: 'Painel', icon: '📊' });
  }
  if (hasPermission(user, 'recursos')) {
    navItems.push({ path: '/recursos', label: 'Recursos', icon: '⚖️' });
  }
  if (hasPermission(user, 'despachante') || hasPermission(user, 'caixa')) {
    navItems.push({ path: '/despachante', label: 'Despachante', icon: '📋' });
  }
  if (hasPermission(user, 'tarefas')) {
    navItems.push({ path: '/tarefas', label: 'Tarefa', icon: '📝' });
  }
  if (hasPermission(user, 'usuarios')) {
    navItems.push({ path: '/usuarios', label: 'Usuários', icon: '👤' });
  }
  if (hasPermission(user, 'unidades')) {
    navItems.push({ path: '/unidades', label: 'Unidades', icon: '🏢' });
  }

  // Fallback de segurança se nenhuma permissão estiver ativa
  if (navItems.length === 0) {
    navItems.push({ path: '/', label: 'Painel', icon: '📊' });
  }

  const unreadCount = notifications.filter(n => !n.lida).length;

  return (
    <div className="flex flex-col sticky top-0 z-40">
      {/* Debug Info Strip */}
      {/* Debug Info Strip - Removed for production */}
      {/* 
      {debugInfo && (
        <div className="bg-black text-xs text-green-400 p-1 text-center font-mono">
          [DEBUG] {debugInfo}
        </div>
      )}
      */}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes customBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
        .animate-custom-blink {
          animation: customBlink 0.8s infinite;
        }
      `}} />

      {pendingTasks.length > 0 && (
        <div className="bg-rose-600 text-white text-[11px] py-1.5 px-4 flex justify-center items-center font-black uppercase tracking-widest animate-pulse border-b border-rose-700 shadow-lg cursor-pointer" onClick={() => navigate('/tarefas')}>
          <span className="bg-white text-rose-600 px-2 py-0.5 rounded mr-2">ATENÇÃO {user?.name.toUpperCase()}</span>
          Você possui {pendingTasks.length} pendências aguardando sua ação imediata!
        </div>
      )}

      {user?.responsavelProtocolar && vencidas.length > 0 && (
        <div 
          className="bg-red-600 text-white text-[11px] py-1.5 px-4 flex justify-center items-center font-black uppercase tracking-widest border-b border-red-700 shadow-lg cursor-pointer animate-custom-blink select-none" 
          onClick={() => navigate('/recursos?tab=PROCESSOS')}
        >
          <span className="bg-white text-red-600 px-2 py-0.5 rounded mr-2">⚠️ COBRANÇA DE PROTOCOLO VENCIDO</span>
          Você possui {vencidas.length} recurso(s) com prazo vencido e sem protocolo! Atualize o status imediatamente.
        </div>
      )}

      {user?.responsavelProtocolar && vencendoHoje.length > 0 && (
        <div 
          className="bg-amber-500 text-white text-[11px] py-1.5 px-4 flex justify-center items-center font-black uppercase tracking-widest border-b border-amber-600 shadow-lg cursor-pointer select-none" 
          onClick={() => navigate('/recursos?tab=PROCESSOS')}
        >
          <span className="bg-white text-amber-500 px-2 py-0.5 rounded mr-2">📅 PROTOCOLO VENCENDO HOJE</span>
          Atenção: Você possui {vencendoHoje.length} recurso(s) vencendo hoje! Por favor, realize o protocolo.
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
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${location.pathname === item.path
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

              {/* Chat Button */}
              <ChatNavButton />

              {/* Seletor / Indicador de Unidade */}
              <div className="relative ml-2">
                {canSwitchUnidade ? (
                  <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-xl px-2.5 py-1.5 transition-all shadow-inner">
                    <span className="text-sm">🏢</span>
                    <select
                      value={unidadeIdSelecionada}
                      onChange={(e) => selecionarUnidade(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer pr-1"
                      title="Alternar unidade ou ver tudo consolidado"
                    >
                      <option value="TODAS" className="bg-slate-900 text-white font-bold">
                        🌐 Todas as Unidades (Geral)
                      </option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                          {u.is_matriz ? '⭐ ' : '📍 '} {u.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-indigo-300 shadow-inner" title="Sua unidade de trabalho">
                    <span className="text-sm">📍</span>
                    <span className="truncate max-w-[130px]">{unidadeAtual?.nome || 'Unidade Local'}</span>
                  </div>
                )}
              </div>

              {/* Notification Bell */}
              <div className="relative ml-2">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 hover:bg-slate-700 relative text-lg"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center border-2 border-slate-900 font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Notificações</span>
                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button onClick={markAllAsRead} className="text-[10px] text-indigo-600 font-bold hover:underline transition-all hover:text-indigo-800">
                            Marcar todas como lidas
                          </button>
                        )}
                        <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs font-medium">
                          Nenhuma notificação recente.
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => markAsRead(n)}
                            className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors relative group ${!n.lida ? 'bg-indigo-50/50 border-l-4 border-l-indigo-500' : 'opacity-70 grayscale-[0.5]'}`}
                          >
                            <div className="flex justify-between items-start mb-1 pr-4">
                              <h5 className={`text-sm font-bold ${!n.lida ? 'text-indigo-900' : 'text-slate-700'}`}>{n.titulo}</h5>
                              <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                                {new Date(n.data).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed pr-4">{n.mensagem}</p>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n.id);
                              }}
                              className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-rose-50"
                              title="Excluir notificação"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

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
