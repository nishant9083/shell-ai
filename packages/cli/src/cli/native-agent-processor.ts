import {
  OllamaClient,
  MemoryManager,
  PluginManager,
  ConfigManager,
  AIMessage,
  toolRegistry,
  Tool,
  ToolResult
} from '@ai-cli/core';
import { ToolCall } from 'ollama';

interface AgentProcessorProps {
  client: OllamaClient;
  memory: MemoryManager;
  plugins: PluginManager;
  configManager: ConfigManager;
}

interface AgentCallbacks {
  onThinking: (thought: string) => void;
  onToolCall: (tool: string, params: Record<string, unknown>) => void;
  onConfirmation: (action: ConfirmationAction) => void;
  onResponse: (response: string) => void;
  onError: (error: string) => void;
}

interface ConfirmationAction {
  type: 'thinking' | 'tool_call' | 'confirmation' | 'response';
  content: string;
  tool?: string;
  parameters?: Record<string, unknown>;
  requiresConfirmation?: boolean;
}

export class AgentProcessor {
  private client: OllamaClient;
  private memory: MemoryManager;
  private plugins: PluginManager;
  private configManager: ConfigManager;

  constructor(props: AgentProcessorProps) {
    this.client = props.client;
    this.memory = props.memory;
    this.plugins = props.plugins;
    this.configManager = props.configManager;
  }

  async processUserInput(
    input: string,
    conversationHistory: Array<{ role: string; content: string; timestamp: Date }>,
    callbacks: AgentCallbacks
  ): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      
      // Get available tools
      const availableTools = this.getEnabledTools();
      
      // Prepare messages for Ollama
      const messages: AIMessage[] = [
        ...conversationHistory.slice(-5).map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp
        })),
        {
          role: 'user',
          content: input,
          timestamp: new Date()
        }
      ];

      callbacks.onThinking('Analyzing your request...');

      // Use Ollama's native tool calling
      const response = await this.client.chatWithTools(messages, availableTools, {
        model: config.currentModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      // Process tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        await this.processToolCalls(response.toolCalls, callbacks);
      } else {
        // No tools needed, just return the response
        callbacks.onResponse(response.message);
      }

    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async processToolCalls(
    toolCalls: ToolCall[],
    callbacks: AgentCallbacks
  ): Promise<void> {
    const toolResults: Array<{ tool: string; result: ToolResult }> = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const parameters = toolCall.function.arguments;

      // Check if tool requires confirmation
      if (this.requiresConfirmation(toolName, parameters)) {
        callbacks.onConfirmation({
          type: 'confirmation',
          content: `Execute ${toolName} with parameters: ${JSON.stringify(parameters, null, 2)}?`,
          tool: toolName,
          parameters,
          requiresConfirmation: true
        });
        return; // Exit here, will continue after confirmation
      }

      // Execute safe tools automatically
      callbacks.onToolCall(toolName, parameters);
      
      const tool = toolRegistry.get(toolName);
      if (tool) {
        try {
          const result = await tool.execute(parameters);
          toolResults.push({ tool: toolName, result });
        } catch (error) {
          callbacks.onError(`Tool ${toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
      } else {
        callbacks.onError(`Tool not found: ${toolName}`);
        return;
      }
    }

    // Generate response with tool results
    const finalResponse = this.formatToolResults(toolResults);
    callbacks.onResponse(finalResponse);
  }

  async executeConfirmedAction(
    action: ConfirmationAction,
    callbacks: Pick<AgentCallbacks, 'onResponse' | 'onError'>
  ): Promise<void> {
    try {
      const tool = toolRegistry.get(action.tool!);
      if (tool) {
        const result = await tool.execute(action.parameters!);
        
        if (result.success) {
          const response = `✅ Successfully executed ${action.tool}.\n\n${this.formatToolResult(result)}`;
          callbacks.onResponse(response);
        } else {
          callbacks.onError(`Tool execution failed: ${result.error}`);
        }
      } else {
        callbacks.onError(`Tool not found: ${action.tool}`);
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private getEnabledTools(): Tool[] {
    const config = this.configManager.getConfig();
    const allTools = toolRegistry.list();
    return allTools.filter(tool => config.enabledTools.includes(tool.name));
  }

  private requiresConfirmation(toolName: string, parameters: Record<string, unknown>): boolean {
    // Define which tools require confirmation based on their potential impact
    const destructiveTools = [
      'file-write', 
      'file-edit', 
      'shell-exec'
    ];

    if (destructiveTools.includes(toolName)) {
      // Additional checks for shell-exec
      if (toolName === 'shell-exec') {
        const command = parameters.command as string;
        if (command) {
          // Safe commands that don't require confirmation
          const safeCommands = [
            'ls', 'dir', 'pwd', 'whoami', 'ps', 'top', 'df', 'free',
            'cat', 'head', 'tail', 'less', 'more', 'grep', 'find',
            'git status', 'git log', 'git diff', 'npm list', 'node -v'
          ];
          
          const commandStart = command.trim().split(' ')[0].toLowerCase();
          const fullCommand = command.trim().toLowerCase();
          
          return !safeCommands.some(safe => 
            fullCommand.startsWith(safe.toLowerCase()) || commandStart === safe.split(' ')[0]
          );
        }
      }
      return true;
    }

    return false;
  }

  private formatToolResults(toolResults: Array<{ tool: string; result: ToolResult }>): string {
    if (toolResults.length === 0) {
      return "I've completed the analysis. How can I help you further?";
    }

    let response = "Here's what I found:\n\n";
    
    for (const { tool, result } of toolResults) {
      response += `🔧 **${tool}**:\n`;
      if (result.success) {
        response += `${this.formatToolResult(result)}\n\n`;
      } else {
        response += `❌ Error: ${result.error}\n\n`;
      }
    }

    return response.trim();
  }

  private formatToolResult(result: ToolResult): string {
    if (!result.success) {
      return `❌ Error: ${result.error}`;
    }

    if (typeof result.data === 'string') {
      return result.data;
    }

    if (typeof result.data === 'object' && result.data !== null) {
      if (Array.isArray(result.data)) {
        // Format arrays nicely
        if (result.data.length === 0) {
          return "No items found.";
        }
        
        return result.data.slice(0, 20).map((item, index) => {
          if (typeof item === 'object') {
            // Handle file/directory listings
            if ('name' in item && 'type' in item) {
              const icon = item.type === 'directory' ? '📁' : '📄';
              return `${icon} ${item.name}`;
            }
            return `${index + 1}. ${JSON.stringify(item)}`;
          }
          return `${index + 1}. ${item}`;
        }).join('\n') + (result.data.length > 20 ? '\n... (showing first 20 items)' : '');
      }

      // Handle structured data
      return JSON.stringify(result.data, null, 2);
    }

    return String(result.data);
  }
}
