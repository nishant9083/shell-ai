// Common types used throughout Shell AI
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCall?: {
    tool: string;
    status: boolean;
    parameters?: Record<string, unknown>;
    result?: any;
  };
  display: boolean;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
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

export interface AgentCallbacks {
  onThinking: (thought: string) => void;
  onToolCall: (tool: string, params: Record<string, unknown>) => void;
  onConfirmation: (content: string) => Promise<boolean>;
  onResponse: (message: ChatMessage) => void;
  onError: (error: string) => void;
}

export interface MCPAuthConfig {
  type: 'bearer' | 'basic' | 'api_key' | 'oauth2' | 'custom';
  // For Bearer token authentication
  token?: string;
  // For Basic authentication
  username?: string;
  password?: string;
  // For API Key authentication
  apiKey?: string;
  apiKeyHeader?: string; // Default: 'X-API-Key'
  // For OAuth2 (simplified)
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scope?: string;
  // For custom headers
  customHeaders?: Record<string, string>;
}

export interface MCPServerConfig {
  name: string;
  command?: {
    program: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
  };
  http?: {
    url: string;
    headers?: Record<string, string>;
    auth?: MCPAuthConfig;
  };
  sse?: {
    url: string;
    headers?: Record<string, string>;
    auth?: MCPAuthConfig;
  };
  includeTools?: string[];
  excludeTools?: string[];
  enabled: boolean;
  timeout?: number;
  retryAttempts?: number;
  description?: string;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
  globalTimeout: number;
  maxConcurrentConnections: number;
  enableAutoReconnect: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  serverName: string;
}

export interface MCPConnection {
  serverName: string;
  client: any;
  tools: MCPTool[];
  isConnected: boolean;
  lastError?: string;
}
