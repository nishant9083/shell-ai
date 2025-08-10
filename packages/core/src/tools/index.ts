// Export all tools
export * from './base-tool.js';
export * from './file-tools.js';
export * from './system-tools.js';
export * from './grep-tool.js';
export * from './web-search.js';
export * from './memory-tools.js';

// Re-export the registry for convenience
export { toolRegistry } from './base-tool.js';

// Tool initialization function
import { toolRegistry } from './base-tool.js';
import { FileReadTool, FileWriteTool, FileEditTool, FileSearchTool } from './file-tools.js';
import { ShellExecTool, DirectoryListTool, CurrentDirectoryTool } from './system-tools.js';
import { SearchFileContentTool, GrepReplaceTool, FileGrepTool } from './grep-tool.js';
import { WebSearchTool, WikipediaSearchTool } from './web-search.js';
import { MemoryAddTool, MemoryRetrieveTool, MemoryListTool, MemoryDeleteTool } from './memory-tools.js';
import { MemoryManager } from '../memory/memory-manager.js';

export function initializeTools(): void {
    // Register file tools
    toolRegistry.register(new FileReadTool());
    toolRegistry.register(new FileWriteTool());
    toolRegistry.register(new FileEditTool());
    toolRegistry.register(new FileSearchTool());

    // Register system tools
    toolRegistry.register(new ShellExecTool());
    toolRegistry.register(new DirectoryListTool());
    toolRegistry.register(new CurrentDirectoryTool());

    // Register grep tools
    toolRegistry.register(new SearchFileContentTool());
    toolRegistry.register(new GrepReplaceTool());
    toolRegistry.register(new FileGrepTool());
    
    // Register web search tools
    toolRegistry.register(new WebSearchTool());
    toolRegistry.register(new WikipediaSearchTool());
    
    // Register memory tools
    const memoryManager = new MemoryManager();
    toolRegistry.register(new MemoryAddTool(memoryManager));
    toolRegistry.register(new MemoryRetrieveTool(memoryManager));
    toolRegistry.register(new MemoryListTool(memoryManager));
    toolRegistry.register(new MemoryDeleteTool(memoryManager));
}

// Auto-initialize tools when this module is imported
initializeTools();
