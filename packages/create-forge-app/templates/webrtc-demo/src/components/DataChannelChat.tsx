import { useState, useRef, useEffect } from 'react';

interface DataMessage {
  id: string;
  text: string;
  sender: 'local' | 'remote';
  timestamp: number;
}

interface DataChannelChatProps {
  dataChannel?: RTCDataChannel | null;
  connected?: boolean;
  messages: DataMessage[];
  onSend: (text: string) => void;
}

export function DataChannelChat({ dataChannel, connected, messages, onSend }: DataChannelChatProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const isOpen = connected ?? dataChannel?.readyState === 'open';

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !isOpen) return;
    onSend(text);
    setInput('');
  }

  return (
    <div className="flex flex-col h-full border border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide">
        Data Channel Chat
      </div>

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-900/50">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            No messages yet. Connect and start chatting.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'local' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-3 py-1.5 rounded-lg text-sm ${
                msg.sender === 'local'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex border-t border-gray-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!isOpen}
          placeholder={isOpen ? 'Type a message...' : 'Connect to chat'}
          className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 outline-none placeholder-gray-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isOpen || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
