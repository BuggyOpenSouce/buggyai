import React from 'react';
import type { Message } from '../../types';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

export interface ChatMessageProps {
  key?: string | number;
  message: Partial<Message> & { content: string; originalMessageId?: string; };
  isOwnMessage: boolean;
  isContinuation?: boolean;
  assistantAvatarUrl?: string | null;
  userAvatarUrl?: string | null;
  onResend?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onEdit?: (newContent: string) => void;
  onFeedback?: (feedback: 'good' | 'bad') => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isOwnMessage,
  isContinuation,
  assistantAvatarUrl,
  userAvatarUrl,
  onResend,
  onDelete,
  onCopy,
  onEdit,
  onFeedback,
}) => {
  const { role, content, timestamp, images, videos, isLoading, isError } = message;

  const avatarUrl = role === 'assistant' ? assistantAvatarUrl : userAvatarUrl;
  const showAvatar = !isOwnMessage && !isContinuation && avatarUrl;

  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      className={`chat-message-wrapper flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isContinuation && !isOwnMessage ? 'ml-10' : ''} ${isContinuation && isOwnMessage ? 'mr-10' : ''}`}
    >
      {!isOwnMessage && !isContinuation && (
        <img
          src={avatarUrl || '/default-avatar.png'}
          alt={role === 'assistant' ? 'AI Avatar' : 'User Avatar'}
          className="w-8 h-8 rounded-full mr-2 self-end mb-1"
        />
      )}

      <div
        className={`message-bubble max-w-xs md:max-w-md lg:max-w-lg xl:max-w-2xl p-3 rounded-lg shadow-md ${
          isOwnMessage
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
        } ${isError ? 'border border-red-500' : ''}`}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            children={content}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <pre className="bg-gray-800 text-white p-2 rounded my-2 overflow-x-auto">
                    <code {...props} className={className}>
                      {String(children).replace(/\n$/, '')}
                    </code>
                  </pre>
                ) : (
                  <code {...props} className={className}>
                    {children}
                  </code>
                );
              },
            }}
          />
        </div>

        {images && images.length > 0 && (
          <div className={`mt-2 grid gap-2 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {images.map((imgBase64, index) => (
              <img key={index} src={imgBase64} alt={`Uploaded content ${index + 1}`} className="rounded-lg max-w-full h-auto" />
            ))}
          </div>
        )}

        {videos && videos.length > 0 && (
          <div className="mt-2 space-y-2">
            {videos.map((videoDataUri, index) => (
              <video key={index} controls src={videoDataUri} className="rounded-lg max-w-full h-auto" />
            ))}
          </div>
        )}
        
        <div className="text-xs mt-1 text-right opacity-75">
          {formattedTime}
        </div>

        {isError && onResend && (
            <button onClick={onResend} className="text-xs text-red-500 hover:underline mt-1">
                Tekrar Gönder
            </button>
        )}
      </div>

      {isOwnMessage && !isContinuation && (
        <img
          src={userAvatarUrl || '/default-user-avatar.png'}
          alt="My Avatar"
          className="w-8 h-8 rounded-full ml-2 self-end mb-1"
        />
      )}
    </div>
  );
};