// project/src/confighuggingtext.ts

export const HF_ACCESS_TOKEN = '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';
// Model ID from your new example, which seems to be found by the API (no 404)
const HF_MODEL_ID = "Qwen/Qwen3-235B-A22B";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Define an interface for the expected output structure for better type safety
// This is what src/utils/api.ts will consume.
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
  if (!HF_ACCESS_TOKEN) {
    console.error("HuggingFace Access Token is not set in src/confighuggingtext.ts");
    throw new Error("HuggingFace Access Token is not configured.");
  }

  const HfInferenceModule = await import("@huggingface/inference");
  // Ensure we are using HfInference as the constructor name
  const ClientConstructor = HfInferenceModule.HfInference;

  if (typeof ClientConstructor !== 'function') {
    console.error(
      "Failed to correctly access the HfInference constructor from @huggingface/inference. Module content:", 
      HfInferenceModule
    );
    throw new TypeError(
      "The resolved HfInference class is not a constructor. Please check module exports."
    );
  }

  const client = new ClientConstructor(HF_ACCESS_TOKEN);

  try {
    const payload = {
      model: HF_MODEL_ID,
      messages: messages,
      // Consider adding 'options: { use_cache: false }' if you need to ensure the latest response
      // or 'stream: false' if the endpoint might default to streaming and you're not handling it.
    };
    console.log(
      `Using HfInference.request with model: ${HF_MODEL_ID}, payload:`,
      JSON.stringify(payload, null, 2)
    );

    // Switch to client.request as per the error message's advice
    const rawResponse = await client.request(payload);

    // CRITICAL LOG: This will show the actual structure of the response from the Qwen model
    console.log("Raw response from HfInference.request:", JSON.stringify(rawResponse, null, 2));

    // --- IMPORTANT: Adjust parsing logic below based on the logged rawResponse ---
    let generatedContent = "";
    const responseObject = rawResponse as any; // Use type assertion for easier access

    if (typeof responseObject === 'object' && responseObject !== null) {
      if (Array.isArray(responseObject)) {
        // Case: Response is an array (e.g., some text-generation models return [{ "generated_text": "..." }])
        if (responseObject.length > 0 && responseObject[0]) {
          const firstItem = responseObject[0];
          if (typeof firstItem.generated_text === 'string') {
            generatedContent = firstItem.generated_text;
          } else if (firstItem.message && typeof firstItem.message.content === 'string') { // OpenAI-like choice in array
            generatedContent = firstItem.message.content;
          }
        }
      } else {
        // Case: Response is an object
        if (typeof responseObject.generated_text === 'string') { // Common for text generation
          generatedContent = responseObject.generated_text;
        } else if (responseObject.choices && Array.isArray(responseObject.choices) && responseObject.choices.length > 0) {
          // OpenAI-like structure
          const firstChoice = responseObject.choices[0];
          if (firstChoice.message && typeof firstChoice.message.content === 'string') {
            generatedContent = firstChoice.message.content;
          } else if (typeof firstChoice.text === 'string') { // Some models use 'text' in choice
            generatedContent = firstChoice.text;
          }
        } else if (responseObject.output && typeof responseObject.output.text === 'string') {
          // Some models (like certain Qwen versions via direct API) use { "output": { "text": "..." } }
          generatedContent = responseObject.output.text;
        } else if (typeof responseObject.response === 'string') {
          // Some models might return { "response": "..." }
          generatedContent = responseObject.response;
        } else if (typeof responseObject.text === 'string') { // Simpler { "text": "..." }
            generatedContent = responseObject.text;
        }
        // Add more specific parsing rules here if the Qwen model has a unique structure.
      }
    }

    // Fallback if no specific content was extracted
    if (!generatedContent && rawResponse) {
      if (typeof rawResponse === 'string') {
        generatedContent = rawResponse; // If the whole response is just a string
      } else {
        console.warn("Could not specifically parse meaningful content from rawResponse. Stringifying the response as a fallback.");
        generatedContent = JSON.stringify(rawResponse);
      _}
    }
    // --- End of parsing logic ---

    // Reconstruct an object that src/utils/api.ts expects
    return {
      id: 'hf-req-' + Date.now(),
      choices: [
        {
          message: {
            role: 'assistant',
            content: generatedContent,
          },
          finish_reason: 'stop', // Placeholder, adjust if model provides this
        },
      ],
      model: HF_MODEL_ID,
      object: 'chat.completion', // Mimic standard chat completion object type
    };

  } catch (error: any) {
    console.error('HuggingFace API Error in makeHFAPIRequest (using client.request):', error);
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