import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool as Tool } from '@langchain/core/tools';
import { MemorySaver } from '@langchain/langgraph';

import { AgentCallbacks } from '../types/index.js';
import { OllamaClient } from '../client/ollama-client.js';
import { ConfigManager } from '../config/config.js';

export class LangGraphAgent {
  private ollama: OllamaClient;
  private configManager: ConfigManager;
  private graph: any; // Use any type to avoid the complex generic type mismatch
  private tools: Tool[];
  private memory: MemorySaver;
  private history: Array<AIMessage | HumanMessage | SystemMessage>;
  private cancelController: AbortController | null = null;
  private isProcessing: boolean = false;
  private callbacks: AgentCallbacks | null = null;

  constructor(ollamaClient: OllamaClient, configManager: ConfigManager, tools: Tool[]) {
    this.ollama = ollamaClient;
    this.configManager = configManager;
    this.tools = tools;
    this.graph = this.createAgentGraph();
    this.memory = new MemorySaver();
    this.history = [];
  }

  private createAgentGraph() {
    const graph = createReactAgent({
      llm: this.ollama.getLLM(),
      tools: this.tools,
      checkpointSaver: this.memory,
      prompt: this.configManager.getConfig().systemPrompt,
      postModelHook: this.postModelHook.bind(this),
    });
    return graph;
  }

  /**
   * Run the agent with a given input
   */
  async run(input: string, callbacks: AgentCallbacks): Promise<void> {
    try {
      this.isProcessing = true;
      this.cancelController = new AbortController();
      this.callbacks = callbacks;

      const userMessage = new HumanMessage({ content: input });
      this.history.push(userMessage);
      const processedMessageIds = new Set();
      for await (const chunk of await this.graph.stream(
        {
          messages: [...this.history.slice(-5), userMessage],
        },
        {
          configurable: { thread_id: 'main_thread' },
          streamMode: 'updates',
          recursionLimit: 30,
          signal: this.cancelController.signal,
        }
      )) {
        for (const [, values] of Object.entries(chunk)) {
          const messages = (values as any)['messages'];
          if (processedMessageIds.has(messages[messages.length - 1].id)) continue;
          processedMessageIds.add(messages[messages.length - 1].id);
          if (messages[messages.length - 1] instanceof AIMessage) {
            const res = String(messages[messages.length - 1].content);
            if (res !== '') {
              callbacks.onResponse(res);
              this.history.push(...messages);
            }
          } else {
            callbacks.onThinking(`Processing your request...`);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Abort') {
        return;
      }
      throw error;
    } finally {
      this.isProcessing = false;
      this.cancelController = null;
      this.callbacks = null;
    }
  }

  /**
   * Cancel the current operation
   */
  cancel(): void {
    if (this.cancelController && this.isProcessing) {
      this.cancelController.abort();
    }
  }

  /**
   * Check if the agent is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Process a confirmation response
   */
  // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
  async postModelHook(state: any, config: any): Promise<any> {
    // Check if the agent has decided to use a tool
    if (state.messages && state.messages.length > 0) {
      const lastStep = state.messages[state.messages.length - 1];
      if (lastStep instanceof AIMessage && lastStep.tool_calls && lastStep.tool_calls.length > 0) {
        const toolName = lastStep.tool_calls[0].name;
        const toolInput = lastStep.tool_calls[0].args;
        this.callbacks?.onThinking(`Calling tool ${toolName}`);

        if (this.requiresConfirmation(toolName)) {
          const userConfirmed = await this.callbacks?.onConfirmation(
            `Execute ${toolName}: ${toolInput.command}`
          );

          return {
            messages: [
              ...state.messages.slice(0, -1),
              new AIMessage({
                ...lastStep,
                tool_calls: [
                  {
                    ...lastStep.tool_calls[0],
                    args: {
                      ...lastStep.tool_calls[0].args,
                      approved: userConfirmed,
                    },
                  },
                  ...lastStep.tool_calls.slice(1),
                ],
              }),
            ],
          };
        }
      }
    }
    // If no tool or user confirmed, return state unchanged
    return state;
  }

  private requiresConfirmation(toolName: string): boolean {
    // Define which tools require confirmation based on their potential impact
    const destructiveTools = ['shell-exec'];
    return destructiveTools.includes(toolName);
  }
}
