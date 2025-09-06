import React, { useState } from 'react';
import { ThreadList } from './ThreadList';
import { ChatInterface } from './ChatInterface';

interface ChatAppProps {
  user: { id: number; username: string };
  onLogout: () => void;
}

interface Thread {
  id: number;
  otherParticipant?: { id: number; username: string };
  lastMessage?: {
    content: string;
    sender: { username: string };
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function ChatApp({ user, onLogout }: ChatAppProps) {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  const handleSelectThread = (thread: Thread) => {
    console.log('📱 Selected thread:', thread.id, 'with', thread.otherParticipant?.username);
    setSelectedThread(thread);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Realtime Messenger</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user.username}</span>
              <button
                onClick={onLogout}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Chat Interface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thread List Sidebar */}
        <ThreadList 
          user={user}
          onSelectThread={handleSelectThread}
          selectedThreadId={selectedThread?.id}
        />
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-100">
          {selectedThread ? (
            // Real Chat Interface
            <ChatInterface 
              thread={selectedThread}
              currentUser={user}
              onBackToThreadList={() => setSelectedThread(null)}
            />
          ) : (
            // No thread selected
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <span className="text-3xl">💬</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Select a conversation
                </h3>
                <p className="text-gray-600">
                  Choose a thread from the sidebar to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}