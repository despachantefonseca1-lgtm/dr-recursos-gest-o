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
  mentionedUserId?: string;
  mentionedUserName?: string;
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
  isMentionAlert: boolean;
  mentionedBy: string | null;
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  clearMentionAlert: () => void;
  sendMessage: (text: string, mentionedUserId?: string, mentionedUserName?: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const tones = [880, 1100];
    tones.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.12;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.35);
    });
  } catch {
    // Audio not available
  }
};

const playMentionSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const tones = [1100, 880, 1100];
    tones.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.14;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  } catch {
    // silently ignore
  }
};

const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

const sendPushNotification = (senderName: string, text: string) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  try {
    const n = new Notification(`💬 ${senderName} — Dr. Recursos`, {
      body: text.length > 80 ? text.slice(0, 80) + '…' : text,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'chat-message',
      renotify: true,
      silent: false,
    } as NotificationOptions & { renotify?: boolean });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  } catch {
    // Notifications blocked or unavailable
  }
};

let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;
const originalTitle = document.title;

const startTitleBlink = (senderName: string) => {
  if (titleBlinkInterval) return;
  let toggle = true;
  titleBlinkInterval = setInterval(() => {
    document.title = toggle ? `💬 Mensagem de ${senderName}!` : originalTitle;
    toggle = !toggle;
  }, 1000);
};

const stopTitleBlink = () => {
  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
    titleBlinkInterval = null;
  }
  document.title = originalTitle;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMentionAlert, setIsMentionAlert] = useState(false);
  const [mentionedBy, setMentionedBy] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  useEffect(() => {
    const handleVisibilityChange = () => { if (!document.hidden) stopTitleBlink(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => { if (isOpen) stopTitleBlink(); }, [isOpen]);

  const clearMentionAlert = useCallback(() => {
    setIsMentionAlert(false);
    setMentionedBy(null);
  }, []);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    setIsMentionAlert(false);
    setMentionedBy(null);
    stopTitleBlink();
  }, []);

  const closeChat = useCallback(() => { setIsOpen(false); }, []);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) {
        setUnreadCount(0);
        setIsMentionAlert(false);
        setMentionedBy(null);
        stopTitleBlink();
      }
      return !prev;
    });
  }, []);

  const sendMessage = useCallback((text: string, mentionedUserId?: string, mentionedUserName?: string) => {
    const currentUser = currentUserRef.current;
    if (!currentUser || !channelRef.current || !text.trim()) return;

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      text: text.trim(),
      timestamp: new Date(),
      mentionedUserId,
      mentionedUserName,
    };

    channelRef.current.send({ type: 'broadcast', event: 'chat_message', payload: msg });

    if (mentionedUserId && mentionedUserId !== currentUser.id) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_mention',
        payload: { targetUserId: mentionedUserId, senderName: currentUser.name, messageId: msg.id },
      });
    }

    setMessages(prev => [...prev, msg]);
  }, []);

  useEffect(() => {
    const currentUser = api.getCurrentUser();
    if (!currentUser) return;
    currentUserRef.current = currentUser;
    requestNotificationPermission();

    const channel = supabase.channel('dr-recursos-chat', {
      config: { broadcast: { ack: false }, presence: { key: currentUser.id } },
    });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      const msg = payload as ChatMessage;
      if (msg.userId === currentUser.id) return;
      setMessages(prev => [...prev, { ...msg, timestamp: new Date(msg.timestamp) }]);
      if (!isOpenRef.current) {
        setUnreadCount(c => c + 1);
        playNotificationSound();
        startTitleBlink(msg.userName);
        sendPushNotification(msg.userName, msg.text);
      }
    });

    channel.on('broadcast', { event: 'chat_mention' }, ({ payload }) => {
      const { targetUserId, senderName } = payload as { targetUserId: string; senderName: string; messageId: string };
      if (targetUserId !== currentUser.id) return;
      playMentionSound();
      if (!isOpenRef.current) {
        setIsMentionAlert(true);
        setMentionedBy(senderName);
        setTimeout(() => {
          setIsOpen(true);
          setUnreadCount(0);
          stopTitleBlink();
        }, 600);
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ userId: string; userName: string; userRole: string; joinedAt: string }>();
      const users: OnlineUser[] = [];
      Object.values(state).forEach(presences => {
        presences.forEach((p: any) => {
          users.push({ userId: p.userId, userName: p.userName, userRole: p.userRole, joinedAt: new Date(p.joinedAt) });
        });
      });
      setOnlineUsers(users);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: currentUser.id, userName: currentUser.name, userRole: currentUser.role, joinedAt: new Date().toISOString() });
      }
    });

    return () => { channel.unsubscribe(); channelRef.current = null; stopTitleBlink(); };
  }, []);

  return (
    <ChatContext.Provider value={{ isOpen, unreadCount, isMentionAlert, mentionedBy, messages, onlineUsers, openChat, closeChat, toggleChat, clearMentionAlert, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
};
