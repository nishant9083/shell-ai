import { Tool, ToolResult } from '../types/index.js';

// Base tool class
export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, unknown>;

  abstract execute(params: Record<string, unknown>): Promise<ToolResult>;

  protected createResult(success: boolean, data?: unknown, error?: string, metadata?: Record<string, unknown>): ToolResult {
    const result: ToolResult = { success };
    if (data !== undefined) result.data = data;
    if (error !== undefined) result.error = error;
    if (metadata !== undefined) result.metadata = metadata;
    return result;
  }
}

// Tool registry for managing available tools
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(toolName: string): void {
    this.tools.delete(toolName);
  }

  get(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found`
      };
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  clear(): void {
    this.tools.clear();
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Export the registry instance
export const toolRegistry = new ToolRegistry();
