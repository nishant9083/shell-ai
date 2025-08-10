// Common types used throughout AI-CLI
export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: Date;
  toolCall?: {
    tool: string;
    parameters: Record<string, unknown>;
    result?: ToolResult;
  };
  thinking?: boolean;
  streaming?: boolean;
}

export interface ChatSession {
  id: string;
  messages: AIMessage[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIModel {
  name: string;
  size: string;
  parameter_size: string;
  quantization_level: string;
  modified_at: string;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  tools?: Tool[];
  commands?: SlashCommand[];
  initialize?: () => Promise<void>;
  cleanup?: () => Promise<void>;
}

export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  parameters?: Record<string, unknown>;
  execute: (args: string[], context: CommandContext) => Promise<void>;
}

export interface CommandContext {
  config: AppConfig;
  session: ChatSession;
  output: (message: string) => void;
  error: (message: string) => void;
}

export interface AppConfig {
  ollamaUrl: string;
  defaultModel: string;
  currentModel: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  workingDirectory: string;
  enabledTools: string[];
  plugins: string[];
  memory: {
    maxMessages: number;
    persistToFile: boolean;
    filePath?: string;
  };
}

export interface FileOperation {
  type: 'read' | 'write' | 'edit' | 'delete' | 'search';
  path: string;
  content?: string;
  searchPattern?: string;
  lineNumbers?: { start: number; end?: number };
}

export interface ShellCommand {
  command: string;
  args: string[];
  workingDirectory?: string;
  timeout?: number;
}

export interface MemoryItem {
  id: string;
  type: 'conversation' | 'file' | 'context' | 'command';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  relevanceScore?: number;
}
