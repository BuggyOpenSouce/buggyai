// project/src/utils/api.ts
import { AI_PROVIDERS, SITE_URL, SITE_NAME, SYSTEM_PROMPT } from '../config';
// Eski HuggingFace importunu kaldır:
// import { makeHFAPIRequest } from '../confighuggingtext';
// Yeni Gemini importunu ekle:
import { makeGeminiAPIRequest } from '../configGe';
import type { Message, UserProfile, AISettings, DailyJournalEntry, JournalLogItem } from '../types';

let currentProviderIndex = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 30000; // 30 saniye

export function getCurrentProvider() {
  return {
    index: currentProviderIndex,
    name: `Yapay Zeka ${currentProviderIndex + 1}` // Bu isimlendirme genel kalabilir
  };
}

export async function setCurrentProvider(index: number) {
  if (index >= 0 && index < AI_PROVIDERS.length) {
    currentProviderIndex = index;
  } else {
    console.warn(`Geçersiz sağlayıcı dizini ayarlanmaya çalışıldı: ${index}. 0'a sıfırlanıyor.`);
    currentProviderIndex = 0;
  }
}

function formatJournalForPrompt(journal: DailyJournalEntry[], maxDays: number = 2, maxLogsPerDay: number = 3): string {
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

export async function makeAPIRequest(
  messages: Message[],
  userProfile?: UserProfile | null,
  aiSettings?: AISettings | null,
  journal?: DailyJournalEntry[] | null
) {
  const provider = AI_PROVIDERS[currentProviderIndex];
  
  // Sağlayıcı tipini kontrol et. Eğer 'gemini' ise makeGeminiAPIRequest kullan.
  // config.ts dosyasındaki ilgili provider'ın type değerinin 'gemini' olarak ayarlandığını varsayıyoruz.
  if (provider && provider.type === 'gemini') { // HuggingFace yerine Gemini kontrolü
    try {
      // makeGeminiAPIRequest kendi içinde mesaj formatlamasını ve resim işlemeyi yapar.
      // Bu yüzden burada ek bir formatlama yapmaya gerek yok.
      return await makeGeminiAPIRequest(messages, userProfile, aiSettings, journal);
    } catch (error) {
      console.error(`Gemini API Hatası (sağlayıcı: ${provider.id}):`, error);
      // Hata durumunda diğer sağlayıcılara geçiş mantığı aşağıdaki döngüde ele alınacak,
      // bu yüzden burada hatayı yeniden fırlatıp döngüye girmesini sağlayabiliriz
      // veya doğrudan bir sonraki sağlayıcıya geçişi tetikleyebiliriz.
      // Şimdilik, mevcut yeniden deneme mantığının devreye girmesi için hatayı fırlatalım.
      // Ancak bu, Gemini'ye özel bir yeniden deneme/fallback stratejisi gerektirebilir.
      // Basitlik adına, Gemini başarısız olursa OpenRouter denemelerine geçilsin.
      console.warn(`Gemini sağlayıcısı (${provider.id}) başarısız oldu, OpenRouter sağlayıcıları denenecek.`);
      // Burada hatayı yutup, normal OpenRouter döngüsüne girmesini sağlayabiliriz
      // ya da belirli bir hata yönetimi yapabiliriz. Şimdilik, OpenRouter denemelerine izin verelim.
      // currentProviderIndex'i artırıp bir sonraki sağlayıcıya geçmeyi deneyebiliriz
      // Ancak bu, aşağıdaki while döngüsünün mantığını etkileyebilir.
      // En temizi, eğer Gemini ana ise ve başarısız olursa, bir hata fırlatmak.
      // Eğer Gemini bir alternatif ise, o zaman aşağıdaki OpenRouter döngüsüne devam edebilir.
      // Mevcut yapı, provider'ın türüne göre özel bir işlem yaptıktan sonra
      // OpenRouter döngüsüne girmiyor. Bu davranışı koruyalım.
      // Yani Gemini hatası olursa, bu hata makeAPIRequest'ten yukarıya fırlatılacak.
      // Eğer Gemini'den sonra OpenRouter'a fallback isteniyorsa, buradaki hata yönetimi değişmeli.
      throw error; // Hata yukarı fırlatılır.
    }
  }

  // Regular OpenRouter API request
  let attempts = 0;
  const maxAttempts = AI_PROVIDERS.length * MAX_RETRIES; // Bu, tüm AI_PROVIDERS için geçerli

  const localAISettings = aiSettings || JSON.parse(localStorage.getItem('aiSettings') || '{}');
  const maxTokens = localAISettings.maxTokens || 2048;
  const temperature = localAISettings.temperature || 0.7;
  const importantPoints = localAISettings.importantPoints || [];
  const discussedTopicsFromSettings = localAISettings.discussedTopics || [];

  let systemPromptContent = SYSTEM_PROMPT;

  const recentJournalEntriesString = journal ? formatJournalForPrompt(journal) : "";
  if (recentJournalEntriesString) {
    systemPromptContent = systemPromptContent
        .replace('{{#if recentJournalEntries}}', '')
        .replace('{{recentJournalEntries}}', recentJournalEntriesString)
        .replace('{{/if}}', '');
  } else {
     systemPromptContent = systemPromptContent
        .replace(/\{\{#if recentJournalEntries\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  if (userProfile && userProfile.nickname && userProfile.nickname !== 'Guest') {
    let interestsStringWithStatus = '';
    if (userProfile.interests && userProfile.interests.length > 0) {
      const discussedTopicsMap = new Map(
        discussedTopicsFromSettings.map((dt: any) => [dt.topic.toLowerCase(), dt.discussed]) // dt tipini any olarak bıraktık, AISettings'e göre düzenlenebilir
      );
      interestsStringWithStatus = userProfile.interests.map(interest => {
        const isDiscussed = discussedTopicsMap.get(interest.toLowerCase());
        const status = isDiscussed ? ' (bu konu hakkında yakın zamanda konuşuldu)' : ' (bu konu hakkında henüz konuşulmadı)';
        return `${interest}${status}`;
      }).join(', ');
    }

    systemPromptContent = systemPromptContent
      .replace('{{#if userProfile}}', '')
      .replace('{{userProfile.nickname}}', userProfile.nickname)
      .replace('{{#if userProfile.interests_string_with_status}}', interestsStringWithStatus ? '' : '')
      .replace('{{userProfile.interests_string_with_status}}', interestsStringWithStatus)
      .replace(/\{\{else\}\}[\s\S]*?\{\{\/if\}\}/g, '') 
      .replace(/\{\{\/if\}\}/g, '');
  } else {
    const elseMatch = SYSTEM_PROMPT.match(/\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/);
    let baseElseContent = elseMatch ? elseMatch[1].trim() : "Merhaba! Ben BuggyAI. Seninle tanışmak isterim. Bana biraz kendinden bahseder misin?";
    
    const markdownInstruction = "Lütfen cevaplarında metin formatlaması için Markdown sözdizimini kullan. Kalın metin için **metin**, italik için *metin*, üstü çizili için ~~metin~~ ve altı çizili için <u>metin</u> kullanabilirsin. Matematiksel ifadeler için LaTeX sözdizimini satır içinde $ifade$ veya blok olarak $$ifade$$ şeklinde kullan.";
    if (!baseElseContent.includes(markdownInstruction.substring(0,30))) {
        baseElseContent += `\n\n${markdownInstruction}`;
    }

    systemPromptContent = systemPromptContent.replace(/\{\{#if userProfile\}\}[\s\S]*?(\{\{else\}\}[\s\S]*?)?\{\{\/if\}\}/g, baseElseContent);
    systemPromptContent = systemPromptContent.replace(/\{\{userProfile\.nickname\}\}/g, 'Kullanıcı');
    systemPromptContent = systemPromptContent.replace(/\{\{#if userProfile\.interests_string_with_status\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }
  
  systemPromptContent = (importantPoints.length > 0
    ? `${systemPromptContent}\n\nÖnemli Noktalar:\n${importantPoints.map((point: string) => `- ${point}`).join('\n')}`
    : systemPromptContent
  ).trim();

  // Bu döngü sadece OpenRouter sağlayıcıları için çalışacak
  // Eğer ilk provider Gemini ise ve başarılı olduysa bu döngüye girilmeyecek.
  // Eğer ilk provider Gemini ise ve hata fırlattıysa, makeAPIRequest sonlanacak.
  // Eğer config.ts'de Gemini'den sonra OpenRouter provider'ları varsa ve Gemini'ye özel blok
  // hatayı yukarı fırlatmak yerine bir sonraki provider'a geçişi sağlayacak şekilde düzenlenirse,
  // bu döngü o zaman Gemini sonrası OpenRouter provider'ları için çalışır.
  // Mevcut haliyle, Gemini `type`ına sahip olmayan providerlar için bu döngü çalışır.
  while (attempts < maxAttempts) {
    const currentAttemptProvider = AI_PROVIDERS[currentProviderIndex]; // Döngü içinde her seferinde mevcut index'e göre al

    if (!currentAttemptProvider) {
      console.error("Geçersiz sağlayıcı dizini (döngü içi), 0'a sıfırlanıyor");
      await setCurrentProvider(0); // Başa dön
      attempts++; // Yeniden deneme sayısını artır
      continue;
    }

    // Eğer döngüdeki sağlayıcı Gemini ise atla, çünkü yukarıda zaten handle edildi.
    // Bu, config.ts'de birden fazla Gemini provider'ı olmayacağını varsayar,
    // veya hepsi aynı şekilde (yukarıdaki blokta) ele alınır.
    if (currentAttemptProvider.type === 'gemini') {
      console.warn(`Gemini sağlayıcısı (${currentAttemptProvider.id}) zaten denendi veya döngüde atlanıyor.`);
      await setCurrentProvider((currentProviderIndex + 1) % AI_PROVIDERS.length);
      attempts++; // Bu atlamayı bir deneme olarak sayabiliriz veya saymayabiliriz. Mantığa göre değişir.
                  // Şimdilik bir deneme olarak sayalım ki sonsuz döngüye girmesin.
      if (AI_PROVIDERS.every(p => p.type === 'gemini')) { // Eğer tüm providerlar gemini ise ve hepsi yukarıda fail ettiyse döngüden çık
          throw new Error('Tüm Gemini sağlayıcıları denendi ve başarısız oldu.');
      }
      continue;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const formattedMessages = messages.map(msg => {
        if (msg.images && msg.images.length > 0) {
          return {
            role: msg.role,
            content: [
              { type: "text", text: msg.content },
              ...msg.images.map(imageUrl => ({
                type: "image_url",
                image_url: { url: imageUrl } // OpenRouter base64 kabul etmiyorsa bu uygun
              }))
            ]
          };
        }
        return { role: msg.role, content: msg.content };
      });

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentAttemptProvider.key}`,
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: currentAttemptProvider.model,
          messages: [
            { role: "system", content: systemPromptContent },
            ...formattedMessages
          ],
          temperature: temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`API Hatası (${response.status}), sağlayıcı ${currentAttemptProvider.id}:`, errorBody);
        throw new Error(`API isteği ${response.status} durumuyla başarısız oldu`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content && data.choices?.[0]?.message?.content !== "") {
        console.error('API\'den geçersiz yanıt formatı:', data);
        throw new Error('API\'den geçersiz yanıt formatı');
      }
      
      return data; // Başarılı yanıtı döndür

    } catch (error) {
      console.error(`Deneme ${attempts + 1}/${maxAttempts}: API isteği hatası, sağlayıcı ${currentAttemptProvider?.id || 'bilinmiyor'}.`, error);
      await setCurrentProvider((currentProviderIndex + 1) % AI_PROVIDERS.length); // Bir sonraki sağlayıcıya geç
      attempts++;
      
      if (attempts >= maxAttempts) {
        console.error('Tüm API sağlayıcıları ve yeniden denemeler tükendi.');
        throw new Error('Birden fazla denemeden sonra tüm sağlayıcılar başarısız oldu.');
      }
      
      // Yeniden deneme gecikmesi, aynı sağlayıcıya hemen tekrar yüklenmemek için
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (Math.floor(attempts / AI_PROVIDERS.filter(p => p.type !== 'gemini').length) + 1) ));
    }
  }
  // Bu noktaya gelinirse, tüm denemeler başarısız olmuştur (OpenRouter için)
  throw new Error('Tüm OpenRouter denemelerinden sonra API isteği başarısız oldu.');
}