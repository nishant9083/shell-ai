// Export all tools
export * from './file-tools.js';
export * from './system-tools.js';
export * from './grep-tool.js';
export * from './web-search.js';
export * from './memory-tools.js';
export * from './tool-registry.js';

// Tool initialization function
import { MemoryManager } from '../memory/memory-manager.js';

import { toolRegistry } from './tool-registry.js';
import { FileReadTool, FileWriteTool, FileEditTool, FileSearchTool } from './file-tools.js';
import { ShellExecTool, DirectoryListTool, CurrentDirectoryTool } from './system-tools.js';
import { SearchFileContentTool, GrepReplaceTool, FileGrepTool } from './grep-tool.js';
import { WebSearchTool, WikipediaSearchTool } from './web-search.js';
import { MemoryTool } from './memory-tools.js';

export function initializeTools(): void {
  // Register file tools
  toolRegistry.register(FileReadTool);
  toolRegistry.register(FileWriteTool);
  toolRegistry.register(FileEditTool);
  toolRegistry.register(FileSearchTool);

  // Register system tools
  toolRegistry.register(ShellExecTool);
  toolRegistry.register(DirectoryListTool);
  toolRegistry.register(CurrentDirectoryTool);

  // Register grep tools
  toolRegistry.register(SearchFileContentTool);
  toolRegistry.register(GrepReplaceTool);
  toolRegistry.register(FileGrepTool);

  // Register web search tools
  toolRegistry.register(WebSearchTool);
  toolRegistry.register(WikipediaSearchTool);

  // Register memory tools
  const memoryManager = new MemoryManager();
  const memoryTool = new MemoryTool(memoryManager);
  toolRegistry.register(memoryTool.MemoryAddTool);
  toolRegistry.register(memoryTool.MemoryRetrieveTool);
  toolRegistry.register(memoryTool.MemoryListTool);
  toolRegistry.register(memoryTool.MemoryDeleteTool);
}

// Auto-initialize tools when this module is imported
initializeTools();
