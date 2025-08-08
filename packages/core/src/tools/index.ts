// Export all tools
export * from './base-tool.js';
export * from './file-tools.js';
export * from './system-tools.js';

// Re-export the registry for convenience
export { toolRegistry } from './base-tool.js';

// Tool initialization function
import { toolRegistry } from './base-tool.js';
import { FileReadTool, FileWriteTool, FileEditTool, FileSearchTool } from './file-tools.js';
import { ShellExecTool, DirectoryListTool, CurrentDirectoryTool } from './system-tools.js';

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
}

// Auto-initialize tools when this module is imported
initializeTools();
