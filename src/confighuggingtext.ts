// project/src/confighuggingtext.ts

// Ollama yerel API endpoint'i
const OLLAMA_API_URL = 'http://localhost:11434/api/chat';

// Ollama'da kullanmak istediğiniz modelin adı (Ollama'ya pull ettiğiniz model adı)
// Örneğin: "llama3:latest", "qwen:7b", "mistral:latest"
// Bu değeri projenizin ihtiyacına göre veya kullanıcı ayarlarından alınabilir hale getirebilirsiniz.
const OLLAMA_MODEL_ID = "qwen:latest"; // Örnek olarak Qwen, bunu `ollama pull qwen` ile indirmelisiniz.

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
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

export async function makeHFAPIRequest(messages: ChatMessage[]): Promise<FormattedChatCompletionOutput> {
  // Fonksiyon adını makeOllamaAPIRequest olarak değiştirebilirsiniz, şimdilik aynı bırakıyorum.

  // Ollama'nın çalışıp çalışmadığını veya modelin varlığını kontrol etmek için ek mantık eklenebilir.
  // Şimdilik direkt istek gönderiyoruz.

  const payload = {
    model: OLLAMA_MODEL_ID,
    messages: messages,
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
      // HTTP hata durumlarını ele al
      const errorBody = await response.text();
      console.error(`Ollama API request failed with status ${response.status}:`, errorBody);
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const rawResponse = await response.json();
    console.log("Raw response from Ollama API:", JSON.stringify(rawResponse, null, 2));

    // Ollama /api/chat non-streaming yanıt formatı genellikle şu şekildedir:
    // {
    //   "model": "...",
    //   "created_at": "...",
    //   "message": {
    //     "role": "assistant",
    //     "content": "..."
    //   },
    //   "done": true,
    //   "total_duration": ...,
    //   "load_duration": ...,
    //   "prompt_eval_count": ...,
    //   "prompt_eval_duration": ...,
    //   "eval_count": ...,
    //   "eval_duration": ...
    // }
    // Bizim için önemli olan `rawResponse.message.content`.

    let generatedContent = "";
    if (rawResponse && rawResponse.message && typeof rawResponse.message.content === 'string') {
      generatedContent = rawResponse.message.content;
    } else {
      console.warn("Ollama response structure was not as expected. Raw response:", rawResponse);
      // Fallback olarak tüm yanıtı stringify etmeye çalışabiliriz, ancak ideal değil.
      generatedContent = JSON.stringify(rawResponse);
    }

    // src/utils/api.ts'nin beklediği formata dönüştür
    return {
      id: 'ollama-req-' + Date.now(), // Benzersiz bir ID oluştur
      choices: [
        {
          message: {
            role: 'assistant',
            content: generatedContent,
          },
          finish_reason: rawResponse.done ? 'stop' : 'length', // Ollama 'done' alanı sağlar
        },
      ],
      created: rawResponse.created_at ? new Date(rawResponse.created_at).getTime() / 1000 : Math.floor(Date.now() / 1000),
      model: rawResponse.model || OLLAMA_MODEL_ID,
      object: 'chat.completion',
    };

  } catch (error: any) {
    console.error('Error during Ollama API request in makeHFAPIRequest:', error);
    // Network hatası veya fetch ile ilgili diğer hatalar buraya düşebilir
    throw error; // Hatayı yeniden fırlat
  }
}

// ÖNEMLİ: Bu dosyada artık Hugging Face'e özgü HF_ACCESS_TOKEN, HF_PROVIDERS,
// getCurrentHFProvider, setProviderCooldown gibi yapılara ihtiyaç yoktur ve kaldırılmıştır.
// makeHFAPIRequest fonksiyonunun adı projenizde daha genel bir anlama geliyorsa
// (örneğin makeAIRequest) veya özellikle Ollama'ya işaret etmesini istiyorsanız
// (makeOllamaAPIRequest) değiştirebilirsiniz.