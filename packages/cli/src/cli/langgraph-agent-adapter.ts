import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { OllamaClient } from '@shell-ai/core';
import { MemoryManager } from '@shell-ai/core';
import { ConfigManager } from '@shell-ai/core';
import { LangGraphAgent, toolRegistry } from '@shell-ai/core';
import { DynamicStructuredTool as Tool } from '@langchain/core/tools';
import { AgentCallbacks } from '@shell-ai/core';

// Types from your existing codebase
interface AgentProcessorProps {
  client: OllamaClient;
  memory: MemoryManager;
  configManager: ConfigManager;
}

/**
 * Adapter that makes LangGraphAgent compatible with your existing AgentProcessor interface
 */
export class LangGraphAgentAdapter {
  private client: OllamaClient;
  private memory: MemoryManager;
  private configManager: ConfigManager;
  private langGraphAgent: LangGraphAgent;
  private currentConversationHistory: Array<HumanMessage | AIMessage> = [];

  constructor(props: AgentProcessorProps) {
    this.client = props.client;
    this.memory = props.memory;
    this.configManager = props.configManager;

    this.langGraphAgent = new LangGraphAgent(
      this.client,
      this.configManager,
      this.getEnabledTools()
    );
  }

  /**
   * Cancel the current operation
   */
  cancel(): void {
    this.langGraphAgent.cancel();
  }

  /**
   * Check if the agent is currently processing
   */
  isProcessing(): boolean {
    return this.langGraphAgent.isCurrentlyProcessing();
  }

  /**
   * Process user input (implements the same interface as AgentProcessor)
   */
  async processUserInput(input: string, callbacks: AgentCallbacks): Promise<void> {
    try {
      callbacks.onThinking('Analyzing your request...');

      // Run the LangGraph agent
      await this.langGraphAgent.run(input, callbacks);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private getEnabledTools(): Tool[] {
    const config = this.configManager.getConfig();
    const allTools = toolRegistry.list();
    return allTools.filter(tool => config.enabledTools.includes(tool.name));
  }
}
