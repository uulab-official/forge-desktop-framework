interface ChatBubbleProps {
  message: string;
  sender: 'user' | 'assistant';
  timestamp: number;
  avatar?: string;
}

export function ChatBubble({ message, sender, timestamp, avatar }: ChatBubbleProps) {
  const isUser = sender === 'user';
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
          isUser ? 'bg-blue-500' : 'bg-gray-400'
        }`}
      >
        {avatar ?? (isUser ? 'U' : 'A')}
      </div>

      {/* Bubble */}
      <div className={`max-w-[70%] group`}>
        <div
          className={`px-4 py-2.5 rounded-2xl whitespace-pre-wrap break-words leading-relaxed ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-md'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
          }`}
        >
          {message}
        </div>
        <div
          className={`mt-1 text-[10px] text-gray-400 dark:text-gray-500 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {time}
        </div>
      </div>
    </div>
  );
}
