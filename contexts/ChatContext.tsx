import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { User } from '../types';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
}

export interface OnlineUser {
  userId: string;
  userName: string;
  userRole: string;
  joinedAt: Date;
}

interface ChatContextValue {
  isOpen: boolean;
  unreadCount: number;
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (text: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserRef = useRef<User | null>(null);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  const sendMessage = useCallback((text: string) => {
    const currentUser = currentUserRef.current;
    if (!currentUser || !channelRef.current || !text.trim()) return;

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      text: text.trim(),
      timestamp: new Date(),
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: msg,
    });

    // Add own message immediately to local state
    setMessages(prev => [...prev, msg]);
  }, []);

  useEffect(() => {
    const currentUser = api.getCurrentUser();
    if (!currentUser) return;
    currentUserRef.current = currentUser;

    const channel = supabase.channel('dr-recursos-chat', {
      config: {
        broadcast: { ack: false },
        presence: { key: currentUser.id },
      },
    });

    channelRef.current = channel;

    // Listen for chat messages from other users
    channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      const msg = payload as ChatMessage;
      // Ignore own messages (already added locally)
      if (msg.userId === currentUser.id) return;

      setMessages(prev => [
        ...prev,
        { ...msg, timestamp: new Date(msg.timestamp) },
      ]);

      // Increment unread only if chat is closed
      setIsOpen(currentOpen => {
        if (!currentOpen) {
          setUnreadCount(c => c + 1);
        }
        return currentOpen;
      });
    });

    // Track presence (online users)
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{
        userId: string;
        userName: string;
        userRole: string;
        joinedAt: string;
      }>();

      const users: OnlineUser[] = [];
      Object.values(state).forEach(presences => {
        presences.forEach((p: any) => {
          users.push({
            userId: p.userId,
            userName: p.userName,
            userRole: p.userRole,
            joinedAt: new Date(p.joinedAt),
          });
        });
      });

      setOnlineUsers(users);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          joinedAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        unreadCount,
        messages,
        onlineUsers,
        openChat,
        closeChat,
        toggleChat,
        sendMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
