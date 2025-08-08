import { Ollama, Tool as OllamaTool, Message as OllamaMessage, ToolCall } from 'ollama';
import { AIMessage, AIModel, AppConfig, Tool, ToolResult } from '../types/index.js';

export class OllamaClient {
  private ollama: Ollama;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.ollama = new Ollama({ 
      host: config.ollamaUrl || 'http://localhost:11434'
    });
  }

  async listModels(): Promise<AIModel[]> {
    try {
      const response = await this.ollama.list();
      return response.models.map(model => ({
        name: model.name,
        size: model.size.toString(),
        parameter_size: model.details?.parameter_size || 'unknown',
        quantization_level: model.details?.quantization_level || 'unknown',
        modified_at: new Date(model.modified_at).toISOString(),
        digest: model.digest,
        details: model.details
      }));
    } catch (error) {
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pullModel(modelName: string): Promise<void> {
    try {
      await this.ollama.pull({ model: modelName });
    } catch (error) {
      throw new Error(`Failed to pull model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    try {
      await this.ollama.delete({ model: modelName });
    } catch (error) {
      throw new Error(`Failed to delete model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chatWithTools(messages: AIMessage[], tools?: Tool[], options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<{ message: string; toolCalls: ToolCall[] }> {
    try {
      const ollamaMessages: OllamaMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.toolCall ? [{
          function: {
            name: msg.toolCall.tool,
            arguments: msg.toolCall.parameters
          }
        }] : undefined
      }));

      const ollamaTools: OllamaTool[] | undefined = tools?.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));

      const response = await this.ollama.chat({
        model: options?.model || this.config.defaultModel,
        messages: ollamaMessages,
        tools: ollamaTools,
        options: {
          temperature: options?.temperature ?? this.config.temperature,
          num_predict: options?.maxTokens ?? this.config.maxTokens
        },
        stream: false
      });

      return {
        message: response.message.content,
        toolCalls: response.message.tool_calls || []
      };
    } catch (error) {
      throw new Error(`Chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chat(messages: AIMessage[], options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<string> {
    try {
      if (options?.stream) {
        // Handle streaming case differently
        const stream = await this.ollama.chat({
          model: options?.model || this.config.defaultModel,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          options: {
            temperature: options?.temperature ?? this.config.temperature,
            num_predict: options?.maxTokens ?? this.config.maxTokens
          },
          stream: true
        });
        
        let fullResponse = '';
        for await (const chunk of stream) {
          if (chunk.message?.content) {
            fullResponse += chunk.message.content;
          }
        }
        return fullResponse;
      } else {
        const response = await this.ollama.chat({
          model: options?.model || this.config.defaultModel,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          options: {
            temperature: options?.temperature ?? this.config.temperature,
            num_predict: options?.maxTokens ?? this.config.maxTokens
          },
          stream: false
        });

        return response.message.content;
      }
    } catch (error) {
      throw new Error(`Chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *chatStream(messages: AIMessage[], options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.ollama.chat({
        model: options?.model || this.config.defaultModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        options: {
          temperature: options?.temperature ?? this.config.temperature,
          num_predict: options?.maxTokens ?? this.config.maxTokens
        },
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.message?.content) {
          yield chunk.message.content;
        }
      }
    } catch (error) {
      throw new Error(`Streaming chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model: model || 'nomic-embed-text',
        prompt: text
      });
      return response.embedding;
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName);
    } catch {
      return false;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.ollamaUrl) {
      this.ollama = new Ollama({ host: updates.ollamaUrl });
    }
  }
}
