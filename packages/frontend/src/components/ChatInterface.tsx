import React, { useState, useEffect, useRef } from 'react';
import { trpc } from '../lib/trpc';
import { useSocket } from '../hooks/useSocket';

interface ChatInterfaceProps {
  thread: {
    id: number;
    otherParticipant?: { id: number; username: string };
  };
  currentUser: { id: number; username: string };
  onBackToThreadList?: () => void; // For mobile responsive
}

interface Message {
  id: number;
  content: string;
  createdAt: string;
  sender: { id: number; username: string };
  isFromCurrentUser: boolean;
}

/**
 * Chat interface with real-time messaging
 */
export function ChatInterface({ thread, currentUser, onBackToThreadList }: ChatInterfaceProps) {
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Real-time integration
  const { isConnected, joinThread, onMessage } = useSocket({ user: currentUser });

  // Join thread room when connected
  useEffect(() => {
    if (thread?.id && isConnected) {
      console.log(`📂 Joining Socket.io room for thread ${thread.id}`);
      joinThread(thread.id);
    }
  }, [thread.id, isConnected]);

  // Listen for real-time messages
  useEffect(() => {
    const cleanup = onMessage((data) => {
      // Only add if current thread
      if (data.threadId === thread.id) {
        console.log('📨 Adding real-time message to UI:', data.message.content);
        setMessages(prev => {
          // Prevent duplicates
          const exists = prev.some(msg => msg.id === data.message.id);
          if (exists) {
            console.log('🚫 Duplicate message prevented:', data.message.id);
            return prev;
          }
          return [...prev, data.message];
        });
      }
    });

    return cleanup;
  }, [thread.id]);

  // Fetch messages
  const {
    isLoading,
    error,
    refetch: refetchMessages
  } = trpc.messages.getThreadMessages.useQuery(
    { threadId: thread.id },
    {
      onSuccess: (data) => {
        console.log(`💬 Loaded ${data.messages.length} messages for thread ${thread.id}`);
        setMessages(data.messages);
      },
      onError: (error) => {
        console.error('Failed to load messages:', error);
      }
    }
  );

  // Send message
  const sendMessageMutation = trpc.messages.sendMessage.useMutation({
    onSuccess: (sentMessage) => {
      console.log('✅ Message sent successfully:', sentMessage);
      
      // Add to local state
      setMessages(prev => [...prev, sentMessage]);
      
      // Clear input
      setNewMessage('');
      
      // Scroll to bottom
      scrollToBottom();
    },
    onError: (error) => {
      console.error('❌ Failed to send message:', error);
      // TODO: Show error to user
    }
  });

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    const content = newMessage.trim();
    if (!content) return;

    console.log(`📤 Sending message to thread ${thread.id}: "${content}"`);
    
    sendMessageMutation.mutate({
      threadId: thread.id,
      content: content
    });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group messages by date for date separators
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    let currentGroup: Message[] = [];

    messages.forEach(message => {
      const messageDate = new Date(message.createdAt).toDateString();
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center">
            {onBackToThreadList && (
              <button
                onClick={onBackToThreadList}
                className="mr-3 p-1 hover:bg-gray-100 rounded-full md:hidden"
              >
                ←
              </button>
            )}
            <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
              {thread.otherParticipant?.username.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {thread.otherParticipant?.username || 'Unknown User'}
              </h2>
              <p className="text-sm text-gray-500">Loading messages...</p>
            </div>
          </div>
        </div>

        {/* Loading Messages */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
              {thread.otherParticipant?.username.charAt(0).toUpperCase() || '?'}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {thread.otherParticipant?.username || 'Unknown User'}
            </h2>
          </div>
        </div>

        {/* Error State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 font-semibold">Failed to load messages</p>
            <p className="text-sm text-gray-500 mt-1">{error.message}</p>
            <button 
              onClick={() => refetchMessages()}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center">
          {onBackToThreadList && (
            <button
              onClick={onBackToThreadList}
              className="mr-3 p-1 hover:bg-gray-100 rounded-full md:hidden"
            >
              ←
            </button>
          )}
          <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
            {thread.otherParticipant?.username.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {thread.otherParticipant?.username || 'Unknown User'}
            </h2>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-500">
                {messages.length === 0 ? 'No messages yet' : `${messages.length} messages`}
              </p>
              {/* Connection status indicator */}
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              }`} title={isConnected ? 'Connected' : 'Disconnected'}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">💬</span>
              </div>
              <p className="text-gray-500 mb-2">No messages yet</p>
              <p className="text-sm text-gray-400">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messageGroups.map(group => (
              <div key={group.date}>
                {/* Date Separator */}
                <div className="flex justify-center mb-4">
                  <span className="bg-white px-3 py-1 rounded-full text-xs text-gray-500 border">
                    {formatMessageDate(group.messages[0]?.createdAt || '')}
                  </span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {group.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isFromCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.isFromCurrentUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <div className={`text-xs mt-1 ${
                          message.isFromCurrentUser ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="mr-2">{message.sender.username}</span>
                          <span>{formatMessageTime(message.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${thread.otherParticipant?.username || 'user'}...`}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={sendMessageMutation.isPending}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sendMessageMutation.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendMessageMutation.isPending ? '⏳' : '📤'}
          </button>
        </form>
      </div>
    </div>
  );
}
