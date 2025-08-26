import { stdout } from 'process';

import React from 'react';
import { render } from 'ink';
import {
  OllamaClient,
  MemoryManager,
  ConfigManager,
  toolRegistry,
  AgentCallbacks,
  MCPManager,
} from '@shell-ai/core';

import { AgentChatProps, ChatMessage, AgentAction } from '../types/index.js';
import { ChatApp } from '../ui/App.js';

import { LangGraphAgentAdapter } from './langgraph-agent-adapter.js';
import { AutocompleteManager, AutocompleteOption } from './autocomplete.js';

export class InteractiveChat {
  private client: OllamaClient;
  private memory: MemoryManager;
  private configManager: ConfigManager;
  private mcpManager: MCPManager;
  private agentProcessor: LangGraphAgentAdapter;
  private autocompleteManager: AutocompleteManager;
  private messages: ChatMessage[] = [];
  private systemPrompt?: string;

  constructor(props: AgentChatProps) {
    this.client = props.client;
    this.memory = props.memory;
    this.configManager = props.configManager;
    this.mcpManager = props.mcpManager;
    this.systemPrompt = props.systemPrompt;
    this.agentProcessor = new LangGraphAgentAdapter({
      client: this.client,
      memory: this.memory,
      configManager: this.configManager,
    });
    this.autocompleteManager = new AutocompleteManager();
  }

  async start(): Promise<void> {
    render(
      <ChatApp
        configManager={this.configManager}
        agentProcessor={this.agentProcessor}
        messages={this.messages}
        handleUserInput={this.handleUserInput}
        handleConfirmation={this.handleConfirmation}
        updateAutocomplete={this.updateAutocomplete}
        applyAutocomplete={this.applyAutocomplete}
      />
    );
  }

  private updateAutocomplete = async (
    input: string,
    setShowAutocomplete: React.Dispatch<React.SetStateAction<boolean>>,
    setAutocompleteOptions: React.Dispatch<React.SetStateAction<AutocompleteOption[]>>,
    setAutocompleteIndex: React.Dispatch<React.SetStateAction<number>>
  ): Promise<void> => {
    if (input.startsWith('/')) {
      const query = input.slice(1);
      const options = await this.autocompleteManager.getSlashCompletions(query);
      setAutocompleteOptions(options);
      setAutocompleteIndex(0);
    } else if (input.includes('@')) {
      const atIndex = input.lastIndexOf('@');
      const query = input.slice(atIndex + 1);
      const options = await this.autocompleteManager.getFileCompletions(query);
      setAutocompleteOptions(options);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
      setAutocompleteOptions([]);
      setAutocompleteIndex(0);
    }
  };

  private applyAutocomplete = (
    option: AutocompleteOption,
    inputRef: React.MutableRefObject<string>,
    setCurrentInput: React.Dispatch<React.SetStateAction<string>>
  ): void => {
    if (inputRef.current.startsWith('/')) {
      inputRef.current = `/${option.value}`;
    } else if (inputRef.current.includes('@')) {
      const atIndex = inputRef.current.lastIndexOf('@');
      inputRef.current = inputRef.current.slice(0, atIndex + 1) + option.value;
    }

    setCurrentInput(inputRef.current);
    // setShowAutocomplete(false);
    // setAutocompleteIndex(0);
  };

  private handleUserInput = async (
    input: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setAgentActions: React.Dispatch<React.SetStateAction<AgentAction | null>>,
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>,
    setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>,
    updateStaticKey: () => void,
    exit: () => void
  ): Promise<void> => {
    // Handle slash commands
    if (input.startsWith('/')) {
      await this.handleSlashCommand(input, setMessages, updateStaticKey, exit);
      return;
    }

    // Process file references (@) in the input
    const processedInput = await this.processFileReferences(input);

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: processedInput,
      timestamp: new Date(),
      display: true,
    };

    this.messages.push(userMessage);
    setMessages([...this.messages]);

    try {
      setIsProcessing(true);
      // Process with autonomous agent
      await this.agentProcessor.processUserInput(
        processedInput,
        this.createAgentCallbacks(
          setMessages,
          setAgentActions,
          setPendingConfirmation,
          setIsProcessing
        )
      );
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date(),
        display: true,
      };

      this.messages.push(errorMessage);
      setMessages([...this.messages]);
    } finally {
      setAgentActions(null);
      setIsProcessing(false);
    }
  };

  private processFileReferences = async (input: string): Promise<string> => {
    // Find all @file references in the input
    const fileReferenceRegex = /@([^\s]+)/g;
    let processedInput = input;
    const matches = Array.from(input.matchAll(fileReferenceRegex));

    for (const match of matches) {
      const filePath = match[1];
      try {
        // Read the file content and include it in the prompt
        const fs = await import('fs/promises');
        const path = await import('path');
        const fullPath = path.resolve(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Replace the @file reference with a descriptive prompt
        const fileContext = `\n\n[Content of file "${filePath}":]
\`\`\`
${content}
\`\`\`\n`;

        processedInput = processedInput.replace(match[0], `"${filePath}" file${fileContext}`);
      } catch (error) {
        // If file can't be read, just mention it was referenced
        processedInput = processedInput.replace(
          match[0],
          `"${filePath}" file (could not read: ${error instanceof Error ? error.message : 'unknown error'})`
        );
      }
    }

    return processedInput;
  };

  private handleConfirmation = async (
    approved: boolean,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    pendingConfirmation: { callback: (result: boolean) => void; content: string },
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>
  ): Promise<void> => {
    setPendingConfirmation(null);

    if (!approved) {
      const cancelMessage: ChatMessage = {
        role: 'tool',
        content: `❌ ${pendingConfirmation.content}`,
        timestamp: new Date(),
        display: true,
      };

      this.messages.push(cancelMessage);
      setMessages([...this.messages]);
    }
    pendingConfirmation.callback(approved);
  };

  private handleSlashCommand = async (
    input: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    updateStaticKey: () => void,
    exit: () => void
  ): Promise<void> => {
    const [command, ...args] = input.slice(1).split(' ');
    const config = this.configManager.getConfig();
    const responseMessage: ChatMessage = {
      role: 'system',
      content: '',
      timestamp: new Date(),
      display: true,
    };

    switch (command.toLowerCase()) {
      case 'quit':
      case 'exit':
        await this.mcpManager.shutdown();
        exit();
        return;

      case 'clear':
        this.messages = this.messages.map(msg => ({
          ...msg,
          display: false,
        }));
        setMessages([...this.messages]);
        console.clear();
        stdout.write('\x1Bc\x1B[?25l'); // Clear terminal and hide the default cursor
        updateStaticKey();
        return;

      case 'model':
        if (args.length > 0) {
          const isAvailable = await this.client.isModelAvailable(args[0]);
          if (isAvailable) {
            this.configManager.updateConfig({ currentModel: args[0] });
            responseMessage.content = `🔄 Switched to model: ${args[0]}`;
          } else {
            responseMessage.content = `❌ Model not available: ${args[0]}`;
          }
        } else {
          responseMessage.content = `📋 Current model: ${config.currentModel}`;
        }
        break;

      case 'help':
        responseMessage.content = this.getHelpText();
        break;

      case 'info':
        responseMessage.content = await this.getStatusInfo();
        break;

      case 'mcp':
        {
          const connections = this.mcpManager.getConnections();
          if (connections.length === 0) {
            responseMessage.content = `📡 No MCP servers configured. Check ~/.shell-ai/mcp.json`;
          } else {
            responseMessage.content = `📡 MCP Server Status:\n\n${connections
              .map(
                conn =>
                  `• ${conn.serverName}: ${conn.isConnected ? '✅ Connected' : '❌ Disconnected'} (${conn.tools.length} tools)`
              )
              .join('\n')}`;
          }
        }
        break;

      default:
        responseMessage.content = `❓ Unknown command: /${command}. Type /help for available commands.`;
    }

    this.messages.push(responseMessage);
    setMessages([...this.messages]);
  };

  private getHelpText = (): string => {
    return `🔧 Shell AI Agent Commands:

BASIC COMMANDS:
  /help          - Show this help message
  /quit, /exit   - Exit the chat
  /clear         - Clear conversation history
  /model [name]  - Switch AI model or show current model
  /status        - Show agent status and capabilities

AUTOCOMPLETE FEATURES:
  / + commands   - Type / to see available commands with descriptions
  @ + files      - Type @ to browse and reference files/folders
  ↑↓ arrows      - Navigate through autocomplete options
  Tab or Enter   - Select highlighted option
  Esc           - Cancel autocomplete

AUTONOMOUS FEATURES:
  • The agent automatically analyzes your requests
  • Uses appropriate tools without being asked
  • Asks for confirmation on potentially destructive actions
  • Provides context and explanations for its actions

EXAMPLE INTERACTIONS:
  "Show me the files in this directory"
  "What's in @package.json file?"
  "Create a new TypeScript file for user authentication"
  "Run the build command and tell me if there are any errors"
  "@src/components/ - what files are in this folder?"

The agent will automatically use tools like file operations, shell commands, and more based on your needs.
You can also reference specific files using @filename or @path/to/file.`;
  };

  private getStatusInfo = async (): Promise<string> => {
    const config = this.configManager.getConfig();
    const tools = toolRegistry.list();
    const memoryStats = this.memory.getMemoryStats();

    return `📊 Shell AI Agent Status:

🤖 MODEL: ${config.currentModel}
🔗 OLLAMA: ${config.ollamaUrl}
🧠 MEMORY: ${memoryStats.total} conversations stored
🔧 TOOLS: ${tools.length} available (${config.enabledTools.length} enabled)

ENABLED TOOLS:
${tools
  .filter(tool => config.enabledTools.includes(tool.name) || tool.name.startsWith('mcp-'))
  .map(tool => `  • ${tool.name}: ${tool.description}`)
  .join('\n')}
  `;
  };

  private createAgentCallbacks(
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setAgentActions: React.Dispatch<React.SetStateAction<AgentAction | null>>,
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>,
    setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
  ): AgentCallbacks {
    return {
      onThinking: (thought: string) => {
        setAgentActions({ type: 'thinking', content: thought });
      },
      onToolCall: (tool: string, params: Record<string, unknown>) => {
        setAgentActions({
          type: 'tool_call',
          content: `Using ${tool}...`,
          tool,
          parameters: params,
        });
      },
      onConfirmation: (content: string): Promise<boolean> => {
        return new Promise(resolve => {
          setPendingConfirmation({ content, callback: resolve });
        });
      },
      onResponse: message => {
        this.messages.push(message);
        setMessages([...this.messages]);
        // setAgentActions(null);
        // setIsProcessing(false);
      },
      onError: (error: string) => {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `❌ Error: ${error}`,
          timestamp: new Date(),
          display: true,
        };

        this.messages.push(errorMessage);
        setMessages([...this.messages]);
        setAgentActions(null);
        setIsProcessing(false);
      },
    };
  }
}
