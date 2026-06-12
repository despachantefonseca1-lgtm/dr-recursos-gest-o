import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatContext, ChatMessage, OnlineUser } from '../contexts/ChatContext';
import { api } from '../lib/api';

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatJoinedAt = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'agora mesmo';
  if (diffMins === 1) return 'há 1 min';
  if (diffMins < 60) return `há ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'há 1h';
  return `há ${diffHours}h`;
};

const UserInitials: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const colors = [
    'from-indigo-500 to-blue-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-sky-600',
  ];
  const colorIndex = name.charCodeAt(0) % colors.length;

  const sizeClass = size === 'sm'
    ? 'w-7 h-7 text-[10px]'
    : 'w-9 h-9 text-xs';

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-black flex-shrink-0 shadow-md`}
    >
      {initials}
    </div>
  );
};

const MessageBubble: React.FC<{ msg: ChatMessage; isOwn: boolean }> = ({ msg, isOwn }) => {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && <UserInitials name={msg.userName} size="sm" />}
      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">{msg.userName}</span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isOwn
              ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-sm'
              : 'bg-white text-slate-700 rounded-bl-sm border border-slate-100'
          }`}
        >
          {msg.text}
        </div>
        <span className="text-[9px] text-slate-300 mt-1 px-1">
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
};

const OnlineUserItem: React.FC<{ user: OnlineUser; isCurrentUser: boolean }> = ({
  user,
  isCurrentUser,
}) => (
  <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors group">
    <div className="relative">
      <UserInitials name={user.userName} size="sm" />
      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white shadow-sm" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-slate-700 truncate">
        {user.userName}
        {isCurrentUser && (
          <span className="ml-1 text-[9px] font-normal text-indigo-400">(você)</span>
        )}
      </p>
      <p className="text-[9px] text-slate-400">Online {formatJoinedAt(user.joinedAt)}</p>
    </div>
  </div>
);

type Tab = 'chat' | 'online';

const Chat: React.FC = () => {
  const location = useLocation();
  const { isOpen, toggleChat, messages, onlineUsers, sendMessage, unreadCount } = useChatContext();
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUser = api.getCurrentUser();

  // Don't render on the login page
  if (location.pathname === '/login' || !currentUser) return null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // Focus input when opening chat
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .chat-slide-up {
          animation: chatSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .chat-pop {
          animation: chatPop 0.3s ease-out;
        }
      `}</style>

      {/* Floating widget */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">

        {/* Chat panel */}
        {isOpen && (
          <div className="chat-slide-up w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <div>
                  <p className="text-white text-sm font-bold leading-none">Chat Interno</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {onlineUsers.length} usuário{onlineUsers.length !== 1 ? 's' : ''} online
                  </p>
                </div>
              </div>
              <button
                onClick={toggleChat}
                className="w-7 h-7 rounded-lg bg-slate-700/60 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2.5 text-xs font-bold transition-all relative ${
                  activeTab === 'chat'
                    ? 'text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Mensagens
                {activeTab === 'chat' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('online')}
                className={`flex-1 py-2.5 text-xs font-bold transition-all relative flex items-center justify-center gap-1.5 ${
                  activeTab === 'online'
                    ? 'text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Online ({onlineUsers.length})
                {activeTab === 'online' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
                )}
              </button>
            </div>

            {/* Tab: Chat Messages */}
            {activeTab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto px-3 py-4 bg-slate-50/50 space-y-0">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-3 text-2xl">
                        💬
                      </div>
                      <p className="text-slate-500 text-sm font-semibold">Nenhuma mensagem ainda</p>
                      <p className="text-slate-400 text-xs mt-1">
                        Seja o primeiro a enviar uma mensagem!
                      </p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={msg.userId === currentUser?.id}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="px-3 py-3 border-t border-slate-100 bg-white flex-shrink-0">
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Escreva uma mensagem..."
                      maxLength={500}
                      className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputText.trim()}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all flex-shrink-0 ${
                        inputText.trim()
                          ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-md hover:shadow-indigo-200 active:scale-95'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      ➤
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-300 mt-1.5 text-center">
                    Enter para enviar · Mensagens não são salvas
                  </p>
                </div>
              </>
            )}

            {/* Tab: Online Users */}
            {activeTab === 'online' && (
              <div className="flex-1 overflow-y-auto p-2">
                {onlineUsers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8">
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3 text-2xl">
                      👥
                    </div>
                    <p className="text-slate-500 text-sm font-semibold">Ninguém online</p>
                    <p className="text-slate-400 text-xs mt-1">
                      Os usuários aparecerão aqui quando logarem.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {onlineUsers.map(user => (
                      <OnlineUserItem
                        key={user.userId}
                        user={user}
                        isCurrentUser={user.userId === currentUser?.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={toggleChat}
          id="chat-toggle-btn"
          className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
            isOpen
              ? 'bg-slate-700 hover:bg-slate-600 rotate-0'
              : 'bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500'
          }`}
          title={isOpen ? 'Fechar chat' : 'Abrir chat'}
        >
          <span className="transition-all duration-300">
            {isOpen ? '✕' : '💬'}
          </span>

          {/* Unread badge */}
          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-rose-500 rounded-full text-[10px] text-white font-black flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}

          {/* Online indicator ring when users are online */}
          {!isOpen && onlineUsers.length > 0 && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
            </span>
          )}
        </button>
      </div>
    </>
  );
};

export default Chat;
