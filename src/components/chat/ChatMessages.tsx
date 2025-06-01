import React, { useEffect, useRef, useMemo, memo } from 'react';
import type { Message } from '../../types';
import ChatMessage from './ChatMessage';
import LoadingIndicator from '../LoadingIndicator'; // Yükleme göstergesi için import
import { useUserProfile } from '../../buggyprofile/hooks/useUserProfile'; // Profil hook'u eklendi

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean; // Ana yükleme durumu
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
  const { userProfile } = useUserProfile(); // Kullanıcı profilini al

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]); // isLoading değiştiğinde de scroll yap

  const processedMessages = useMemo(() => {
    return messages.flatMap((message, index) => {
      const contentToProcess = message.content || "";
      // Asistan mesajlarını her bir '\n' karakterine göre böl.
      // Kullanıcı mesajları için bu davranış istenmiyorsa, koşulu (message.role === 'assistant') ekleyebiliriz.
      // Şimdiki istek asistan mesajları için olduğundan ona odaklanıyoruz.
      const parts = message.role === 'assistant'
        ? contentToProcess.split(/\n/).filter(part => part.trim() !== '' || contentToProcess.trim() === '') // Boş satırları filtrele, ama mesaj tamamen boşsa tek bir boş baloncuk kalsın
        : [contentToProcess]; // Kullanıcı mesajlarını bölme

      if (message.role === 'assistant' && parts.length > 1) {
        return parts.map((part, partIndex) => ({
          ...message,
          id: `${message.id}-part-${partIndex}`, // Her parça için benzersiz ID
          originalMessageId: message.id, // Orijinal mesaj ID'sini sakla
          content: part.trim(),
          isContinuation: partIndex > 0, // İlk parçadan sonrakiler devamı niteliğinde
          // Resim ve videoları sadece ilk baloncukta göster
          images: partIndex === 0 ? message.images : undefined,
          videos: partIndex === 0 ? message.videos : undefined,
          // Yükleme ve hata durumunu ana mesajla senkronize et
          // Ancak genellikle parçalanmış mesajlar zaten tamamlanmış olur.
          // Eğer stream ediliyorsa ve parçalar halinde geliyorsa bu mantık değişebilir.
          isLoading: message.isLoading && index === messages.length -1 && partIndex === parts.length -1, // Sadece son mesajın son parçası yükleniyor olabilir
        }));
      }
      // Eğer mesaj bölünemiyorsa veya kullanıcı mesajıysa
      return { ...message, originalMessageId: message.id, isContinuation: false, isLoading: message.isLoading && index === messages.length - 1 };
    });
  }, [messages]);

  return (
    <div className="chat-messages-container flex-1 overflow-y-auto p-4 space-y-2 bg-transparent">
      {processedMessages.map((msg, idx) => (
        <ChatMessage
          key={msg.id} // Benzersiz anahtar olarak msg.id kullanılıyor
          message={{
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            images: msg.images,
            videos: msg.videos,
            isLoading: msg.isLoading, // msg objesinden gelen isLoading
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
      {isLoading && messages.length === 0 && ( // Sadece ilk yüklemede veya mesaj yokken genel yükleme göstergesi
        <div className="flex justify-center items-center p-4">
          <LoadingIndicator />
          <p className="ml-2 text-gray-500 dark:text-gray-400">Mesajlar yükleniyor...</p>
        </div>
      )}
      {isLoading && messages.length > 0 && !messages[messages.length - 1].isLoading && (
         // Stream bitmiş ama ana isLoading hala true ise (örn. yeni mesaj bekleniyor)
         // veya bir işlem sonrası genel yükleme durumu varsa diye ek bir kontrol.
         // Bu genellikle ChatWindow'daki isLoading state'i ile yönetilir.
         // Eğer son mesajın kendi isLoading'i varsa ChatMessage içinde gösterilir.
         // Bu blok, mesajların sonunda genel bir yükleme belirtisi için düşünülebilir ama genellikle ChatInput yanında olur.
         // Burada şimdilik yorum satırı olarak bırakıyorum, çünkü ChatMessage içindeki isLoading daha spesifik.
        /*
        <div className="flex justify-center items-center p-4">
          <LoadingIndicator />
        </div>
        */
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default memo(ChatMessages);