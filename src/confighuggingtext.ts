// project/src/confighuggingtext.ts

// Static import `import { InferenceClient } ...` caused a build error.
// We will use dynamic import and the 'HfInference' class name identified previously.

export const HF_ACCESS_TOKEN = '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';

// Model ID from your new example
const HF_MODEL_ID = "Qwen/Qwen3-235B-A22B";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function makeHFAPIRequest(messages: ChatMessage[]) {
  if (!HF_ACCESS_TOKEN) {
    console.error("HuggingFace Access Token is not set in src/confighuggingtext.ts");
    throw new Error("HuggingFace Access Token is not configured.");
  }

  // Use dynamic import to load the module
  const HfInferenceModule = await import("@huggingface/inference");

  // Access the constructor using the HfInference name, which we found previously
  const ClientConstructor = HfInferenceModule.HfInference;

  if (typeof ClientConstructor !== 'function') {
    console.error(
      "Failed to correctly access the HfInference constructor from @huggingface/inference. Actual imported module content:", 
      HfInferenceModule
    );
    throw new TypeError(
      "The resolved HfInference class is not a constructor. Please check module exports and previous logs."
    );
  }

  const client = new ClientConstructor(HF_ACCESS_TOKEN);

  try {
    console.log(
      `Making HuggingFace API request to model: ${HF_MODEL_ID} with messages:`,
      JSON.stringify(messages, null, 2)
    );

    const chatCompletion = await client.chatCompletion({
      provider: "hf-inference", // As per your example
      model: HF_MODEL_ID,       // Using model from your example
      messages: messages,
    });

    console.log("Received chat completion from HuggingFace:", JSON.stringify(chatCompletion, null, 2));
    return chatCompletion;

  } catch (error: any) {
    console.error('HuggingFace API Error in makeHFAPIRequest:', error);
    
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