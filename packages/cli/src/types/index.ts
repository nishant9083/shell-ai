import { OllamaClient, MemoryManager, ConfigManager, MCPManager } from '@shell-ai/core';

export interface AgentChatProps {
  client: OllamaClient;
  memory: MemoryManager;
  configManager: ConfigManager;
  mcpManager: MCPManager;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

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
  // agentActions?: AgentAction[];
  display: boolean;
}

export interface AgentAction {
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
