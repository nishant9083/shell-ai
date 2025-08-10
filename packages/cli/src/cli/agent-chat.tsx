import React, { useState, useRef } from 'react';
import { render, Text, Box, useInput, useApp, Spacer, Static } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import figures from 'figures';
import {
  OllamaClient,
  MemoryManager,
  PluginManager,
  ConfigManager,
  AIMessage,
  toolRegistry
} from '@ai-cli/core';
import { AgentProcessor } from './native-agent-processor.js';
import Autocomplete, { AutocompleteManager, AutocompleteOption } from './autocomplete.js';

interface AgentChatProps {
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
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCall?: {
    tool: string;
    parameters: Record<string, unknown>;
    result?: any;
  };
  agentActions?: AgentAction[];
}

interface AgentAction {
  type: 'thinking' | 'tool_call' | 'confirmation' | 'progress';
  content: string;
  tool?: string;
  parameters?: Record<string, unknown>;
  progress?: {
    current: number;
    total: number;
    phase?: string;
  };
}

export class EnhancedInteractiveChat {
  private client: OllamaClient;
  private memory: MemoryManager;
  private plugins: PluginManager;
  private configManager: ConfigManager;
  private agentProcessor: AgentProcessor;
  private autocompleteManager: AutocompleteManager;
  private messages: ChatMessage[] = [];
  private systemPrompt: string;

  constructor(props: AgentChatProps) {
    this.client = props.client;
    this.memory = props.memory;
    this.plugins = props.plugins;
    this.configManager = props.configManager;

    // Enhanced system prompt for autonomous behavior
    this.systemPrompt = props.systemPrompt || this.createAgentSystemPrompt();

    this.agentProcessor = new AgentProcessor({
      client: this.client,
      memory: this.memory,
      plugins: this.plugins,
      configManager: this.configManager
    });

    this.autocompleteManager = new AutocompleteManager();

    // Update model if specified
    if (props.model) {
      this.configManager.updateConfig({ currentModel: props.model });
    }

    // Add system prompt
    // this.messages.push({
    //   role: 'system',
    //   content: this.systemPrompt,
    //   timestamp: new Date()
    // });
  }

  private createAgentSystemPrompt(): string {
    const tools = toolRegistry.list();
    const config = this.configManager.getConfig();
    const enabledTools = tools.filter(tool => config.enabledTools.includes(tool.name));
    const toolsList = enabledTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n');

    return `You are AI-CLI, an advanced autonomous AI assistant with powerful capabilities. You can:

CORE CAPABILITIES:
- Analyze user requests and determine the best approach
- Use tools automatically when needed (file operations, shell commands, etc.)
- Make intelligent decisions about when to ask for confirmation
- Provide rich, detailed responses with context

AVAILABLE TOOLS:
${toolsList}

AUTONOMOUS BEHAVIOR GUIDELINES:
1. ANALYZE first: Always understand what the user wants to accomplish
2. PLAN your approach: Break down complex tasks into steps
3. USE TOOLS automatically: Don't ask permission for safe operations like reading files or listing directories
4. CONFIRM for potentially destructive operations: file modifications, deletions, system changes
5. EXPLAIN your actions: Let users know what you're doing and why
6. PROVIDE CONTEXT: Include relevant details and suggest next steps

TOOL USAGE RULES:
- Use file-read to examine files the user mentions
- Use directory-list to explore project structure when needed
- Use shell-exec for safe commands (with confirmation for potentially harmful ones)
- Always explain what tools you're using and why

Be proactive, intelligent, and helpful. Take initiative while being transparent about your actions.`;
  }

  async start(): Promise<void> {
    this.showWelcomeMessage();

    const ChatApp = () => {
      const [messages, setMessages] = useState<ChatMessage[]>(this.messages);
      // const [isProcessing, setIsProcessing] = useState(false);
      const [currentInput, setCurrentInput] = useState('');
      const [agentActions, setAgentActions] = useState<AgentAction | null>(null);
      const [pendingConfirmation, setPendingConfirmation] = useState<{
        action: any;
        content: string;
      } | null>(null);
      const [showAutocomplete, setShowAutocomplete] = useState(false);
      const [autocompleteIndex, setAutocompleteIndex] = useState(0);
      const [autocompleteOptions, setAutocompleteOptions] = useState<AutocompleteOption[]>([]);
      const inputRef = useRef<string>('');
      const { exit } = useApp();

      // console.log(showAutocomplete, 'triggering');

      useInput(async (input, key) => {
        if (pendingConfirmation) {
          if (key.return) {
            const isConfirmed = inputRef.current.toLowerCase().trim() === 'y' ||
              inputRef.current.toLowerCase().trim() === 'yes';
            this.handleConfirmation(isConfirmed, pendingConfirmation.action, setMessages, setPendingConfirmation, setAgentActions);
            inputRef.current = '';
            setCurrentInput('');
          } else if (key.backspace || key.delete) {
            inputRef.current = inputRef.current.slice(0, -1);
            setCurrentInput(inputRef.current);
          } else if (input) {
            inputRef.current += input;
            setCurrentInput(inputRef.current);
          }
          return;
        }

        if (agentActions) return;

        // Handle autocomplete navigation
        if (showAutocomplete && autocompleteOptions.length > 0) {
          if (key.upArrow) {
            setAutocompleteIndex(prev => prev > 0 ? prev - 1 : autocompleteOptions.length - 1);
            return;
          } else if (key.downArrow) {
            setAutocompleteIndex(prev => prev < autocompleteOptions.length - 1 ? prev + 1 : 0);
            return;
          } else if (key.tab || key.return) {
            if (key.return && !key.tab) {
              // Enter without tab - submit if no autocomplete or submit with completion
              const selectedOption = autocompleteOptions[autocompleteIndex];
              if (selectedOption) {
                this.applyAutocomplete(selectedOption, inputRef, setCurrentInput, setShowAutocomplete, setAutocompleteIndex);
                return;
              }
            } else if (key.tab) {
              // Tab - apply autocomplete
              const selectedOption = autocompleteOptions[autocompleteIndex];
              if (selectedOption) {
                this.applyAutocomplete(selectedOption, inputRef, setCurrentInput, setShowAutocomplete, setAutocompleteIndex);
                return;
              }
            }
          } else if (key.escape) {
            setShowAutocomplete(false);
            setAutocompleteIndex(0);
            return;
          }
        }

        if (key.return) {
          if (inputRef.current.trim()) {
            this.handleUserInput(
              inputRef.current.trim(),
              setMessages,              
              setAgentActions,
              setPendingConfirmation,
              exit
            );
            inputRef.current = '';
            setCurrentInput('');
            setShowAutocomplete(false);
            setAutocompleteIndex(0);
          }
        } else if (key.backspace || key.delete) {
          inputRef.current = inputRef.current.slice(0, -1);
          setCurrentInput(inputRef.current);
          await this.updateAutocomplete(inputRef.current, setShowAutocomplete, setAutocompleteOptions, setAutocompleteIndex);
        } else if (input) {
          inputRef.current += input;
          setCurrentInput(inputRef.current);
          if (!showAutocomplete && (inputRef.current.startsWith('/') || inputRef.current.includes('@'))) { setShowAutocomplete(true); }
          await this.updateAutocomplete(inputRef.current, setShowAutocomplete, setAutocompleteOptions, setAutocompleteIndex);
        }
      });

      const config = this.configManager.getConfig();

      return (
        <Box flexDirection="column" padding={1}>
          {/* Header */}
          {/* <Box marginBottom={1} borderStyle="round" borderColor="cyan" padding={1}>
            <Text color="cyan" bold>
              {figures.pointer} AI-CLI Agent {figures.arrowRight} {config.currentModel}
            </Text>
            <Spacer />
            <Text color="gray" dimColor>
              Type /help for commands
            </Text>
          </Box> */}

          {/* Messages */}
          {/* <Static></Static> */}
          <Box flexDirection="column" marginBottom={1}>
            <Static items={messages}>
              {(msg, index) => (
                <Box key={index} marginBottom={1}>
                  {this.renderMessage(msg)}
                  {this.renderProgressIndicator(msg)}
                </Box>
              )}
            </Static>            
          </Box>

          {/* Processing Indicator */}
          {agentActions && (
            <Box marginBottom={1}>
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
              <Text color="yellow" dimColor>{agentActions.content}</Text>
            </Box>
          )}

          {/* Confirmation Prompt */}
          {pendingConfirmation && (
            <Box marginBottom={1} borderStyle="round" borderColor="yellow" padding={1}>
              <Text color="yellow" bold>
                {figures.warning} Confirmation Required:
              </Text>
              <Text> {pendingConfirmation.content}</Text>
              <Text color="gray" dimColor>
                Continue? (y/n): {currentInput}
              </Text>
            </Box>
          )}

          {/* Input */}
          {!pendingConfirmation && (
            <Box borderStyle="round" borderColor="blue" padding={1}>
              <Text color="blue" bold>
                {figures.pointer}{" "}
              </Text>
              {currentInput ? <Text>{currentInput}</Text> : (<>
                <Text color="gray" bold>
                  Type "/" for commands or "@" for file references
                </Text>
                <Spacer />
                <Text color="gray" dimColor>
                  Type /help for commands
                </Text></>
              )}
              {/* {!isProcessing && <Text color="blue" dimColor>{figures.pointer}</Text>} */}
            </Box>
          )}

          {/* Autocomplete */}
          {showAutocomplete && (
            <Autocomplete
              input={currentInput}
              selectedIndex={autocompleteIndex}
              options={autocompleteOptions}            
            />
          )}
          

        </Box>
      );
    };

    render(<ChatApp />);
  }

  private renderMessage(msg: ChatMessage): JSX.Element {
    const getIcon = () => {
      switch (msg.role) {
        case 'user': return figures.pointer;
        case 'assistant': return figures.pointer;
        case 'tool': return figures.pointer;
        case 'system': return figures.info;
        default: return figures.bullet;
      }
    };

    const getColor = () => {
      switch (msg.role) {
        case 'user': return 'blue';
        case 'assistant': return 'green';
        case 'tool': return 'magenta';
        case 'system': return 'gray';
        default: return 'white';
      }
    };

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={getColor()} bold>
            {getIcon()} {msg.role === 'user' ? 'You' :
              msg.role === 'assistant' ? 'AI Agent' :
                msg.role === 'tool' ? 'Tool' : 'System'}:
          </Text>
        </Box>
        <Box paddingLeft={2}>
          <Text wrap="wrap">{msg.content}</Text>
        </Box>
        {msg.toolCall && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="cyan" dimColor>
              {figures.arrowRight} Used tool: {msg.toolCall.tool}
            </Text>
            {msg.toolCall.result && (
              <Text color={msg.toolCall.result.success ? 'green' : 'red'} dimColor>
                {figures.arrowRight} Result: {msg.toolCall.result.success ? 'Success' : 'Failed'}
              </Text>
            )}
          </Box>
        )}
      </Box>
    );
  }

  private renderAgentAction(action: AgentAction): JSX.Element {
    const getIcon = () => {
      switch (action.type) {
        case 'thinking': return figures.ellipsis;
        case 'tool_call': return figures.pointer;
        case 'confirmation': return figures.warning;
        case 'progress': return figures.arrowRight;
        default: return figures.bullet;
      }
    };

    const getColor = () => {
      switch (action.type) {
        case 'thinking': return 'yellow';
        case 'tool_call': return 'magenta';
        case 'confirmation': return 'yellow';
        case 'progress': return 'cyan';
        default: return 'white';
      }
    };

    if (action.type === 'progress' && action.progress) {
      const progress = action.progress;
      const percentage = Math.round((progress.current / progress.total) * 100);
      const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));

      return (
        <Box flexDirection="column">
          <Box>
            <Text color={getColor()} dimColor>
              {getIcon()} {action.content}
            </Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="cyan" dimColor>
              [{progressBar}] {percentage}% ({progress.current}/{progress.total})
            </Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box>
        <Text color={getColor()} dimColor>
          {getIcon()} {action.content}
        </Text>
      </Box>
    );
  }

  private renderProgressIndicator(message: ChatMessage): JSX.Element | null {
    if (!message.agentActions?.length) return null;

    const progressActions = message.agentActions.filter(action => action.type === 'progress');
    if (!progressActions.length) return null;

    const latestProgress = progressActions[progressActions.length - 1];
    if (!latestProgress.progress) return null;

    const { current, total, phase } = latestProgress.progress;
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.floor((percentage / 100) * barLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    return (
      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        <Box>
          <Text color="cyan" bold>
            {phase || 'Agent'} Progress:
          </Text>
        </Box>
        <Box>
          <Text color="cyan">
            [{progressBar}] {percentage}% ({current}/{total})
          </Text>
        </Box>
      </Box>
    );
  }

  private async updateAutocomplete(
    input: string,
    setShowAutocomplete: React.Dispatch<React.SetStateAction<boolean>>,
    setAutocompleteOptions: React.Dispatch<React.SetStateAction<AutocompleteOption[]>>,
    setAutocompleteIndex: React.Dispatch<React.SetStateAction<number>>
  ): Promise<void> {
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
  }

  private applyAutocomplete(
    option: AutocompleteOption,
    inputRef: React.MutableRefObject<string>,
    setCurrentInput: React.Dispatch<React.SetStateAction<string>>,
    setShowAutocomplete: React.Dispatch<React.SetStateAction<boolean>>,
    setAutocompleteIndex: React.Dispatch<React.SetStateAction<number>>
  ): void {
    if (inputRef.current.startsWith('/')) {
      inputRef.current = `/${option.value} `;
    } else if (inputRef.current.includes('@')) {
      const atIndex = inputRef.current.lastIndexOf('@');
      inputRef.current = inputRef.current.slice(0, atIndex + 1) + option.value + ' ';
    }

    setCurrentInput(inputRef.current);
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }

  private showWelcomeMessage(): void {
    const config = this.configManager.getConfig();
    console.clear();
    console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────────────────────────────────────────┐
│                     🤖 AI-CLI Agent                                        │
│                                                                             │
│  ${chalk.green('●')} Autonomous AI Assistant with Tool Capabilities         │
│  ${chalk.green('●')} Smart Decision Making & Context Awareness              │
│  ${chalk.green('●')} File Operations, Shell Commands & More                 │
│  ${chalk.green('●')} Interactive Autocomplete (/ for commands, @ for files) │
│                                                                             │
│  ${chalk.gray('Model:')} ${config.currentModel.padEnd(47)}                  │
│  ${chalk.gray('Mode:')} ${'Autonomous Agent'.padEnd(48)}                    │
└─────────────────────────────────────────────────────────────────────────────┘
`));
    console.log(chalk.gray('Type "/" for commands or "@" for file references. The AI agent will automatically use tools when needed.\n'));
  }

  private async handleUserInput(
    input: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,    
    setAgentActions: React.Dispatch<React.SetStateAction<AgentAction|null>>,
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>,
    exit: () => void
  ): Promise<void> {
    // Handle slash commands
    if (input.startsWith('/')) {
      await this.handleSlashCommand(input, setMessages, exit);
      return;
    }

    // Process file references (@) in the input
    const processedInput = await this.processFileReferences(input);

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: processedInput,
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    setMessages([...this.messages]);

    try {
      // Process with autonomous agent
      await this.agentProcessor.processUserInput(
        userMessage,
        this.messages,
        this.createAgentCallbacks(
          setMessages,          
          setAgentActions,
          setPendingConfirmation,          
        )
      );

    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date()
      };

      this.messages.push(errorMessage);
      setMessages([...this.messages]);      
      setAgentActions(null);
    }
  }

  private async processFileReferences(input: string): Promise<string> {
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
        processedInput = processedInput.replace(match[0], `"${filePath}" file (could not read: ${error instanceof Error ? error.message : 'unknown error'})`);
      }
    }

    return processedInput;
  }

  private async handleConfirmation(
    approved: boolean,
    action: any,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,    
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>,
    setAgentActions: React.Dispatch<React.SetStateAction<AgentAction|null>>
  ): Promise<void> {
    setPendingConfirmation(null);

    if (approved) {      
      // Continue with the action
      await this.agentProcessor.executeConfirmedAction(
        action,
        this.createAgentCallbacks(
          setMessages,          
          setAgentActions,
          setPendingConfirmation,          
        )
      );
    } else {
      const cancelMessage: ChatMessage = {
        role: 'assistant',
        content: '✋ Action cancelled. How else can I help you?',
        timestamp: new Date()
      };

      this.messages.push(cancelMessage);
      setMessages([...this.messages]);
    }
  }

  private async handleSlashCommand(
    input: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    exit: () => void
  ): Promise<void> {
    const [command, ...args] = input.slice(1).split(' ');
    const config = this.configManager.getConfig();
    const responseMessage: ChatMessage = {
      role: 'system',
      content: '',
      timestamp: new Date()
    };

    switch (command.toLowerCase()) {
      case 'quit':
      case 'exit':
        exit();
        return;

      case 'clear':
        this.messages = this.messages.filter(msg => msg.role === 'system' && msg.content === this.systemPrompt);
        setMessages([...this.messages]);
        return;

      case 'model':
        if (args.length > 0) {
          this.configManager.updateConfig({ currentModel: args[0] });
          responseMessage.content = `🔄 Switched to model: ${args[0]}`;
        } else {
          responseMessage.content = `📋 Current model: ${config.currentModel}`;
        }
        break;

      case 'help':
        responseMessage.content = this.getHelpText();
        break;

      case 'status':
        responseMessage.content = await this.getStatusInfo();
        break;

      default:
        responseMessage.content = `❓ Unknown command: /${command}. Type /help for available commands.`;
    }

    this.messages.push(responseMessage);
    setMessages([...this.messages]);
  }

  private getHelpText(): string {
    return `🔧 AI-CLI Agent Commands:

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
  }

  private async getStatusInfo(): Promise<string> {
    const config = this.configManager.getConfig();
    const tools = toolRegistry.list();
    const plugins = this.plugins.listPlugins();
    const memoryStats = this.memory.getMemoryStats();

    return `📊 AI-CLI Agent Status:

🤖 MODEL: ${config.currentModel}
🔗 OLLAMA: ${config.ollamaUrl}
🧠 MEMORY: ${memoryStats.total} conversations stored
🔧 TOOLS: ${tools.length} available (${config.enabledTools.length} enabled)
🔌 PLUGINS: ${plugins.length} installed

ENABLED TOOLS:
${tools.filter(tool => config.enabledTools.includes(tool.name))
        .map(tool => `  • ${tool.name}: ${tool.description}`)
        .join('\n')}
  `;
  }


  private createAgentCallbacks(
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,    
    setAgentActions: React.Dispatch<React.SetStateAction<AgentAction|null>>,
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>,    
  ) {
    return {
      onThinking: (thought: string) => {
        setAgentActions({ type: 'thinking', content: thought });
      },
      onToolCall: (tool: string, params: Record<string, unknown>) => {
        setAgentActions({
            type: 'tool_call',
            content: `Using ${tool}...`,
            tool,
            parameters: params
          });
      },
      onConfirmation: (action: any) => {
        setPendingConfirmation({ action, content: action.content });        
      },
      onResponse: (response: string) => {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date()
        };

        this.messages.push(assistantMessage);
        setMessages([...this.messages]);            
        setAgentActions(null);
      },
      onError: (error: string) => {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `❌ Error: ${error}`,
          timestamp: new Date()
        };

        this.messages.push(errorMessage);
        setMessages([...this.messages]);        
        setAgentActions(null);
      }
    };
  }
}
