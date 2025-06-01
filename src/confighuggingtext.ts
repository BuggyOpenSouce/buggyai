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
  
  // Dynamically import the module
  const HfInferenceModule = await import("@huggingface/inference");
  
  // Access the constructor using the name revealed by your console log: HfInference
  const ClientConstructor = HfInferenceModule.HfInference;

  // Verify that ClientConstructor is indeed a function before trying to instantiate it
  if (typeof ClientConstructor !== 'function') {
    console.error(
      "Failed to correctly access the HfInference constructor. Actual imported module:", 
      HfInferenceModule
    );
    throw new TypeError(
      "The resolved HfInference class is not a constructor. Check module exports."
    );
  }

  const client = new ClientConstructor(provider.key);

  try {
    const chatCompletionResult = await client.chatCompletion({
      model: provider.model,
      messages: messages
    });

    return chatCompletionResult;
  } catch (error) {
    console.error('HuggingFace API Error:', error);
    throw error;
  }
}