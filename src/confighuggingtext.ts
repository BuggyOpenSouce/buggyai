// project/src/confighuggingtext.ts

export const HF_ACCESS_TOKEN = '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';
const HF_MODEL_ID = "Qwen/Qwen3-235B-A22B"; // Using model from user's example

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
    // Adjust payload: pass messages array under the 'inputs' key
    const payload = {
      model: HF_MODEL_ID,
      inputs: messages, 
      // You might also consider adding a 'parameters' field if the model needs it, e.g.,
      // parameters: { max_new_tokens: 512, temperature: 0.7 }
    };
    console.log(
      `Using HfInference.request with model: ${HF_MODEL_ID}, payload (using "inputs": messages):`,
      JSON.stringify(payload, null, 2)
    );

    const rawResponse = await client.request(payload);

    console.log("Raw response from HfInference.request:", JSON.stringify(rawResponse, null, 2));

    // --- IMPORTANT: Adjust parsing logic below based on the logged rawResponse ---
    let generatedContent = "";
    const responseObject = rawResponse as any; 

    if (typeof responseObject === 'object' && responseObject !== null) {
      if (Array.isArray(responseObject)) {
        if (responseObject.length > 0 && responseObject[0]) {
          const firstItem = responseObject[0];
          if (typeof firstItem.generated_text === 'string') {
            generatedContent = firstItem.generated_text;
          } else if (firstItem.message && typeof firstItem.message.content === 'string') {
            generatedContent = firstItem.message.content;
          }
        }
      } else {
        if (typeof responseObject.generated_text === 'string') {
          generatedContent = responseObject.generated_text;
        } else if (responseObject.choices && Array.isArray(responseObject.choices) && responseObject.choices.length > 0) {
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

    if (!generatedContent && rawResponse) {
      if (typeof rawResponse === 'string') {
        generatedContent = rawResponse;
      } else {
        console.warn("Could not specifically parse meaningful content from rawResponse. Stringifying the response as a fallback.");
        generatedContent = JSON.stringify(rawResponse);
      }
    }
    // --- End of parsing logic ---

    return {
      id: 'hf-req-' + Date.now(),
      choices: [
        {
          message: {
            role: 'assistant',
            content: generatedContent,
          },
          finish_reason: 'stop', 
        },
      ],
      model: HF_MODEL_ID,
      object: 'chat.completion',
    };

  } catch (error: any) {
    console.error('HuggingFace API Error in makeHFAPIRequest (using client.request with "inputs" key):', error);
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