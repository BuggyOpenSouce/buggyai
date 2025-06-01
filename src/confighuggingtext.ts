// project/src/confighuggingtext.ts
import { InferenceClient } from "@huggingface/inference";

// Use the same HF token as before
export const HF_ACCESS_TOKEN = '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';

// Model ID from your new example
const HF_MODEL_ID = "Qwen/Qwen3-235B-A22B";

// Type for messages based on common usage and your example
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function makeHFAPIRequest(messages: ChatMessage[]) {
  if (!HF_ACCESS_TOKEN) {
    console.error("HuggingFace Access Token is not set in src/confighuggingtext.ts");
    throw new Error("HuggingFace Access Token is not configured.");
  }

  const client = new InferenceClient(HF_ACCESS_TOKEN);

  try {
    console.log(
      `Making HuggingFace API request to model: ${HF_MODEL_ID} with messages:`,
      JSON.stringify(messages, null, 2)
    );

    const chatCompletion = await client.chatCompletion({
      provider: "hf-inference", // As per your example
      model: HF_MODEL_ID,       // Using model from your example
      messages: messages,
      // Optional: You might want to add parameters like max_tokens, temperature, etc.
      // stream: false, // Default is typically false; set explicitly if your endpoint/library behaves differently
    });

    // The calling code in src/utils/api.ts expects a structure where it can find
    // chatCompletion.choices[0].message.content.
    // The example logs chatCompletion.choices[0].message, which usually is {role, content}.
    // Returning the whole chatCompletion object should be compatible.
    console.log("Received chat completion from HuggingFace:", JSON.stringify(chatCompletion, null, 2));
    return chatCompletion;

  } catch (error: any) {
    console.error('HuggingFace API Error in makeHFAPIRequest:', error);
    
    // Log detailed error information
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
    
    // Attempt to log details from a potential HTTP response error
    // This was helpful in identifying the 404 earlier via Network Tab, though not always populated in caught 'error'
    if (error.response && typeof error.response.status === 'number') {
        console.error('Underlying Response Status (from error.response):', error.response.status);
        try {
            const errorResponseText = await error.response.text();
            console.error('Underlying Response Body Text (from error.response):', errorResponseText);
        } catch (e) {
            console.error('Could not get text from error.response body:', e);
        }
    } else if (typeof error.status === 'number') { // If the error object itself has a status
        console.error('Error Status (from error object directly):', error.status);
    }
    
    throw error; // Rethrow to allow calling function to handle it
  }
}

// Note: Functions like getCurrentHFProvider, setProviderCooldown, and the HF_PROVIDERS array
// have been removed to align with "recreate this file entirely using this example code",
// which implies a simpler, single-model setup for this file.
// If you need provider rotation or multiple Hugging Face models managed by this file,
// this new structure would need further adaptation.