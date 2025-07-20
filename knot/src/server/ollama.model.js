/**
 * OllamaChat Service
 * * This class provides a client-side interface for interacting with the Ollama API.
 * It handles model loading, chat history (context), streaming responses,
 * file attachments (for multimodal models), and pulling new models.
 * * @param {object} options - Configuration options.
 * @param {string} [options.ollamaHost='http://localhost:11434'] - The URL of the Ollama server.
 */
class OllamaChat {
  constructor({ ollamaHost = 'http://localhost:11434' } = {}) {
    this.ollamaHost = ollamaHost;
    this.context = [];
    this.isStreaming = false;
    this.selectedFile = null;
  }

  /**
   * Fetches the list of available models from the Ollama server.
   * @returns {Promise<Array<object>>} A promise that resolves to a sorted array of model objects.
   */
  async loadModels() {
    try {
      const response = await fetch(`${this.ollamaHost}/api/tags`);
      if (!response.ok) throw new Error(`Ollama API responded with status ${response.status}`);

      const data = await response.json();
      const models = data.models || [];
      // Sort models alphabetically by name for consistent UI presentation.
      models.sort((a, b) => a.name.localeCompare(b.name));
      return models;
    } catch (error) {
      console.error('Error loading models:', error);
      throw error;
    }
  }

  /**
   * Sets the file to be attached to the next message.
   * @param {File | null} file - The file object to attach.
   */
  setFile(file) {
    this.selectedFile = file || null;
  }

  /**
   * Clears the currently selected file.
   */
  resetFile() {
    this.selectedFile = null;
  }

  /**
   * Returns the current streaming state.
   * @returns {boolean} True if a message is currently being streamed.
   */
  getStreamingState() {
    return this.isStreaming;
  }

  /**
   * Sends a message to the Ollama API and returns a ReadableStream for the response.
   * @param {object} params - The message parameters.
   * @param {string} params.text - The text content of the message.
   * @param {string} params.model - The name of the model to use.
   * @returns {Promise<ReadableStream>} A promise that resolves to a ReadableStream of response chunks.
   */
  async sendMessage({ text, model }) {
    if (this.isStreaming) return;
    if (!text && !this.selectedFile) return;

    this.isStreaming = true;

    let fileData = null;
    if (this.selectedFile && this.selectedFile.type.startsWith('image/')) {
      fileData = await this.base64Encode(this.selectedFile);
    }

    const userMessage = {
      role: 'user',
      content: text || '',
      images: fileData ? [fileData] : undefined,
    };

    // The API expects a list of all previous messages.
    const messagesForApi = [...this.context, userMessage];

    try {
      const response = await fetch(`${this.ollamaHost}/api/chat`, {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: messagesForApi,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // We pass the userMessage to be included in the context after the stream is complete.
      return this.handleStream(response, userMessage);
    } catch (error) {
      console.error("Send message error:", error);
      this.isStreaming = false;
      throw error;
    } finally {
      // Always clear the file after attempting to send.
      this.resetFile();
    }
  }

  /**
   * Processes the streaming response from the Ollama API.
   * @param {Response} response - The fetch API response object.
   * @param {object} userMessage - The original user message object.
   * @returns {ReadableStream} A new ReadableStream that emits structured update/done events.
   * @private
   */
  handleStream(response, userMessage) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = { role: 'assistant', content: '' };

    const stream = new ReadableStream({
      start: (controller) => {
        const push = async () => {
          const { value, done } = await reader.read();
          if (done) {
            // This block is called when the stream from the server is completely closed.
            this.isStreaming = false;
            this.context.push(userMessage, assistantMessage);
            controller.enqueue({ type: 'done', message: assistantMessage });
            controller.close();
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          // The stream sends multiple JSON objects, separated by newlines.
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.content) {
                const contentChunk = data.message.content;
                assistantMessage.content += contentChunk;

                // *** THE FIX IS HERE ***
                // We enqueue only the new chunk of content for the 'update' event.
                // The frontend will be responsible for appending this chunk to its state.
                controller.enqueue({ type: 'update', content: contentChunk });
              }
              if (data.done) {
                // This block is called when Ollama sends a "done" message.
                this.isStreaming = false;
                this.context.push(userMessage, assistantMessage);
                controller.enqueue({ type: 'done', message: assistantMessage });
                controller.close();
                return;
              }
            } catch (e) {
              console.warn('Failed to parse JSON chunk:', line, e);
            }
          }
          // Continue reading from the stream.
          push();
        };
        push();
      }
    });
    return stream;
  }

  /**
   * Pulls a model from the Ollama registry.
   * @param {string} modelName - The name of the model to pull.
   * @param {function} onProgress - A callback function to report progress.
   */
  async pullModel(modelName, onProgress) {
    const response = await fetch(`${this.ollamaHost}/api/pull`, {
      method: 'POST',
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line);
      lines.forEach(line => {
        try {
          const data = JSON.parse(line);
          if (onProgress) onProgress(data);
        } catch (e) {
          console.warn('Failed to parse JSON chunk during pull:', line, e);
        }
      });
    }
  }

  /**
 * Deletes a model from the Ollama server.
 * @param {string} modelName - The name of the model to delete.
 * @returns {Promise<void>} A promise that resolves when the model is deleted.
 */
  async deleteModel(modelName) {
    try {
      const response = await fetch(`${this.ollamaHost}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete model: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error(`Error deleting model "${modelName}":`, error);
      throw error;
    }
  }


  /**
   * Clears the chat context, effectively starting a new conversation.
   */
  clearChat() {
    this.context = [];
    this.selectedFile = null;
    this.isStreaming = false;
  }

  /**
   * Returns the current chat context.
   * @returns {Array<object>} The array of message objects.
   */
  getContext() {
    return this.context;
  }

  /**
   * Encodes a file to a base64 string.
   * @param {File} file - The file to encode.
   * @returns {Promise<string>} A promise that resolves to the base64 encoded string.
   * @private
   */
  async base64Encode(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // result is "data:image/jpeg;base64,LzlqLzRBQ...". We only want the part after the comma.
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }
}

// To use this in your React app, you would export it and import it elsewhere.
export { OllamaChat };
