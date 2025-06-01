// project/src/confighuggingtext.ts
// import { InferenceClient } from "@huggingface/inference"; // Static import was previously removed

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
    // It might be better to throw an error or handle the case where all providers are on cooldown,
    // but for now, it resets to 0. The original code did this.
    // Consider if throwing an error here is more appropriate for your application's logic.
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

  // Dynamically import InferenceClient
  const { InferenceClient } = await import("@huggingface/inference");
  const client = new InferenceClient(provider.key);

  try {
    const chatCompletion = await client.chatCompletion({
      // provider: "hf-inference", // Removed this line as it's not a standard parameter for client.chatCompletion
      model: provider.model,
      messages: messages
    });

    return chatCompletion;
  } catch (error) {
    console.error('HuggingFace API Error:', error);
    // Optional: If the error is due to the provider being busy or a specific type of error,
    // you might want to set it on cooldown here.
    // Example: if (error.message.includes("Model is overloaded")) { setProviderCooldown(provider.id); }
    throw error;
  }
}