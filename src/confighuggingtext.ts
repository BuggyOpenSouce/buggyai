// project/src/confighuggingtext.ts

// Ollama yerel API endpoint'i
const OLLAMA_API_URL = 'http://localhost:11434/api/chat';

// Ollama'da kullanmak istediğiniz modelin adı
const OLLAMA_MODEL_ID = "phi4:14b";

// makeHFAPIRequest fonksiyonunun utils/api.ts'den alabileceği mesaj formatı
interface InputMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

// Ollama API'sine gönderilecek mesaj formatı
// phi4:14b gibi metin tabanlı modeller için content string olmalıdır.
interface OllamaApiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  // images?: string[]; // Eğer phi4:14b multimodalsa ve base64 görselleri destekliyorsa burası kullanılabilirdi.
                       // Şu anki phi4:14b kullanımı için sadece metin varsayıyoruz.
}

// src/utils/api.ts dosyasının beklediği çıktı formatı
interface FormattedChatCompletionOutput {
  id: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason?: string;
    index?: number;
  }>;
  created?: number;
  model?: string;
  object?: string;
}

export async function makeHFAPIRequest(messages: InputMessage[]): Promise<FormattedChatCompletionOutput> {
  // Gelen mesajları Ollama'nın beklediği formata dönüştür
  const ollamaMessages: OllamaApiChatMessage[] = messages.map(msg => {
    let textContent = "";
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      // OpenAI'nin multimodal formatından metin içeriğini çıkar
      const textPart = msg.content.find(part => part.type === 'text');
      if (textPart && 'text' in textPart) {
        textContent = textPart.text;
      }
      // Not: phi4:14b metin tabanlı olduğu için image_url kısımları burada işlenmiyor.
      // Eğer model multimodal olsaydı, image_url'ler base64'e çevrilip `images` alanına eklenebilirdi.
    }
    return {
      role: msg.role,
      content: textContent,
    };
  });

  const payload = {
    model: OLLAMA_MODEL_ID,
    messages: ollamaMessages,
    stream: false, // Tek seferlik yanıt almak için stream: false
  };

  console.log(
    `Making Ollama API request to model: ${OLLAMA_MODEL_ID} at ${OLLAMA_API_URL} with payload:`,
    JSON.stringify(payload, null, 2)
  );

  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Ollama API request failed with status ${response.status}:`, errorBody);
      throw new Error(`Ollama API isteği başarısız oldu: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const rawResponse = await response.json();
    console.log("Raw response from Ollama API:", JSON.stringify(rawResponse, null, 2));

    let generatedContent = "";
    if (rawResponse && rawResponse.message && typeof rawResponse.message.content === 'string') {
      generatedContent = rawResponse.message.content;
    } else {
      console.warn("Ollama yanıt yapısı beklenildiği gibi değil. Ham yanıt:", rawResponse);
      generatedContent = "Hata: Ollama'dan beklenmeyen yanıt yapısı.";
    }

    return {
      id: 'ollama-req-' + Date.now(), // Benzersiz bir ID oluştur
      choices: [
        {
          message: {
            role: 'assistant',
            content: generatedContent,
          },
          // Ollama 'done: true' ise 'stop', 'done: false' ise 'length' (veya undefined)
          finish_reason: rawResponse.done === true ? 'stop' : (rawResponse.done === false ? 'length' : undefined),
        },
      ],
      // 'created_at' varsa saniyeye çevir, yoksa şu anki zamanı kullan
      created: rawResponse.created_at ? Math.floor(new Date(rawResponse.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
      model: rawResponse.model || OLLAMA_MODEL_ID,
      object: 'chat.completion',
    };

  } catch (error: any) {
    console.error('makeHFAPIRequest içinde Ollama API isteği sırasında hata:', error);
    // Ağ hatası veya fetch ile ilgili diğer hatalar buraya düşebilir
    throw new Error(`Ollama'dan yanıt alınamadı: ${error.message}`);
  }
}

// ÖNEMLİ: Bu dosya artık yerel Ollama sunucusuyla iletişim kurmak üzere yapılandırılmıştır.
// Hugging Face Inference API'ye özgü olan HF_ACCESS_TOKEN, HF_PROVIDERS,
// getCurrentHFProvider, setProviderCooldown gibi yapılara ihtiyaç yoktur ve kaldırılmıştır.
// `makeHFAPIRequest` fonksiyon adı, `src/utils/api.ts` dosyasındaki çağrıyla uyumlu olması için
// şimdilik korunmuştur. İsteğe bağlı olarak projenizin yapısına göre yeniden adlandırılabilir
// (örneğin, `makeOllamaAPIRequest`).