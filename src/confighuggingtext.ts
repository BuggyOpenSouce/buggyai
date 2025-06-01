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
  
  let ClientConstructor;

  // Attempt to access InferenceClient as a named export
  if (HfInferenceModule && typeof HfInferenceModule.InferenceClient === 'function') {
    ClientConstructor = HfInferenceModule.InferenceClient;
  } 
  // If not found as a named export, try checking if the default export is the constructor
  // or if default is an object containing InferenceClient (less common for classes, but possible)
  else if (HfInferenceModule && HfInferenceModule.default) {
    if (typeof HfInferenceModule.default === 'function') {
      // Check if the default export itself is the constructor
      ClientConstructor = HfInferenceModule.default;
    } else if (typeof HfInferenceModule.default.InferenceClient === 'function') {
      // Check if default is an object that has InferenceClient as a property
      ClientConstructor = HfInferenceModule.default.InferenceClient;
    }
  }

  // If ClientConstructor is still not found or not a function, throw an error
  if (typeof ClientConstructor !== 'function') {
    console.error("Could not find or resolve InferenceClient constructor from @huggingface/inference.", HfInferenceModule);
    throw new TypeError("InferenceClient is not a constructor. Module structure might be unexpected.");
  }

  const client = new ClientConstructor(provider.key);

  try {
    const chatCompletion = await client.chatCompletion({
      model: provider.model,
      messages: messages
    });

    return chatCompletion;
  } catch (error) {
    console.error('HuggingFace API Error:', error);
    throw error;
  }
}