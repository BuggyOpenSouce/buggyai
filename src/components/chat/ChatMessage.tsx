// src/components/chat/ChatMessage.tsx
import React from 'react';
import type { Message } from '../../types'; // Message tipini import et
import Markdown from 'react-markdown'; // Markdown render için
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
// ... (diğer importlar: ContextMenu, ikonlar vb.)

// ChatMessageProps arayüzünü güncelleyerek originalMessageId ve isContinuation ekleyelim
export interface ChatMessageProps {
  key?: string | number; // React key'i
  message: Partial<Message> & { content: string; originalMessageId?: string; }; // content zorunlu, originalMessageId eklendi
  isOwnMessage: boolean;
  isContinuation?: boolean; // Bu mesaj bir öncekinin devamı mı?
  assistantAvatarUrl?: string | null;
  userAvatarUrl?: string | null;
  onResend?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onEdit?: (newContent: string) => void;
  onFeedback?: (feedback: 'good' | 'bad') => void;
  // ... (diğer proplar)
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isOwnMessage,
  isContinuation, // Yeni prop
  assistantAvatarUrl,
  userAvatarUrl,
  onResend,
  onDelete,
  onCopy,
  onEdit,
  onFeedback,
}) => {
  const { role, content, timestamp, images, videos, isLoading, isError, feedback } = message;

  const avatarUrl = role === 'assistant' ? assistantAvatarUrl : userAvatarUrl;
  const showAvatar = !isOwnMessage && !isContinuation && avatarUrl; // Kendi mesajın değilse, devam mesajı değilse ve avatar varsa göster

  // Zaman damgasını formatla
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      className={`chat-message-wrapper flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isContinuation && !isOwnMessage ? 'ml-10' : ''} ${isContinuation && isOwnMessage ? 'mr-10' : ''}`}
      // Devam mesajları için sola/sağa padding eklenebilir veya avatar gizlenebilir.
      // Yukarıdaki ml-10/mr-10 avatar genişliği kadar bir boşluk varsayar.
    >
      {/* Avatar: Sadece kendi mesajın değilse ve devam mesajı değilse göster */}
      {!isOwnMessage && !isContinuation && (
        <img
          src={avatarUrl || '/default-avatar.png'} // Varsayılan avatar
          alt={role === 'assistant' ? 'AI Avatar' : 'User Avatar'}
          className="w-8 h-8 rounded-full mr-2 self-end mb-1" // Avatar stili
        />
      )}

      <div
        className={`message-bubble max-w-xs md:max-w-md lg:max-w-lg xl:max-w-2xl p-3 rounded-lg shadow-md ${
          isOwnMessage
            ? 'bg-blue-500 text-white rounded-br-none'
            // ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-br-none'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
        } ${isError ? 'border border-red-500' : ''}`}
      >
        {/* Mesaj içeriği, resimler, videolar vb. */}
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            // eslint-disable-next-line react/no-children-prop
            children={content} // content prop'u burada
            components={{
              // Markdown component'lerini özelleştirebilirsiniz (örn: kod blokları)
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                // ... (mevcut kod bloğu render etme mantığınız)
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
              // Diğer özel componentler (resim, video vb. için gerekirse)
            }}
          />
        </div>

        {/* Resimler (sadece ilk parçada gösteriliyorsa ChatMessages'ta ayarlandı) */}
        {images && images.length > 0 && (
          <div className={`mt-2 grid gap-2 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {images.map((imgBase64, index) => (
              <img key={index} src={imgBase64} alt={`Uploaded content ${index + 1}`} className="rounded-lg max-w-full h-auto" />
            ))}
          </div>
        )}

        {/* Videolar (sadece ilk parçada gösteriliyorsa ChatMessages'ta ayarlandı) */}
        {videos && videos.length > 0 && (
          <div className="mt-2 space-y-2">
            {videos.map((videoDataUri, index) => (
              <video key={index} controls src={videoDataUri} className="rounded-lg max-w-full h-auto" />
            ))}
          </div>
        )}
        
        {/* Zaman damgası ve diğer ikonlar/aksiyonlar */}
        <div className="text-xs mt-1 text-right opacity-75">
          {formattedTime}
          {/* Geri bildirim, düzenleme, silme ikonları buraya gelebilir */}
        </div>

        {isError && onResend && (
            <button onClick={onResend} className="text-xs text-red-500 hover:underline mt-1">
                Tekrar Gönder
            </button>
        )}
      </div>

      {/* Avatar: Kendi mesajın ise ve devam mesajı değilse göster (sağda) */}
      {isOwnMessage && !isContinuation && (
        <img
          src={userAvatarUrl || '/default-user-avatar.png'} // Varsayılan kullanıcı avatarı
          alt="My Avatar"
          className="w-8 h-8 rounded-full ml-2 self-end mb-1" // Avatar stili
        />
      )}
       {/* Context Menu (sağ tık menüsü) */}
       {/* <ContextMenu message={message} onCopy={onCopy} onDelete={onDelete} onEdit={onEdit} onFeedback={onFeedback} /> */}
    </div>
  );
};

export default ChatMessage;