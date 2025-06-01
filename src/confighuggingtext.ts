// project/src/confighuggingtext.ts

export const HF_ACCESS_TOKEN = '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';
const HF_MODEL_ID = "Qwen/Qwen3-235B-A22B";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

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
  const ClientConstructor = HfInferenceModule.HfInference;

  if (typeof ClientConstructor !== 'function') {
    console.error("Failed to correctly access HfInference constructor. Module content:", HfInferenceModule);
    throw new TypeError("HfInference class not found in @huggingface/inference module.");
  }

  const client = new ClientConstructor(HF_ACCESS_TOKEN);

  try {
    // Construct payload for client.request, explicitly adding task: "conversational"
    // The 'inputs' for a conversational task usually takes the messages array directly.
    const payload = {
      model: HF_MODEL_ID,
      inputs: messages, // Pass the messages array as 'inputs'
      task: "conversational" as const, // Explicitly set the task
      // You might also need to add a 'parameters' object for things like max_tokens, temperature, etc.
      // e.g., parameters: { max_new_tokens: 500, temperature: 0.7 }
    };
    console.log(
      `Using HfInference.request with model: ${HF_MODEL_ID}, task: "conversational", payload:`,
      JSON.stringify(payload, null, 2)
    );

    // Use client.request with the explicit task
    const rawResponse = await client.request(payload);

    // CRITICAL LOG: This will show the actual structure from the model.
    console.log("Raw response from HfInference.request (task: conversational):", JSON.stringify(rawResponse, null, 2));

    // --- IMPORTANT: Adjust parsing logic below based on the logged rawResponse ---
    let generatedContent = "";
    const responseObject = rawResponse as any;

    if (typeof responseObject === 'object' && responseObject !== null) {
      // For 'conversational' task, output often includes 'generated_text'.
      // It might also include a 'conversation' object with past turns.
      if (typeof responseObject.generated_text === 'string') {
        generatedContent = responseObject.generated_text;
      } else if (responseObject.conversation && Array.isArray(responseObject.conversation.generated_responses) && responseObject.conversation.generated_responses.length > 0) {
        // Get the last generated response from the conversation history
        generatedContent = responseObject.conversation.generated_responses.slice(-1)[0];
      }
      // Fallback to other common structures if the above are not found
      else if (Array.isArray(responseObject)) {
        if (responseObject.length > 0 && responseObject[0]) {
          const firstItem = responseObject[0];
          if (typeof firstItem.generated_text === 'string') {
            generatedContent = firstItem.generated_text;
          } else if (firstItem.message && typeof firstItem.message.content === 'string') {
            generatedContent = firstItem.message.content;
          }
        }
      } else { // If response is a single object and not the conversational structure above
        if (responseObject.choices && Array.isArray(responseObject.choices) && responseObject.choices.length > 0) {
          const firstChoice = responseObject.choices[0];
          if (firstChoice.message && typeof firstChoice.message.content === 'string') {
            generatedContent = firstChoice.message.content;
          } else if (typeof firstChoice.text === 'string') {
            generatedContent = firstChoice.text;
          }
        } else if (responseObject.output && typeof responseObject.output.text === 'string') {
          generatedContent = responseObject.output.text;
        } else if (typeof responseObject.response === 'string') {
          generatedContent = responseObject.response;
        } else if (typeof responseObject.text === 'string') {
            generatedContent = responseObject.text;
        }
      }
    }

    if (!generatedContent && rawResponse) { // Fallback if specific parsing failed
      if (typeof rawResponse === 'string') {
        generatedContent = rawResponse;
      } else {
        console.warn("Could not specifically parse meaningful content from rawResponse. Stringifying as fallback.");
        generatedContent = JSON.stringify(rawResponse);
      }
    }
    // --- End of parsing logic ---

    return {
      id: 'hf-req-conv-' + Date.now(),
      choices: [
        {
          message: { role: 'assistant', content: generatedContent },
          finish_reason: 'stop', // Placeholder
        },
      ],
      model: HF_MODEL_ID,
      object: 'chat.completion',
    };

  } catch (error: any) {
    console.error('HuggingFace API Error in makeHFAPIRequest (using client.request with task="conversational"):', error);
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    if (error.stack) { console.error('Error Stack:', error.stack); }
    if (error.cause) {
      console.error('Error Cause:', error.cause);
      if ((error.cause as any).stack) { console.error('Error Cause Stack:', (error.cause as any).stack); }
    }
    if (error.response && typeof error.response.status === 'number') {
        console.error('Underlying Response Status (from error.response):', error.response.status);
        try {
            const errorResponseText = await error.response.text();
            console.error('Underlying Response Body Text (from error.response):', errorResponseText);
        } catch (e) { console.error('Could not get text from error.response body:', e); }
    } else if (typeof error.status === 'number') {
        console.error('Error Status (from error object directly):', error.status);
    }
    throw error;
  }
}