import { DynamicStructuredTool as Tool } from '@langchain/core/tools';

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

  async execute(toolName: string, params: Record<string, unknown>) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found`,
      };
    }

    try {
      return await tool.invoke(params);
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
