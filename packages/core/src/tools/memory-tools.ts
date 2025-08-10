import { v4 as uuidv4 } from 'uuid';
import { BaseTool } from './base-tool.js';
import { ToolResult, MemoryItem } from '../types/index.js';
import { MemoryManager } from '../memory/memory-manager.js';

/**
 * Tool for adding items to the AI's memory
 */
export class MemoryAddTool extends BaseTool {
  name = 'memory-add';
  description = 'Add an item to the AI\'s long-term memory';
  private memoryManager: MemoryManager;

  parameters = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content to remember'
      },
      type: {
        type: 'string',
        enum: ['conversation', 'file', 'context', 'command'],
        description: 'The type of memory item',
        default: 'context'
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata for the memory item'
      }
    },
    required: ['content']
  };

  constructor(memoryManager: MemoryManager) {
    super();
    this.memoryManager = memoryManager;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { content, type = 'context', metadata = {} } = params;

    if (typeof content !== 'string' || content.trim() === '') {
      return this.createResult(false, undefined, 'Content parameter must be a non-empty string');
    }

    try {
      const memoryItem: MemoryItem = {
        id: uuidv4(),
        type: type as 'conversation' | 'file' | 'context' | 'command',
        content: content as string,
        timestamp: new Date(),
        metadata: metadata as Record<string, unknown>,
      };

      await this.memoryManager.addMemory(memoryItem);

      return this.createResult(true, {
        id: memoryItem.id,
        message: 'Memory item added successfully'
      });
    } catch (error) {
      return this.createResult(
        false,
        undefined,
        `Failed to add memory item: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Tool for retrieving items from the AI's memory
 */
export class MemoryRetrieveTool extends BaseTool {
  name = 'memory-retrieve';
  description = 'Retrieve items from the AI\'s long-term memory';
  private memoryManager: MemoryManager;

  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for memory retrieval'
      },
      type: {
        type: 'string',
        enum: ['conversation', 'file', 'context', 'command', 'all'],
        description: 'Filter by memory item type',
        default: 'all'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 5
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Whether to include metadata in the results',
        default: true
      }
    },
    required: ['query']
  };

  constructor(memoryManager: MemoryManager) {
    super();
    this.memoryManager = memoryManager;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { 
      query, 
      type = 'all', 
      limit = 5,
      includeMetadata = true 
    } = params;

    if (typeof query !== 'string') {
      return this.createResult(false, undefined, 'Query parameter must be a string');
    }

    try {
      const memories = await this.memoryManager.searchMemories(query as string, {
        type: type === 'all' ? undefined : type as 'conversation' | 'file' | 'context' | 'command',
        limit: limit as number
      });

      // Format results
      const formattedMemories = memories.map(memory => {
        const result: Record<string, unknown> = {
          id: memory.id,
          type: memory.type,
          content: memory.content,
          timestamp: memory.timestamp
        };

        if (includeMetadata && memory.metadata) {
          result.metadata = memory.metadata;
        }

        return result;
      });

      return this.createResult(true, {
        results: formattedMemories,
        count: formattedMemories.length,
        query: query
      });
    } catch (error) {
      return this.createResult(
        false,
        undefined,
        `Failed to retrieve memory items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Tool for listing all items in the AI's memory
 */
export class MemoryListTool extends BaseTool {
  name = 'memory-list';
  description = 'List all items in the AI\'s long-term memory';
  private memoryManager: MemoryManager;

  parameters = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['conversation', 'file', 'context', 'command', 'all'],
        description: 'Filter by memory item type',
        default: 'all'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 20
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Whether to include metadata in the results',
        default: true
      },
      sortBy: {
        type: 'string',
        enum: ['timestamp', 'relevance'],
        description: 'How to sort the results',
        default: 'timestamp'
      },
      sortDirection: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort direction (ascending or descending)',
        default: 'desc'
      }
    }
  };

  constructor(memoryManager: MemoryManager) {
    super();
    this.memoryManager = memoryManager;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { 
      type = 'all', 
      limit = 20,
      includeMetadata = true,
      sortBy = 'timestamp',
      sortDirection = 'desc' 
    } = params;

    try {
      let memories = await this.memoryManager.getAllMemories();
      
      // Apply type filter
      if (type !== 'all') {
        memories = memories.filter(memory => memory.type === type);
      }
      
      // Apply sorting
      memories = memories.sort((a, b) => {
        if (sortBy === 'timestamp') {
          const comparison = a.timestamp.getTime() - b.timestamp.getTime();
          return sortDirection === 'asc' ? comparison : -comparison;
        } else if (sortBy === 'relevance' && a.relevanceScore !== undefined && b.relevanceScore !== undefined) {
          const comparison = (a.relevanceScore || 0) - (b.relevanceScore || 0);
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
      
      // Apply limit
      memories = memories.slice(0, limit as number);

      // Format results
      const formattedMemories = memories.map(memory => {
        const result: Record<string, unknown> = {
          id: memory.id,
          type: memory.type,
          content: memory.content,
          timestamp: memory.timestamp
        };

        if (includeMetadata && memory.metadata) {
          result.metadata = memory.metadata;
        }

        return result;
      });

      return this.createResult(true, {
        results: formattedMemories,
        count: formattedMemories.length,
        totalCount: memories.length
      });
    } catch (error) {
      return this.createResult(
        false,
        undefined,
        `Failed to list memory items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Tool for deleting items from the AI's memory
 */
export class MemoryDeleteTool extends BaseTool {
  name = 'memory-delete';
  description = 'Delete items from the AI\'s long-term memory';
  private memoryManager: MemoryManager;

  parameters = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the memory item to delete'
      },
      clearAll: {
        type: 'boolean',
        description: 'Whether to clear all memories (use with caution)',
        default: false
      },
      type: {
        type: 'string',
        enum: ['conversation', 'file', 'context', 'command'],
        description: 'Delete all memories of a specific type'
      }
    },
    oneOf: [
      { required: ['id'] },
      { required: ['clearAll'] },
      { required: ['type'] }
    ]
  };

  constructor(memoryManager: MemoryManager) {
    super();
    this.memoryManager = memoryManager;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { id, clearAll = false, type } = params;

    try {
      if (id) {
        if (typeof id !== 'string') {
          return this.createResult(false, undefined, 'ID parameter must be a string');
        }
        
        await this.memoryManager.deleteMemory(id as string);
        return this.createResult(true, {
          message: `Memory item with ID ${id} deleted successfully`
        });
      } else if (clearAll) {
        await this.memoryManager.clearMemories();
        return this.createResult(true, {
          message: 'All memory items cleared successfully'
        });
      } else if (type) {
        if (typeof type !== 'string' || !['conversation', 'file', 'context', 'command'].includes(type as string)) {
          return this.createResult(false, undefined, 'Type parameter must be a valid memory type');
        }
        
        const deletedCount = await this.memoryManager.deleteMemoriesByType(type as 'conversation' | 'file' | 'context' | 'command');
        return this.createResult(true, {
          message: `${deletedCount} memory items of type ${type} deleted successfully`
        });
      } else {
        return this.createResult(false, undefined, 'Either id, clearAll, or type parameter must be provided');
      }
    } catch (error) {
      return this.createResult(
        false,
        undefined,
        `Failed to delete memory item(s): ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
