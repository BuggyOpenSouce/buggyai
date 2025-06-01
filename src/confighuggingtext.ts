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
      // It's good practice to ensure the API doesn't try to stream if you're not handling it:
      // stream: false, // Add if necessary, though `request` might not use this directly;
                       // `chatCompletion` often has a separate `chatCompletionStream`
    };
    console.log("Using HfInference.request with payload:", JSON.stringify(payload, null, 2));

    const rawResponse = await client.request(payload);

    console.log("Raw response from HfInference.request:", JSON.stringify(rawResponse, null, 2));

    // --- IMPORTANT: Parse rawResponse based on its actual structure ---
    // The following is speculative parsing. You MUST inspect the logged rawResponse
    // and adjust this logic to correctly extract the model's output.
    let generatedContent = "";
    if (typeof rawResponse === 'object' && rawResponse !== null) {
      if (Array.isArray(rawResponse)) {
        // Often, text generation or chat tasks might return an array of choices/outputs
        if (rawResponse.length > 0 && rawResponse[0]) {
          const firstItem = rawResponse[0];
          if (typeof firstItem.generated_text === 'string') {
            generatedContent = firstItem.generated_text;
          } else if (firstItem.message && typeof firstItem.message.content === 'string') { // Similar to OpenAI choice
            generatedContent = firstItem.message.content;
          } else if (typeof firstItem.text === 'string') { // Another common pattern
             generatedContent = firstItem.text;
          }
        }
      } else {
        // If the response is an object, check for common properties
        const responseObject = rawResponse as any;
        if (typeof responseObject.generated_text === 'string') {
          generatedContent = responseObject.generated_text;
        } else if (responseObject.choices && Array.isArray(responseObject.choices) && responseObject.choices.length > 0) {
          if (responseObject.choices[0].message && typeof responseObject.choices[0].message.content === 'string') {
            generatedContent = responseObject.choices[0].message.content;
          } else if (typeof responseObject.choices[0].text === 'string') {
            generatedContent = responseObject.choices[0].text;
          }
        } else if (typeof responseObject.text === 'string') { // Top-level text property
             generatedContent = responseObject.text;
        }
      }
    }

    // If no specific parsing worked, and rawResponse itself might be simple text or needs to be stringified
    if (!generatedContent && rawResponse) {
      if (typeof rawResponse === 'string') {
        generatedContent = rawResponse;
      } else {
        // As a last resort, stringify, but ideally, you should have a specific parsing path.
        console.warn("Could not specifically parse meaningful content from rawResponse. Stringifying the response.");
        generatedContent = JSON.stringify(rawResponse);
      }
    }
    // --- End of speculative parsing ---

    // Reconstruct a ChatCompletionOutput-like structure for the rest of your app
    return {
      id: 'hf-req-' + Date.now(), // Generate a temporary ID
      choices: [
        {
          message: {
            role: 'assistant',
            content: generatedContent,
          },
          finish_reason: 'stop', // Assuming completion, adjust if needed
          index: 0,
        },
      ],
      created: Math.floor(Date.now() / 1000),
      model: provider.model,
      object: 'chat.completion', // Mimic OpenAI's object type
      // usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } // Placeholder for usage stats
    };

  } catch (error) {
    console.error('HuggingFace API Error (using HfInference.request):', error);
    throw error;
  }
}