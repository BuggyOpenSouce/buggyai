// project/src/confighuggingtext.ts

export const HF_ACCESS_TOKEN = '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';

export const HF_PROVIDERS = [
  {
    id: 'buggyai-hf',
    name: 'BuggyAI-HF',
    key: HF_ACCESS_TOKEN,
    model: 'Qwen/Qwen2.5-VL-32B-Instruct',
    available: true,
    busy: false,
  }
];

let currentProviderIndex = 0;
const providerCooldowns = new Map<string, number>();
const COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCurrentHFProvider() {
  while (
    currentProviderIndex < HF_PROVIDERS.length &&
    isProviderOnCooldown(HF_PROVIDERS[currentProviderIndex].id)
  ) {
    currentProviderIndex++;
  }

  if (currentProviderIndex >= HF_PROVIDERS.length) {
    currentProviderIndex = 0;
    if (isProviderOnCooldown(HF_PROVIDERS[currentProviderIndex].id)) {
        throw new Error('All HuggingFace providers are currently on cooldown. Please try again in a few minutes.');
    }
  }

  return {
    ...HF_PROVIDERS[currentProviderIndex],
    index: currentProviderIndex,
  };
}

export function setProviderCooldown(providerId: string) {
  providerCooldowns.set(providerId, Date.now() + COOLDOWN_DURATION);
}

function isProviderOnCooldown(providerId: string): boolean {
  const cooldownUntil = providerCooldowns.get(providerId);
  if (!cooldownUntil) return false;
  return Date.now() < cooldownUntil;
}

export async function makeHFAPIRequest(messages: any[]) {
  // IMPORTANT FOR DEBUGGING "fetching blob" error:
  // 1. CHECK BROWSER NETWORK TAB: Inspect the failing API request for status code, response headers, and response body.
  // 2. TEST WITH TEXT-ONLY INPUT: Temporarily send a simple text message (no images) to see if the error persists.
  //    If text-only works, the issue is highly related to the image data or multimodal payload.
  //    Example: const testMessages = [{role: "user", content: "Hello world"}]; and use testMessages.
  
  const provider = getCurrentHFProvider();
  
  const HfInferenceModule = await import("@huggingface/inference");
  const ClientConstructor = HfInferenceModule.HfInference;

  if (typeof ClientConstructor !== 'function') {
    console.error("Failed to correctly access the HfInference constructor. Actual imported module:", HfInferenceModule);
    throw new TypeError("The resolved HfInference class is not a constructor. Check module exports.");
  }

  const client = new ClientConstructor(provider.key);

  try {
    const payload = {
      model: provider.model,
      messages: messages,
    };
    
    console.log("Using HfInference.request with payload (model and messages structure):", 
      JSON.stringify({ 
        model: payload.model, 
        messages: payload.messages.map((m:any) => ({
          role: m.role, 
          contentType: typeof m.content, 
          contentPreview: Array.isArray(m.content) ? m.content.map((c:any) => ({type: c.type, hasUrl: !!c.image_url?.url}) ) : (typeof m.content === 'string' ? m.content.substring(0,50) + "..." : m.content),
          hasImages: Array.isArray(m.content) && m.content.some((c:any) => c.type === 'image_url') 
        })) 
      }, null, 2)
    );

    const rawResponse = await client.request(payload);

    console.log("Raw response from HfInference.request:", JSON.stringify(rawResponse, null, 2));

    let generatedContent = "";
    if (typeof rawResponse === 'object' && rawResponse !== null) {
      if (Array.isArray(rawResponse)) {
        if (rawResponse.length > 0 && rawResponse[0]) {
          const firstItem = rawResponse[0];
          if (typeof firstItem.generated_text === 'string') {
            generatedContent = firstItem.generated_text;
          } else if (firstItem.message && typeof firstItem.message.content === 'string') {
            generatedContent = firstItem.message.content;
          } else if (typeof firstItem.text === 'string') {
             generatedContent = firstItem.text;
          }
        }
      } else {
        const responseObject = rawResponse as any;
        if (typeof responseObject.generated_text === 'string') {
          generatedContent = responseObject.generated_text;
        } else if (responseObject.choices && Array.isArray(responseObject.choices) && responseObject.choices.length > 0) {
          if (responseObject.choices[0].message && typeof responseObject.choices[0].message.content === 'string') {
            generatedContent = responseObject.choices[0].message.content;
          } else if (typeof responseObject.choices[0].text === 'string') {
            generatedContent = responseObject.choices[0].text;
          }
        } else if (typeof responseObject.text === 'string') {
             generatedContent = responseObject.text;
        }
      }
    }
    if (!generatedContent && rawResponse) {
      if (typeof rawResponse === 'string') {
        generatedContent = rawResponse;
      } else {
        console.warn("Could not specifically parse meaningful content from rawResponse. Stringifying the response.");
        generatedContent = JSON.stringify(rawResponse);
      }
    }

    return {
      id: 'hf-req-' + Date.now(),
      choices: [ { message: { role: 'assistant', content: generatedContent, }, finish_reason: 'stop', index: 0, } ],
      created: Math.floor(Date.now() / 1000),
      model: provider.model,
      object: 'chat.completion',
    };

  } catch (error: any) {
    console.error('HuggingFace API Error (using HfInference.request):', error);
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    if (error.stack) {
        console.error('Error Stack:', error.stack);
    }
    if (error.cause) {
      console.error('Error Cause:', error.cause);
      if ((error.cause as any).stack) {
         console.error('Error Cause Stack:', (error.cause as any).stack);
      }
    }
    if (error.response && typeof error.response.status === 'number') {
        console.error('Underlying Response Status (from error.response):', error.response.status);
        try {
            const errorResponseText = await error.response.text();
            console.error('Underlying Response Body Text (from error.response):', errorResponseText);
        } catch (e) {
            console.error('Could not get text from error.response body:', e);
        }
    } else if (typeof error.status === 'number') {
        console.error('Error Status (from error object directly):', error.status);
    }
    
    throw error;
  }
}