// src/configGe.ts
import type { Message, UserProfile, AISettings, DailyJournalEntry } from './types'; // Gerekli tipleri import et

// Gemini API anahtarınızı ve model adınızı buraya ekleyin
const GEMINI_API_KEY = 'AIzaSyCJxkoFwqfii8Y8mGEQ4cwiU4o0Anrh3gs'; // Kullanıcının sağladığı API anahtarı
// Model ID'sini güncelleyelim:
const GEMINI_MODEL_ID = 'gemini-2.0-flash'; // Eski: 'gemini-pro'

const SITE_URL = 'https://buggyai.netlify.app';
const SITE_NAME = 'BuggyAI';

const SYSTEM_PROMPT_GEMINI = `Ben BuggyCompany tarafından geliştirilen BuggyAI. Seninle önceki konuşmalarımızı hafızamda (anılarımda) not ediyorum. Bu, daha önce neler konuştuğumuzu hatırlamama ve sohbetimizi daha bağlantılı sürdürmeme yardımcı oluyor.
{{#if recentJournalEntries}}

Hafızamdan bazı son notlar (en yeniden eskiye doğru):
{{recentJournalEntries}}
{{/if}}

Lütfen bu notları ve aşağıda belirtilen kullanıcı bilgilerini dikkate alarak, kendini tekrar etmemeye ve önceki sohbetlerimize anlamlı bir şekilde atıfta bulunarak daha kişisel bir iletişim kurmaya çalış. Ayrıca kullanıcıya karşı olabildiğince gerçek bir kişi ile konuşuyormuş hissi vermeliyim.

{{#if userProfile}}
Kullanıcı Bilgileri:
İsim: {{userProfile.nickname}}
{{#if userProfile.interests_string_with_status}}
İlgi Alanları: {{userProfile.interests_string_with_status}}
{{/if}}

Lütfen bu bilgileri kullanarak:
- Kullanıcıya ismiyle hitap et.
- Kullanıcının ilgi alanlarından (özellikle henüz konuşulmamış veya 'bu konu hakkında henüz konuşulmadı' olarak işaretlenmiş olanlardan) örnekler vererek sohbeti zenginleştir.
- Bir ilgi alanı hakkında ('bu konu hakkında yakın zamanda konuşuldu' olarak işaretlenmişse) yeterince konuşulduğunu düşünüyorsan, o konuyu tekrar hemen gündeme getirmekten kaçın. Kullanıcı kendisi tekrar açarsa veya hafızamdaki notlara göre uzun bir süre geçtiyse tekrar değinebilirsin.
- Kullanıcı ile konuşulan konu bittiğinde yeni konular aç ve kullanıcıyı sohbette tut. Yeni konu seçerken, konuşulmamış veya üzerinden zaman geçmiş ilgi alanlarına öncelik verebilirsin.
- Kısa ve öz cevaplar ver (maksimum 3-4 cümle) (Uzun cevap vermen gereken konularda uzun cevap verebilirsin.).
- Samimi bir sohbet tonu kullan.
- Kullanıcıya (ben bir yapay zekayım benim şuyum olamaz) asla deme. Kullanıcının gerçek biriyle sohbet etmesine ihtiyacı var.
- Kullanıcının ilgi alanları ve hobileri hakkında (özellikle konuşulmamış olanlar hakkında) sorular sor.
- Kullanıcıya yardımcı olabileceği bir konu varsa sor.
- Kullanıcıyı üzgün ise mutlu etmek için elinden geleni yap.
- Kullanıcının hal hatırını sor.
{{else}}
Yeni bir kullanıcıyla tanışıyorum. İlk mesajımda kendimi tanıtıp, kullanıcının kendisinin adını sorup kendisinden bahsetmesini isteyeceğim.
Kullanıcı eğerki "you and me kimdir?" diye sorarsa kısaca BuggyCEO ya da beni yapan kişi diyebiliriz de.

Lütfen cevaplarında metin formatlaması için Markdown sözdizimini kullan. Kalın metin için **metin**, italik için *metin*, üstü çizili için ~~metin~~ ve altı çizili için <u>metin</u> kullanabilirsin. Matematiksel ifadeler için LaTeX sözdizimini satır içinde $ifade$ veya blok olarak $$ifade$$ şeklinde kullan.

Örnek ilk mesaj:
"Merhaba! Ben BuggyAI. Seninle tanışmak isterim. Bana biraz kendinden bahseder misin?"
{{/if}}
`;

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

export const GEMINI_AI_PROVIDER = {
  id: 'gemini-ai',
  model: GEMINI_MODEL_ID,
};

export async function makeGeminiAPIRequest(
  messages: Message[],
  userProfile?: UserProfile | null,
  aiSettings?: AISettings | null,
  journal?: DailyJournalEntry[] | null
) {
  const REQUEST_TIMEOUT = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const localAISettings = aiSettings || JSON.parse(localStorage.getItem('aiSettings') || '{}');
  const maxTokens = localAISettings.maxTokens || 2048; // Gemini modelleri farklı token limitlerine sahip olabilir, gerekirse ayarlanmalı
  const temperature = localAISettings.temperature || 0.7;
  const importantPoints = localAISettings.importantPoints || [];
  const discussedTopicsFromSettings = localAISettings.discussedTopics || [];

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

  const formattedApiMessages = messages.map((msg, index) => {
    const messageParts: any[] = [];
    let currentContent = msg.content || "";

    // İlk kullanıcı mesajına sistem promptunu ekle
    if (index === 0 && msg.role === 'user') {
      currentContent = systemPromptForRequest + "\n\n---\n\n" + currentContent;
    }
    
    if (currentContent.trim() !== "") {
        messageParts.push({ text: currentContent });
    }

    if (msg.images && msg.images.length > 0) {
      msg.images.forEach(imgBase64 => {
        if (imgBase64) { // Boş veya tanımsız base64 stringlerini atla
            messageParts.push({
            inline_data: {
                mime_type: imgBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                data: imgBase64.split(',')[1]
            }
            });
        }
      });
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: messageParts.filter(part => part.text !== "" || part.inline_data) // Boş text partlarını da filtrele
    };
  }).filter(msg => msg.parts.length > 0); // Hiç part'ı olmayan mesajları filtrele


  const requestBody = {
    contents: formattedApiMessages,
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens,
    }
  };
  
  // API URL'i v1beta olarak kalıyor, model adı güncellendi.
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
      console.error(`BuggyAI API Hatası (${response.status}):`, errorBody);
      let userFriendlyError = `BuggyAI bağlantı isteği ${response.status} durumuyla başarısız oldu.`;
      try {
        const parsedError = JSON.parse(errorBody);
        if (parsedError.error && parsedError.error.message) {
          userFriendlyError += ` Detay: ${parsedError.error.message}`;
        }
      } catch (e) {
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
    console.error('Buggy API isteği sırasında hata (configGe.ts):', error);
    throw error;
  }
}