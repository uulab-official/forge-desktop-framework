import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatBubble } from './components/ChatBubble';
import { TypingIndicator } from './components/TypingIndicator';
import { ChatInput } from './components/ChatInput';

declare global {
  interface Window {
    api: {
      execute: (req: { action: string; payload: Record<string, unknown> }) => Promise<any>;
      chat: {
        send: (message: string) => Promise<any>;
        onStream: (
          cb: (data: { partial: string; done: boolean; timestamp: number }) => void,
        ) => () => void;
      };
    };
  }
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: number;
}

let nextId = 0;
function genId() {
  return `msg-${++nextId}-${Date.now()}`;
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: 'Hello! I am the Forge Chat assistant. Send me a message and I will respond with some fun analysis of your text.',
      sender: 'assistant',
      timestamp: Date.now(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Listen for streamed responses
  useEffect(() => {
    const unsub = window.api.chat.onStream((data) => {
      if (data.done) {
        setIsTyping(false);
        setStreamingId(null);
      }

      setMessages((prev) => {
        const existing = prev.find((m) => m.id === streamingId);
        if (existing) {
          return prev.map((m) =>
            m.id === streamingId ? { ...m, text: data.partial } : m,
          );
        }
        return prev;
      });
    });
    return unsub;
  }, [streamingId]);

  const handleSend = useCallback(
    async (text: string) => {
      // Add user message
      const userMsg: Message = {
        id: genId(),
        text,
        sender: 'user',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Show typing indicator and prepare assistant placeholder
      setIsTyping(true);
      const assistantId = genId();
      setStreamingId(assistantId);

      // Add placeholder for streaming response
      const assistantMsg: Message = {
        id: assistantId,
        text: '',
        sender: 'assistant',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        await window.api.chat.send(text);
      } catch (err) {
        setIsTyping(false);
        setStreamingId(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: `Error: ${err}` }
              : m,
          ),
        );
      }
    },
    [],
  );

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Forge Chat
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Real-time IPC messaging with Python worker
        </p>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages
          .filter((m) => m.text !== '' || m.id === streamingId)
          .map((msg) =>
            msg.text === '' && msg.id === streamingId ? null : (
              <ChatBubble
                key={msg.id}
                message={msg.text}
                sender={msg.sender}
                timestamp={msg.timestamp}
              />
            ),
          )}
        {isTyping && streamingId && messages.find(m => m.id === streamingId)?.text === '' && (
          <TypingIndicator />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
}
