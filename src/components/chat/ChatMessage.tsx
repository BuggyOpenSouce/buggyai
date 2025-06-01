// src/components/chat/ChatMessages.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import type { Message, UserProfile } from '../../types'; // Message tipini import et
import ChatMessage from './ChatMessage'; // ChatMessage componentını import et
import LoadingIndicator from '../LoadingIndicator'; // Yükleme göstergesi

interface ChatMessagesProps {
  messages: Message[];
  currentUserId: string | null;
  isLoading?: boolean; // Yeni mesaj yüklenirken gösterilecek yükleme durumu
  userProfile?: UserProfile | null; // Yapay zeka avatarı için
  onResendMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onCopyMessage?: (content: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void; // Düzenleme için
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

  // Mesajları işleyerek, yapay zeka mesajlarını paragraflara böl
  const processedMessages = useMemo(() => {
    return messages.flatMap((message, msgIndex) => {
      if (message.role === 'assistant' && message.content) {
        // İçeriği bir veya daha fazla boş satıra göre böl (örn: \n\n, \n \n, vb.)
        const parts = message.content.split(/\n\s*\n/).filter(part => part.trim() !== '');

        if (parts.length > 1) {
          return parts.map((part, partIndex) => ({
            ...message, // Orijinal mesajın özelliklerini kopyala
            id: `${message.id}-part-${partIndex}`, // Her parça için benzersiz bir key/id oluştur
            originalMessageId: message.id, // Orijinal mesaj ID'sini sakla (geri bildirim vb. için)
            content: part.trim(), // Parçanın içeriği
            isContinuation: partIndex > 0, // İlk parçadan sonraki parçalar devam niteliğinde
            // Eğer her mesaj balonu için resim/video göstermek istemiyorsanız, bunları sadece ilk parçada tutabilirsiniz:
            images: partIndex === 0 ? message.images : undefined,
            videos: partIndex === 0 ? message.videos : undefined,
          }));
        }
      }
      // Eğer mesaj kullanıcıya aitse, sistem mesajıysa veya bölünemiyorsa olduğu gibi döndür
      return { ...message, originalMessageId: message.id, isContinuation: false };
    });
  }, [messages]);

  return (
    <div className="chat-messages-container flex-1 overflow-y-auto p-4 space-y-2 bg-transparent">
      {processedMessages.map((msg) => (
        <ChatMessage
          key={msg.id} // Benzersiz key olarak güncellenmiş id'yi kullan
          message={{
            id: msg.id, // Parçanın ID'si
            originalMessageId: msg.originalMessageId, // Orijinal ID
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            images: msg.images,
            videos: msg.videos,
            isLoading: msg.isLoading,
            isError: msg.isError,
            feedback: msg.feedback,
            // Diğer gerekli Message alanları...
          }}
          isOwnMessage={msg.role === 'user' && msg.id.startsWith(currentUserId || 'guest')} // Kullanıcı mesajı mı? ID kontrolü gerekebilir.
          // currentUserId null ise veya guest ise ve mesaj user ise kendi mesajı olarak işaretle.
          // Parçalanmış mesajlar için user rolü olmayacak, bu yüzden bu kontrol assistant için hep false olacak.
          // isOwnMessage={msg.role === 'user'} daha basit olabilir eğer msg.id'ler farklılaşıyorsa
          // veya msg.userId gibi bir alanınız varsa.
          // Şimdilik, rol üzerinden devam edelim.
          // Yapay zeka avatarını userProfile'dan alabilirsiniz.
          // Eğer `isContinuation` prop'u ekliyorsanız:
          isContinuation={msg.isContinuation}
          // ChatMessage'a iletmek istediğiniz diğer proplar
          onResend={() => onResendMessage && msg.originalMessageId && onResendMessage(msg.originalMessageId)}
          onDelete={() => onDeleteMessage && msg.originalMessageId && onDeleteMessage(msg.originalMessageId)}
          onCopy={() => onCopyMessage && onCopyMessage(msg.content)}
          onEdit={(newContent) => onEditMessage && msg.originalMessageId && onEditMessage(msg.originalMessageId, newContent)} // Düzenleme tüm mesajı etkilemeli
          onFeedback={(feedback) => onFeedback && msg.originalMessageId && onFeedback(msg.originalMessageId, feedback)}
          // Avatar için:
          // assistantAvatarUrl={msg.role === 'assistant' ? userProfile?.avatar_url : undefined}
          // userAvatarUrl={msg.role === 'user' ? (mevcut kullanıcının avatarı) : undefined}
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