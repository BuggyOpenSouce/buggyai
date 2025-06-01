// project/src/confighuggingtext.ts

export const HF_ACCESS_TOKEN = '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';
const HF_MODEL_ID = "Qwen/Qwen3-235B-A22B"; // Using model from your example

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
  let rawOutputToParse: any = null;

  try {
    console.log(
      `Attempting client.chatCompletion with model: ${HF_MODEL_ID}, messages:`,
      JSON.stringify(messages, null, 2)
    );

    // Use client.chatCompletion as per your example
    const chatCompletion = await client.chatCompletion({
      provider: "hf-inference", // From your example
      model: HF_MODEL_ID,
      messages: messages,
    });

    // If chatCompletion is successful and has the expected structure
    console.log("Raw response from successful client.chatCompletion:", JSON.stringify(chatCompletion, null, 2));
    if (chatCompletion && chatCompletion.choices && chatCompletion.choices.length > 0 && chatCompletion.choices[0].message) {
      return {
        id: chatCompletion.id || 'hf-chat-' + Date.now(),
        choices: chatCompletion.choices.map((choice: any, index: number) => ({
          message: {
            role: choice.message?.role || 'assistant',
            content: choice.message?.content || '',
          },
          finish_reason: choice.finish_reason,
          index: choice.index === undefined ? index : choice.index,
        })),
        created: chatCompletion.created || Math.floor(Date.now() / 1000),
        model: chatCompletion.model || HF_MODEL_ID,
        object: chatCompletion.object || 'chat.completion',
      };
    } else {
      // If structure is not as expected but no error was thrown, treat as raw output
      console.warn("client.chatCompletion succeeded but response structure was unexpected. Will attempt to parse as raw output:", chatCompletion);
      rawOutputToParse = chatCompletion;
    }

  } catch (error: any) {
    console.error('HuggingFace API Error in makeHFAPIRequest (attempting client.chatCompletion):', error);
    console.error('Error Name:', error.name); // Should be 'InferenceOutputError'
    console.error('Error Message:', error.message); // Should be about invalid output

    // Specifically check for InferenceOutputError and try to get raw output from error.output
    // The error name might be minified, so we check the message content too.
    if (error.name === 'InferenceOutputError' || (error.message && error.message.includes("Invalid inference output"))) {
      if (error.output !== undefined) {
        console.log("Caught InferenceOutputError. Raw output from error.output:", JSON.stringify(error.output, null, 2));
        rawOutputToParse = error.output; // This is the raw data we need to parse
      } else {
        console.warn("InferenceOutputError caught, but error.output was undefined. Cannot parse.", error);
        throw error; // Rethrow if we can't get the output
      }
    } else {
      // Log other details for unexpected errors
      if (error.stack) { console.error('Error Stack:', error.stack); }
      if (error.cause) { console.error('Error Cause:', error.cause); }
      if (error.response && typeof error.response.status === 'number') {
          console.error('Underlying Response Status (from error.response):', error.response.status);
          try {
              const errorResponseText = await error.response.text();
              console.error('Underlying Response Body Text (from error.response):', errorResponseText);
          } catch (e) { console.error('Could not get text from error.response body:', e); }
      } else if (typeof error.status === 'number') {
          console.error('Error Status (from error object directly):', error.status);
      }
      throw error; // Rethrow if it's not an InferenceOutputError we can handle
    }
  }

  // If rawOutputToParse has been populated (from error.output or unexpected success)
  if (rawOutputToParse !== null) {
    console.log("Attempting to parse raw output:", JSON.stringify(rawOutputToParse, null, 2));
    let generatedContent = "";
    const responseObject = rawOutputToParse as any;

    // --- Adjust this parsing logic based on the actual logged 'rawOutputToParse' ---
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
        } else if (typeof responseObject.text === 'string') { // Some Qwen models might return simple text
            generatedContent = responseObject.text;
        }
      }
    }
    if (!generatedContent && rawOutputToParse) {
      if (typeof rawOutputToParse === 'string') {
        generatedContent = rawOutputToParse;
      } else {
        console.warn("Could not specifically parse meaningful content from rawOutputToParse. Stringifying.");
        generatedContent = JSON.stringify(rawOutputToParse);
      }
    }
    // --- End of parsing logic ---

    return {
      id: 'hf-parsed-' + Date.now(),
      choices: [{
        message: { role: 'assistant', content: generatedContent },
        finish_reason: 'stop', // Placeholder
      }],
      model: HF_MODEL_ID,
      object: 'chat.completion',
    };
  }

  // This should ideally not be reached if the logic above correctly handles success or rethrows errors.
  console.error("makeHFAPIRequest completed without returning a valid response or throwing a clear error.");
  throw new Error("Failed to get a valid response from HuggingFace API after attempting to handle InferenceOutputError.");
}