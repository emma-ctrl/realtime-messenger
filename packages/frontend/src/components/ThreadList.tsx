import React, { useState, useEffect } from 'react';
import { trpc } from '../lib/trpc';
import { useSocket } from '../hooks/useSocket';

interface ThreadListProps {
  user: { id: number; username: string };
  onSelectThread: (thread: any) => void;
  selectedThreadId?: number;
}

/**
 * WhatsApp-style conversation list with real-time updates
 */
export function ThreadList({ user, onSelectThread, selectedThreadId }: ThreadListProps) {
  const [showNewChatForm, setShowNewChatForm] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatError, setNewChatError] = useState('');

  // Real-time updates
  const { isConnected, onMessage } = useSocket({ user });

  // Fetch threads
  const { 
    data: threads = [], 
    isLoading, 
    error,
    refetch: refetchThreads 
  } = trpc.threads.getUserThreads.useQuery(undefined, {
    // Backup refetch every 30s
    refetchInterval: 30000,
    onError: (error) => {
      console.error('Failed to load threads:', error);
    }
  });

  // Create thread
  const createThreadMutation = trpc.threads.createThread.useMutation({
    onSuccess: (newThread) => {
      console.log('✅ New thread created:', newThread);
      setShowNewChatForm(false);
      setNewChatUsername('');
      setNewChatError('');
      refetchThreads();
      onSelectThread(newThread);
    },
    onError: (error) => {
      setNewChatError(error.message);
      console.error('❌ Failed to create thread:', error);
    }
  });

  // Real-time thread updates
  useEffect(() => {
    const cleanup = onMessage((data) => {
      console.log('🔄 New message received, refreshing thread list');
      refetchThreads(); // Refresh to show updated last message
    });

    return cleanup;
  }, [onMessage]); // Remove refetchThreads from dependencies

  const handleCreateChat = (e: React.FormEvent) => {
    e.preventDefault();
    setNewChatError('');
    
    if (!newChatUsername.trim()) {
      setNewChatError('Please enter a username');
      return;
    }

    createThreadMutation.mutate({ 
      targetUsername: newChatUsername.trim() 
    });
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const messageTime = new Date(date);
    const diffMinutes = Math.floor((now.getTime() - messageTime.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
    return `${Math.floor(diffMinutes / 1440)}d`;
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-white border-r border-gray-300 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-12 bg-gray-300 rounded"></div>
            <div className="h-12 bg-gray-300 rounded"></div>
            <div className="h-12 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 bg-white border-r border-gray-300 p-4">
        <div className="text-red-600 text-center">
          <p className="font-semibold">Failed to load conversations</p>
          <p className="text-sm">{error.message}</p>
          <button 
            onClick={() => refetchThreads()}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-300 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
        <p className="text-sm text-gray-600">{threads.length} conversations</p>
      </div>

      {/* New Chat Button */}
      <div className="p-4 border-b border-gray-100">
        {!showNewChatForm ? (
          <button
            onClick={() => setShowNewChatForm(true)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <span className="mr-2">➕</span>
            Start New Chat
          </button>
        ) : (
          <form onSubmit={handleCreateChat} className="space-y-3">
            <input
              type="text"
              placeholder="Enter username (bob, charlie, etc.)"
              value={newChatUsername}
              onChange={(e) => setNewChatUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={createThreadMutation.isLoading}
              autoFocus
            />
            {newChatError && (
              <p className="text-red-600 text-xs">{newChatError}</p>
            )}
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={createThreadMutation.isLoading}
                className="flex-1 bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {createThreadMutation.isLoading ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewChatForm(false);
                  setNewChatUsername('');
                  setNewChatError('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-1 px-3 rounded text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="font-semibold">No conversations yet</p>
            <p className="text-sm mt-2">Start a new chat to begin messaging!</p>
          </div>
        ) : (
          <div className="space-y-0">
            {threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedThreadId === thread.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                {/* Thread Item */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Other participant name */}
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
                        {thread.otherParticipant?.username.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {thread.otherParticipant?.username || 'Unknown User'}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          {thread.lastMessage ? (
                            <span>
                              <span className="font-medium">
                                {thread.lastMessage.sender.username === user.username ? 'You' : thread.lastMessage.sender.username}:
                              </span>
                              {' ' + thread.lastMessage.content}
                            </span>
                          ) : (
                            'No messages yet'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Timestamp */}
                  <div className="ml-2 text-xs text-gray-400 flex-shrink-0">
                    {thread.lastMessage 
                      ? formatTimeAgo(thread.lastMessage.createdAt)
                      : formatTimeAgo(thread.createdAt)
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

