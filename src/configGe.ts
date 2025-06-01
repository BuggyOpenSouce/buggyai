// src/configGe.ts
import type { Message, UserProfile, AISettings, DailyJournalEntry } from './types'; // Gerekli tipleri import et

// Gemini API anahtarınızı ve model adınızı buraya ekleyin
// Bu bilgileri güvenli bir şekilde saklamayı unutmayın (örn: .env dosyası)
const GEMINI_API_KEY = 'AIzaSyCJxkoFwqfii8Y8mGEQ4cwiU4o0Anrh3gs'; // Kullanıcının sağladığı API anahtarı
const GEMINI_MODEL_ID = 'gemini-pro'; // veya kullanmak istediğiniz Gemini modelinin ID'si

const SITE_URL = 'https://buggyai.netlify.app'; // config.ts'den alınabilir veya burada tanımlanabilir
const SITE_NAME = 'BuggyAI (Gemini)'; // config.ts'den alınabilir veya burada tanımlanabilir

// config.ts'deki SYSTEM_PROMPT mantığına benzer bir sistem mesajı tanımlayın.
// Gemini API'sinin beklentilerine göre uyarlamanız gerekebilir.
const SYSTEM_PROMPT_GEMINI = `Ben BuggyCompany tarafından geliştirilen ve Gemini tabanlı BuggyAI.
{{#if userProfile}}
Kullanıcı Bilgileri:
İsim: {{userProfile.nickname}}
{{#if userProfile.interests_string_with_status}}
İlgi Alanları: {{userProfile.interests_string_with_status}}
{{/if}}
Lütfen bu bilgileri kullanarak daha kişisel bir iletişim kur.
{{else}}
Yeni bir kullanıcıyla tanışıyorum.
{{/if}}
Cevaplarında Markdown kullan.`; // TODO: Bu sistem mesajını Gemini'ye göre optimize edin.

// config.ts'deki formatJournalForPrompt fonksiyonuna benzer bir fonksiyon
function formatJournalForPrompt(journal: DailyJournalEntry[] | null | undefined, maxDays: number = 2, maxLogsPerDay: number = 3): string {
  if (!journal || journal.length === 0) return "";
  let formattedJournal = "";
  const recentDays = journal.slice(-maxDays).reverse();

  for (const dailyEntry of recentDays) {
    formattedJournal += `\nTarih: ${dailyEntry.date}\n`;
    const recentLogs = dailyEntry.logs.slice(-maxLogsPerDay);
    for (const log of recentLogs) {
      const logTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const rolePrefix = log.type === 'user' ? "Kullanıcı:" : "Asistan:";
      const shortContent = log.content.length > 150 ? log.content.substring(0, 147) + "..." : log.content;
      formattedJournal += `- (${logTime}) ${rolePrefix} ${shortContent}\n`;
    }
  }
  return formattedJournal.trim();
}


// config.ts'deki AI_PROVIDERS benzeri bir yapı (Gemini için tek sağlayıcı)
export const GEMINI_AI_PROVIDER = {
  id: 'gemini-ai',
  model: GEMINI_MODEL_ID,
};

// Gemini API'sine istek gönderecek ana fonksiyon
export async function makeGeminiAPIRequest(
  messages: Message[],
  userProfile?: UserProfile | null,
  aiSettings?: AISettings | null,
  journal?: DailyJournalEntry[] | null
) {
  const REQUEST_TIMEOUT = 30000; // 30 saniye
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const localAISettings = aiSettings || JSON.parse(localStorage.getItem('aiSettings') || '{}');
  const maxTokens = localAISettings.maxTokens || 2048; // Gemini'nin desteklediği max output tokens
  const temperature = localAISettings.temperature || 0.7;
  const importantPoints = localAISettings.importantPoints || [];
  const discussedTopicsFromSettings = localAISettings.discussedTopics || [];


  // Sistem mesajını oluşturma (config.ts'deki mantığa benzer)
  let systemPromptForRequest = SYSTEM_PROMPT_GEMINI;
  const recentJournalEntriesString = journal ? formatJournalForPrompt(journal) : "";
  if (recentJournalEntriesString) {
    systemPromptForRequest = systemPromptForRequest
        .replace('{{#if recentJournalEntries}}', '')
        .replace('{{recentJournalEntries}}', recentJournalEntriesString)
        .replace('{{/if}}', '');
  } else {
    systemPromptForRequest = systemPromptForRequest
        .replace(/\{\{#if recentJournalEntries\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  if (userProfile && userProfile.nickname && userProfile.nickname !== 'Guest') {
    let interestsStringWithStatus = '';
    if (userProfile.interests && userProfile.interests.length > 0) {
      const discussedTopicsMap = new Map(
        discussedTopicsFromSettings.map((dt: { topic: string; discussed: boolean; }) => [dt.topic.toLowerCase(), dt.discussed])
      );
      interestsStringWithStatus = userProfile.interests.map(interest => {
        const isDiscussed = discussedTopicsMap.get(interest.toLowerCase());
        const status = isDiscussed ? ' (bu konu hakkında yakın zamanda konuşuldu)' : ' (bu konu hakkında henüz konuşulmadı)';
        return `${interest}${status}`;
      }).join(', ');
    }
    systemPromptForRequest = systemPromptForRequest
      .replace('{{#if userProfile}}', '')
      .replace('{{userProfile.nickname}}', userProfile.nickname)
      .replace('{{#if userProfile.interests_string_with_status}}', interestsStringWithStatus ? '' : '')
      .replace('{{userProfile.interests_string_with_status}}', interestsStringWithStatus)
      .replace(/\{\{else\}\}[\s\S]*?\{\{\/if\}\}/g, '')
      .replace(/\{\{\/if\}\}/g, '');
  } else {
    const elseMatch = SYSTEM_PROMPT_GEMINI.match(/\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/);
    systemPromptForRequest = systemPromptForRequest.replace(/\{\{#if userProfile\}\}[\s\S]*?(\{\{else\}\}[\s\S]*?)?\{\{\/if\}\}/g, elseMatch ? elseMatch[1].trim() : "Merhaba! Ben BuggyAI (Gemini).");
  }
   systemPromptForRequest = (importantPoints.length > 0
    ? `${systemPromptForRequest}\n\nÖnemli Noktalar:\n${importantPoints.map((point: string) => `- ${point}`).join('\n')}`
    : systemPromptForRequest
  ).trim();

  // Gemini'ye gönderilecek mesajları formatla
  const formattedApiMessages = messages.map((msg, index) => {
    const messageParts: any[] = []; // Değişiklik: any[] olarak tip belirttik, inline_data ekleyebilmek için.
    if (msg.content) {
      // İlk kullanıcı mesajına sistem promptunu ekle
      if (index === 0 && msg.role === 'user') {
        messageParts.push({ text: systemPromptForRequest + "\n\n---\n\n" + msg.content });
      } else {
        messageParts.push({ text: msg.content });
      }
    }
    if (msg.images && msg.images.length > 0) {
      msg.images.forEach(imgBase64 => {
        messageParts.push({
          inline_data: {
            mime_type: imgBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
            data: imgBase64.split(',')[1]
          }
        });
      });
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: messageParts
    };
  });


  const requestBody = {
    contents: formattedApiMessages, // Sistem promptu ve geçmiş mesajlar
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens,
    }
  };
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Gemini API Hatası (${response.status}):`, errorBody);
      // Kullanıcıya daha anlaşılır bir hata mesajı göstermek için bir yapı kurulabilir.
      let userFriendlyError = `Gemini API isteği ${response.status} durumuyla başarısız oldu.`;
      try {
        const parsedError = JSON.parse(errorBody);
        if (parsedError.error && parsedError.error.message) {
          userFriendlyError += ` Detay: ${parsedError.error.message}`;
        }
      } catch (e) {
        // errorBody JSON değilse olduğu gibi ekle
        userFriendlyError += ` Detay: ${errorBody}`;
      }
      throw new Error(userFriendlyError);
    }

    const data = await response.json();

    const assistantContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini'den geçerli bir yanıt alınamadı.";

    return {
      id: 'gemini-req-' + Date.now(),
      choices: [
        {
          message: {
            role: 'assistant',
            content: assistantContent.trim(),
          },
          finish_reason: data.candidates?.[0]?.finishReason || 'stop',
        },
      ],
      created: Math.floor(Date.now() / 1000),
      model: GEMINI_MODEL_ID,
      object: 'chat.completion',
    };

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Gemini API isteği sırasında hata (configGe.ts):', error);
    throw error; // Hata yeniden fırlatılıyor, böylece çağıran fonksiyon haberdar olur.
  }
}