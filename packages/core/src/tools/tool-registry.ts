import { DynamicStructuredTool as Tool } from '@langchain/core/tools';

// Tool registry for managing available tools
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
  registerMultiple(tools: Tool[]): void {
    tools.forEach(tool => this.register(tool));
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

  clear(): void {
    this.tools.clear();
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Export the registry instance
export const toolRegistry = new ToolRegistry();
