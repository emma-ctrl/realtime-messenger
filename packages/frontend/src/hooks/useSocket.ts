import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketProps {
  user: { id: number; username: string } | null;
}

interface SocketMessage {
  threadId: number;
  message: {
    id: number;
    content: string;
    createdAt: string;
    sender: { id: number; username: string };
    isFromCurrentUser: boolean;
  };
}

/**
 * Real-time WebSocket hook with JWT authentication
 */
export function useSocket({ user }: UseSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messageHandlersRef = useRef<Set<(data: SocketMessage) => void>>(new Set());

  // Connect when user is authenticated
  useEffect(() => {
    if (!user) {
      // Disconnect on logout
      if (socketRef.current) {
        console.log('🔌 Disconnecting Socket.io (user logged out)');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Prevent duplicate connections
    if (socketRef.current?.connected) {
      console.log('🔌 Socket already connected, skipping duplicate connection');
      return;
    }

    // Get JWT token
    const token = localStorage.getItem('auth-token');
    if (!token) {
      console.error('❌ No auth token found for Socket.io connection');
      setError('No authentication token');
      return;
    }

    console.log(`🔌 Connecting to Socket.io as ${user.username}...`);

    // Create connection with auth
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(API_URL, {
      withCredentials: true,
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    // Event handlers
    socket.on('connect', () => {
      console.log(`✅ Socket.io connected as ${user.username} (${socket.id})`);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔴 Socket.io disconnected: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
      setError(`Connection failed: ${error.message}`);
      setIsConnected(false);
    });

    // Message receiving
    socket.on('new_message', (data: SocketMessage) => {
      console.log(`📨 Real-time message received for thread ${data.threadId}:`, data.message.content);
      
      // Notify handlers
      messageHandlersRef.current.forEach(handler => handler(data));
    });

    // Join notifications
    socket.on('user_joined_thread', (data) => {
      console.log(`👋 ${data.username} joined thread ${data.threadId}`);
    });

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up Socket.io connection');
      socket.disconnect();
    };
  }, [user]);

  // Join thread room for targeted messages
  const joinThread = (threadId: number) => {
    if (socketRef.current?.connected) {
      console.log(`📂 Joining thread room: thread_${threadId}`);
      socketRef.current.emit('join_thread', { threadId });
    } else {
      console.warn('⚠️  Socket not connected, cannot join thread room');
    }
  };

  // Register message handler
  const onMessage = (handler: (data: SocketMessage) => void) => {
    messageHandlersRef.current.add(handler);
    
    // Return cleanup
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  };

  // Send message via Socket.io (optional - we use tRPC)
  const sendMessage = (threadId: number, content: string) => {
    if (socketRef.current?.connected) {
      console.log(`📤 Sending message via Socket.io to thread ${threadId}`);
      socketRef.current.emit('send_message', { threadId, content });
    } else {
      console.warn('⚠️  Socket not connected, cannot send message');
    }
  };

  return {
    isConnected,
    error,
    joinThread,
    onMessage,
    sendMessage,
    socket: socketRef.current,
  };
}

