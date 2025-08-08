import React, { useState, useEffect, useRef } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import chalk from 'chalk';
import { 
  OllamaClient, 
  MemoryManager, 
  PluginManager, 
  ConfigManager,
  AIMessage,
  toolRegistry 
} from '@ai-cli/core';
import { CommandProcessor } from './command-processor.js';

interface InteractiveChatProps {
  client: OllamaClient;
  memory: MemoryManager;
  plugins: PluginManager;
  configManager: ConfigManager;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export class InteractiveChat {
  private client: OllamaClient;
  private memory: MemoryManager;
  private plugins: PluginManager;
  private configManager: ConfigManager;
  private commandProcessor: CommandProcessor;
  private messages: ChatMessage[] = [];
  private currentModel: string;
  private systemPrompt?: string;
  private temperature?: number;
  private maxTokens?: number;

  constructor(props: InteractiveChatProps) {
    this.client = props.client;
    this.memory = props.memory;
    this.plugins = props.plugins;
    this.configManager = props.configManager;
    this.currentModel = props.model || props.client.getConfig().defaultModel;
    this.systemPrompt = props.systemPrompt;
    this.temperature = props.temperature;
    this.maxTokens = props.maxTokens;

    this.commandProcessor = new CommandProcessor({
      client: this.client,
      memory: this.memory,
      plugins: this.plugins,
      configManager: this.configManager
    });

    // Add system prompt if provided
    if (this.systemPrompt) {
      this.messages.push({
        role: 'system',
        content: this.systemPrompt,
        timestamp: new Date()
      });
    }
  }

  async start(): Promise<void> {
    console.log(chalk.blue.bold('🤖 AI-CLI Interactive Chat'));
    console.log(chalk.gray(`Model: ${this.currentModel}`));
    console.log(chalk.gray('Type /help for commands, /quit to exit\n'));

    const ChatApp = () => {
      const [input, setInput] = useState('');
      const [messages, setMessages] = useState<ChatMessage[]>(this.messages);
      const [isProcessing, setIsProcessing] = useState(false);
      const [currentInput, setCurrentInput] = useState('');
      const inputRef = useRef<string>('');
      const { exit } = useApp();

      useInput((input, key) => {
        if (isProcessing) return;

        if (key.return) {
          if (inputRef.current.trim()) {
            this.handleUserInput(inputRef.current.trim(), setMessages, setIsProcessing, exit);
            inputRef.current = '';
            setCurrentInput('');
          }
        } else if (key.backspace || key.delete) {
          inputRef.current = inputRef.current.slice(0, -1);
          setCurrentInput(inputRef.current);
        } else if (input) {
          inputRef.current += input;
          setCurrentInput(inputRef.current);
        }
      });

      return (
        <Box flexDirection="column">
          {messages.map((msg, index) => (
            <Box key={index} marginBottom={1}>
              <Text color={msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'gray'}>
                {msg.role === 'user' ? '👤 You: ' : msg.role === 'assistant' ? '🤖 AI: ' : '⚙️  System: '}
              </Text>
              <Text>{msg.content}</Text>
            </Box>
          ))}
          
          {isProcessing && (
            <Box>
              <Text color="yellow">🤖 AI is thinking...</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text color="blue">👤 You: </Text>
            <Text>{currentInput}</Text>
            {!isProcessing && <Text color="gray">_</Text>}
          </Box>
        </Box>
      );
    };

    render(<ChatApp />);
  }

  private async handleUserInput(
    input: string, 
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>,
    exit: () => void
  ): Promise<void> {
    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    setMessages([...this.messages]);
    setIsProcessing(true);

    try {
      // Check if it's a slash command
      if (input.startsWith('/')) {
        await this.handleSlashCommand(input, setMessages, exit);
        return;
      }

      // Regular chat message
      const aiMessages: AIMessage[] = this.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      const response = await this.client.chat(aiMessages, {
        model: this.currentModel,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      this.messages.push(assistantMessage);
      setMessages([...this.messages]);

      // Save to memory
      this.memory.addConversation([userMessage, assistantMessage]);

    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date()
      };

      this.messages.push(errorMessage);
      setMessages([...this.messages]);
    } finally {
      setIsProcessing(false);
    }
  }

  private async handleSlashCommand(
    input: string, 
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    exit: () => void
  ): Promise<void> {
    const [command, ...args] = input.slice(1).split(' ');

    switch (command.toLowerCase()) {
      case 'quit':
      case 'exit':
        exit();
        return;

      case 'clear':
        this.messages = [];
        setMessages([]);
        return;

      case 'model':
        if (args.length > 0) {
          this.currentModel = args[0];
          const message: ChatMessage = {
            role: 'system',
            content: `Switched to model: ${this.currentModel}`,
            timestamp: new Date()
          };
          this.messages.push(message);
          setMessages([...this.messages]);
        } else {
          const message: ChatMessage = {
            role: 'system',
            content: `Current model: ${this.currentModel}`,
            timestamp: new Date()
          };
          this.messages.push(message);
          setMessages([...this.messages]);
        }
        return;

      case 'help':
        this.showHelp(setMessages);
        return;

      case 'tools':
        this.showTools(setMessages);
        return;

      case 'memory':
        this.showMemoryStats(setMessages);
        return;

      case 'plugins':
        this.showPlugins(setMessages);
        return;

      default:
        // Try to execute as a tool or plugin command
        try {
          await this.commandProcessor.executeSlashCommand(input, args);
          const message: ChatMessage = {
            role: 'system',
            content: `Command executed: ${input}`,
            timestamp: new Date()
          };
          this.messages.push(message);
          setMessages([...this.messages]);
        } catch (error) {
          const message: ChatMessage = {
            role: 'system',
            content: `Unknown command: ${command}. Type /help for available commands.`,
            timestamp: new Date()
          };
          this.messages.push(message);
          setMessages([...this.messages]);
        }
    }
  }

  private showHelp(setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>): void {
    const helpText = `
Available Commands:
  /help           - Show this help message
  /quit, /exit    - Exit the chat
  /clear          - Clear chat history
  /model [name]   - Show current model or switch to specified model
  /tools          - List available tools
  /memory         - Show memory statistics
  /plugins        - List installed plugins

Tool commands can be executed by typing their name with parameters.
Examples:
  /file-read path="./README.md"
  /shell-exec command="ls -la"
`;

    const message: ChatMessage = {
      role: 'system',
      content: helpText.trim(),
      timestamp: new Date()
    };

    this.messages.push(message);
    setMessages([...this.messages]);
  }

  private showTools(setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>): void {
    const tools = toolRegistry.list();
    const toolsList = tools.map(tool => `  • ${tool.name}: ${tool.description}`).join('\n');
    
    const message: ChatMessage = {
      role: 'system',
      content: `Available Tools:\n${toolsList}`,
      timestamp: new Date()
    };

    this.messages.push(message);
    setMessages([...this.messages]);
  }

  private showMemoryStats(setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>): void {
    const stats = this.memory.getMemoryStats();
    const statsText = `Memory Statistics:
  Total memories: ${stats.total}
  By type: ${JSON.stringify(stats.byType, null, 2)}
  ${stats.oldestMemory ? `Oldest: ${stats.oldestMemory.toISOString()}` : ''}
  ${stats.newestMemory ? `Newest: ${stats.newestMemory.toISOString()}` : ''}`;

    const message: ChatMessage = {
      role: 'system',
      content: statsText,
      timestamp: new Date()
    };

    this.messages.push(message);
    setMessages([...this.messages]);
  }

  private showPlugins(setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>): void {
    const plugins = this.plugins.listPlugins();
    const pluginsList = plugins.map(plugin => 
      `  • ${plugin.name} v${plugin.version}: ${plugin.description}`
    ).join('\n');
    
    const message: ChatMessage = {
      role: 'system',
      content: `Installed Plugins:\n${pluginsList || '  No plugins installed'}`,
      timestamp: new Date()
    };

    this.messages.push(message);
    setMessages([...this.messages]);
  }
}
