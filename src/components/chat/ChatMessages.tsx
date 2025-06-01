import React, { useEffect, useRef, useMemo, memo } from 'react';
import type { Message } from '../../types';
import ChatMessage from './ChatMessage';
import LoadingIndicator from '../LoadingIndicator';
import { useUserProfile } from '../../buggyprofile/hooks/useUserProfile';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  currentConversationId: string | null;
  onResendMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string, conversationId: string | null) => void;
  onEditMessage?: (messageId: string, newContent: string, conversationId: string | null) => void;
  onFeedback?: (messageId: string, feedback: 'good' | 'bad', conversationId: string | null) => void;
  selectedModelConfigKey?: string;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isLoading,
  currentConversationId,
  onResendMessage,
  onDeleteMessage,
  onEditMessage,
  onFeedback,
  selectedModelConfigKey,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { userProfile } = useUserProfile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const processedMessages = useMemo(() => {
    return messages.flatMap((message, index) => {
      const contentToProcess = message.content || "";
      const parts = message.role === 'assistant'
        ? contentToProcess.split(/\n/).filter(part => part.trim() !== '' || contentToProcess.trim() === '')
        : [contentToProcess];

      if (message.role === 'assistant' && parts.length > 1) {
        return parts.map((part, partIndex) => ({
          ...message,
          id: `${message.id}-part-${partIndex}`,
          originalMessageId: message.id,
          content: part.trim(),
          isContinuation: partIndex > 0,
          images: partIndex === 0 ? message.images : undefined,
          videos: partIndex === 0 ? message.videos : undefined,
          isLoading: message.isLoading && index === messages.length -1 && partIndex === parts.length -1,
        }));
      }
      return { ...message, originalMessageId: message.id, isContinuation: false, isLoading: message.isLoading && index === messages.length - 1 };
    });
  }, [messages]);

  return (
    <div className="chat-messages-container flex-1 overflow-y-auto p-4 space-y-2 bg-transparent">
      {processedMessages.map((msg, idx) => (
        <ChatMessage
          key={msg.id}
          message={{
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            images: msg.images,
            videos: msg.videos,
            isLoading: msg.isLoading,
            isError: msg.isError,
            feedback: msg.feedback,
            originalMessageId: msg.originalMessageId,
          }}
          isOwnMessage={msg.role === 'user'}
          isContinuation={msg.isContinuation}
          assistantAvatarUrl={selectedModelConfigKey === 'QuestionGeneration' ? '/assets/icons/sparkle-dynamic-color.png' : userProfile?.assistantAvatarUrl || '/default-ai-avatar.png'}
          userAvatarUrl={userProfile?.avatarUrl || '/default-user-avatar.png'}
          onResend={onResendMessage && msg.isError ? () => onResendMessage(msg as Message) : undefined}
          onDelete={onDeleteMessage && currentConversationId ? () => onDeleteMessage(msg.originalMessageId || msg.id, currentConversationId) : undefined}
          onEdit={onEditMessage && currentConversationId && msg.role === 'user' ? (newContent: string) => onEditMessage(msg.originalMessageId || msg.id, newContent, currentConversationId) : undefined}
          onFeedback={onFeedback && currentConversationId && msg.role === 'assistant' ? (feedback: 'good' | 'bad') => onFeedback(msg.originalMessageId || msg.id, feedback, currentConversationId) : undefined}
        />
      ))}
      {isLoading && messages.length === 0 && (
        <div className="flex justify-center items-center p-4">
          <LoadingIndicator />
          <p className="ml-2 text-gray-500 dark:text-gray-400">Mesajlar yükleniyor...</p>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default memo(ChatMessages);