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

// ---------------------------------------------------------------------------
// Notification helpers (outside component to avoid recreation)
// ---------------------------------------------------------------------------

/** Plays a soft notification beep using the Web Audio API — no external files needed */
const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two-tone "ding" — pleasant and not annoying
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
    // Audio not available — silently ignore
  }
};

/** Request browser Push Notification permission (call once on mount) */
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

/** Fire a browser Push Notification */
const sendPushNotification = (senderName: string, text: string) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return; // Only when tab is in background

  try {
    const n = new Notification(`💬 ${senderName} — Dr. Recursos`, {
      body: text.length > 80 ? text.slice(0, 80) + '…' : text,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'chat-message', // Replaces previous notification instead of stacking
      renotify: true,
      silent: false,
    });

    // Clicking the notification focuses the tab
    n.onclick = () => {
      window.focus();
      n.close();
    };

    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6000);
  } catch {
    // Notifications blocked or unavailable — silently ignore
  }
};

// ---------------------------------------------------------------------------
// Tab title blinking
// ---------------------------------------------------------------------------

let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;
const originalTitle = document.title;

const startTitleBlink = (senderName: string) => {
  if (titleBlinkInterval) return; // Already blinking
  let toggle = true;
  titleBlinkInterval = setInterval(() => {
    document.title = toggle
      ? `💬 Mensagem de ${senderName}!`
      : originalTitle;
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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const isOpenRef = useRef(false); // Sync ref to avoid stale closure in broadcast handler

  // Keep isOpenRef in sync
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Stop title blink when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        stopTitleBlink();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Stop title blink when chat is opened
  useEffect(() => {
    if (isOpen) stopTitleBlink();
  }, [isOpen]);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    stopTitleBlink();
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) {
        setUnreadCount(0);
        stopTitleBlink();
      }
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

    // Request push notification permission as soon as user is logged in
    requestNotificationPermission();

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

      // ── Notifications: only when chat is closed ──────────────────────────
      if (!isOpenRef.current) {
        setUnreadCount(c => c + 1);

        // 1. Sound beep (always, regardless of visibility)
        playNotificationSound();

        // 2. Tab title blink (always when chat is closed)
        startTitleBlink(msg.userName);

        // 3. Browser push notification (only when tab is hidden)
        sendPushNotification(msg.userName, msg.text);
      }
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
      stopTitleBlink();
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
