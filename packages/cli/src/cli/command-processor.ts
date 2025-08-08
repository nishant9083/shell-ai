import {
  OllamaClient,
  MemoryManager,
  PluginManager,
  ConfigManager,
  AIMessage,
  toolRegistry,
  SlashCommand,
  CommandContext
} from '@ai-cli/core';

interface CommandProcessorProps {
  client: OllamaClient;
  memory?: MemoryManager;
  plugins: PluginManager;
  configManager: ConfigManager;
}

export class CommandProcessor {
  private client: OllamaClient;
  private memory?: MemoryManager;
  private plugins: PluginManager;
  private configManager: ConfigManager;
  private slashCommands: Map<string, SlashCommand>;

  constructor(props: CommandProcessorProps) {
    this.client = props.client;
    this.memory = props.memory;
    this.plugins = props.plugins;
    this.configManager = props.configManager;
    this.slashCommands = new Map();

    this.initializeSlashCommands();
  }

  private initializeSlashCommands(): void {
    // Built-in slash commands
    const builtinCommands: SlashCommand[] = [
      {
        name: 'help',
        description: 'Show available commands and usage information',
        execute: async (args: string[], context: CommandContext) => {
          context.output(this.getHelpText());
        }
      },
      {
        name: 'tools',
        description: 'List all available tools',
        execute: async (args: string[], context: CommandContext) => {
          const tools = toolRegistry.list();
          const toolsList = tools.map(tool => `  • ${tool.name}: ${tool.description}`).join('\n');
          context.output(`Available Tools:\n${toolsList}`);
        }
      },
      {
        name: 'models',
        description: 'List available models',
        execute: async (args: string[], context: CommandContext) => {
          try {
            const models = await this.client.listModels();
            const modelsList = models.map(model => 
              `  • ${model.name} (${model.size}, ${model.modified_at})`
            ).join('\n');
            context.output(`Available Models:\n${modelsList}`);
          } catch (error) {
            context.error(`Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      },
      {
        name: 'config',
        description: 'Show current configuration',
        execute: async (args: string[], context: CommandContext) => {
          const config = this.configManager.getConfig();
          context.output(`Current Configuration:\n${JSON.stringify(config, null, 2)}`);
        }
      },
      {
        name: 'memory-stats',
        description: 'Show memory statistics',
        execute: async (args: string[], context: CommandContext) => {
          if (!this.memory) {
            context.error('Memory is not enabled');
            return;
          }
          const stats = this.memory.getMemoryStats();
          context.output(`Memory Statistics:
Total memories: ${stats.total}
By type: ${JSON.stringify(stats.byType, null, 2)}
${stats.oldestMemory ? `Oldest: ${stats.oldestMemory.toISOString()}` : ''}
${stats.newestMemory ? `Newest: ${stats.newestMemory.toISOString()}` : ''}`);
        }
      },
      {
        name: 'plugins',
        description: 'List installed plugins',
        execute: async (args: string[], context: CommandContext) => {
          const plugins = this.plugins.listPlugins();
          const pluginsList = plugins.map(plugin => 
            `  • ${plugin.name} v${plugin.version}: ${plugin.description}`
          ).join('\n');
          context.output(`Installed Plugins:\n${pluginsList || '  No plugins installed'}`);
        }
      }
    ];

    // Register built-in commands
    builtinCommands.forEach(command => {
      this.slashCommands.set(command.name, command);
      if (command.aliases) {
        command.aliases.forEach(alias => {
          this.slashCommands.set(alias, command);
        });
      }
    });

    // Register plugin commands
    const pluginCommands = this.plugins.getPluginCommands();
    pluginCommands.forEach(command => {
      this.slashCommands.set(command.name, command);
      if (command.aliases) {
        command.aliases.forEach(alias => {
          this.slashCommands.set(alias, command);
        });
      }
    });
  }

  async processQuestion(
    question: string,
    options?: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void> {
    try {
      const messages: AIMessage[] = [];

      // Add system prompt if provided
      if (options?.systemPrompt) {
        messages.push({
          role: 'system',
          content: options.systemPrompt,
          timestamp: new Date()
        });
      }

      // Add recent memory if available
      if (this.memory) {
        const recentMemories = this.memory.getRecentMemories(5);
        if (recentMemories.length > 0) {
          const memoryContext = recentMemories
            .map(memory => `[${memory.type}] ${memory.content.substring(0, 200)}...`)
            .join('\n');
          
          messages.push({
            role: 'system',
            content: `Recent context:\n${memoryContext}`,
            timestamp: new Date()
          });
        }
      }

      // Add user question
      messages.push({
        role: 'user',
        content: question,
        timestamp: new Date()
      });

      // Get AI response
      const response = await this.client.chat(messages, {
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens
      });

      console.log(response);

      // Save to memory if available
      if (this.memory) {
        this.memory.addConversation([
          { role: 'user', content: question, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date() }
        ]);
      }

    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  async executeSlashCommand(command: string, args: string[]): Promise<void> {
    const commandName = command.startsWith('/') ? command.slice(1) : command;
    const slashCommand = this.slashCommands.get(commandName);

    if (!slashCommand) {
      // Try to execute as a tool
      if (toolRegistry.has(commandName)) {
        await this.executeTool(commandName, args);
        return;
      }

      throw new Error(`Unknown command: ${commandName}`);
    }

    const context: CommandContext = {
      config: this.configManager.getConfig(),
      session: {
        id: 'cli-session',
        messages: [],
        model: this.configManager.getConfig().defaultModel,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      output: (message: string) => console.log(message),
      error: (message: string) => console.error(message)
    };

    await slashCommand.execute(args, context);
  }

  private async executeTool(toolName: string, args: string[]): Promise<void> {
    try {
      // Parse tool arguments (simple key=value format for now)
      const params: Record<string, unknown> = {};
      args.forEach(arg => {
        const [key, ...valueParts] = arg.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          // Try to parse as JSON, fallback to string
          try {
            params[key] = JSON.parse(value);
          } catch {
            params[key] = value;
          }
        }
      });

      const result = await toolRegistry.execute(toolName, params);
      
      if (result.success) {
        console.log('Tool executed successfully:');
        console.log(JSON.stringify(result.data, null, 2));
        
        // Save to memory if available
        if (this.memory) {
          this.memory.addCommand(
            `${toolName} ${args.join(' ')}`,
            JSON.stringify(result.data, null, 2),
            true
          );
        }
      } else {
        console.error('Tool execution failed:');
        console.error(result.error);
        
        // Save to memory if available
        if (this.memory) {
          this.memory.addCommand(
            `${toolName} ${args.join(' ')}`,
            result.error || 'Unknown error',
            false
          );
        }
      }
    } catch (error) {
      console.error(`Failed to execute tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getHelpText(): string {
    const commands = Array.from(this.slashCommands.values())
      .filter((command, index, self) => 
        // Remove duplicates (from aliases)
        self.findIndex(c => c.name === command.name) === index
      )
      .map(command => `  /${command.name} - ${command.description}`)
      .join('\n');

    const tools = toolRegistry.list()
      .map(tool => `  /${tool.name} - ${tool.description}`)
      .join('\n');

    return `AI-CLI Help

Slash Commands:
${commands}

Tools (can be called as commands):
${tools}

Usage Examples:
  /help
  /models
  /file-read path="./README.md"
  /shell-exec command="ls -la"
  
In interactive mode, you can also just type regular messages to chat with the AI.`;
  }
}
