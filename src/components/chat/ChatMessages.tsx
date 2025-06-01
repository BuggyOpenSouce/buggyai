import React, { useEffect, useRef, useMemo } from 'react';
import type { Message, UserProfile } from '../../types';
import { ChatMessage } from './ChatMessage'; // Değişiklik: Adlandırılmış içe aktarım
import LoadingIndicator from '../LoadingIndicator';

interface ChatMessagesProps {
  messages: Message[];
  currentUserId: string | null;
  isLoading?: boolean;
  userProfile?: UserProfile | null;
  onResendMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onCopyMessage?: (content: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onFeedback?: (messageId: string, feedback: 'good' | 'bad') => void;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  currentUserId,
  isLoading,
  userProfile,
  onResendMessage,
  onDeleteMessage,
  onCopyMessage,
  onEditMessage,
  onFeedback,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const processedMessages = useMemo(() => {
    return messages.flatMap((message) => {
      const contentToProcess = message.content || "";
      if (message.role === 'assistant') {
        const parts = contentToProcess.split(/\n/).filter(part => part.trim() !== '' || contentToProcess.trim() === '');
        if (parts.length > 1) {
          return parts.map((part, partIndex) => ({
            ...message,
            id: `${message.id}-part-${partIndex}`,
            originalMessageId: message.id,
            content: part.trim(),
            isContinuation: partIndex > 0,
            images: partIndex === 0 ? message.images : undefined,
            videos: partIndex === 0 ? message.videos : undefined,
            isLoading: message.isLoading,
          }));
        }
      }
      return { ...message, originalMessageId: message.id, isContinuation: false };
    });
  }, [messages]);

  return (
    <div className="chat-messages-container flex-1 overflow-y-auto p-4 space-y-2 bg-transparent">
      {processedMessages.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={{
            id: msg.id,
            originalMessageId: msg.originalMessageId,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            images: msg.images,
            videos: msg.videos,
            isLoading: msg.isLoading,
            isError: msg.isError,
            feedback: msg.feedback,
          }}
          isOwnMessage={msg.role === 'user' && msg.id.startsWith(currentUserId || 'guest')}
          isContinuation={msg.isContinuation}
          onResend={() => onResendMessage && msg.originalMessageId && onResendMessage(msg.originalMessageId)}
          onDelete={() => onDeleteMessage && msg.originalMessageId && onDeleteMessage(msg.originalMessageId)}
          onCopy={() => onCopyMessage && onCopyMessage(msg.content)}
          onEdit={(newContent) => onEditMessage && msg.originalMessageId && onEditMessage(msg.originalMessageId, newContent)}
          onFeedback={(feedback) => onFeedback && msg.originalMessageId && onFeedback(msg.originalMessageId, feedback)}
          assistantAvatarUrl={msg.role === 'assistant' ? userProfile?.avatar_url : undefined}
          userAvatarUrl={msg.role === 'user' ? undefined : undefined}
        />
      ))}
      {isLoading && (
        <div className="flex justify-center py-2">
          <LoadingIndicator />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;