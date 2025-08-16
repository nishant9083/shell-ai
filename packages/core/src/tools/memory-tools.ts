import { v4 as uuidv4 } from 'uuid';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { MemoryItem } from '../types/index.js';
import { MemoryManager } from '../memory/memory-manager.js';
/**
 * Tool for adding items to the AI's memory
 */
export class MemoryTool {
  private memoryManager: MemoryManager;

  constructor(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager;
  }

  MemoryAddTool = new DynamicStructuredTool({
    name: 'memory-add',
    description: "Add an item to the AI's long-term memory",
    schema: z.object({
      content: z.string().min(1).describe('The content to remember'),
      type: z.enum(['conversation', 'file', 'context', 'command']).default('context'),
      metadata: z.object({}).optional().describe('Additional metadata for the memory item'),
    }),
    func: async (params: Record<string, unknown>) => {
      const { content, type = 'context', metadata = {} } = params;

      if (typeof content !== 'string' || content.trim() === '') {
        return {
          success: false,
          data: undefined,
          error: 'Content parameter must be a non-empty string',
        };
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

        return {
          success: true,
          data: {
            id: memoryItem.id,
            message: 'Memory item added successfully',
          },
        };
      } catch (error) {
        return {
          success: false,
          data: undefined,
          error: `Failed to add memory item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });

  /**
   * Tool for retrieving items from the AI's memory
   */
  MemoryRetrieveTool = new DynamicStructuredTool({
    name: 'memory-retrieve',
    description: "Retrieve items from the AI's long-term memory",

    schema: z.object({
      query: z.string().min(1).describe('Search query for memory retrieval'),
      type: z
        .enum(['conversation', 'file', 'context', 'command', 'all'])
        .default('all')
        .describe('Filter by memory item type'),
      limit: z.number().int().min(1).default(5).describe('Maximum number of results to return'),
      includeMetadata: z
        .boolean()
        .default(true)
        .describe('Whether to include metadata in the results'),
    }),

    func: async (params: Record<string, unknown>) => {
      const { query, type = 'all', limit = 5, includeMetadata = true } = params;

      if (typeof query !== 'string') {
        return { success: false, data: undefined, error: 'Query parameter must be a string' };
      }

      try {
        const memories = await this.memoryManager.searchMemories(query as string, {
          type:
            type === 'all' ? undefined : (type as 'conversation' | 'file' | 'context' | 'command'),
          limit: limit as number,
        });

        // Format results
        const formattedMemories = memories.map(memory => {
          const result: Record<string, unknown> = {
            id: memory.id,
            type: memory.type,
            content: memory.content,
            timestamp: memory.timestamp,
          };

          if (includeMetadata && memory.metadata) {
            result.metadata = memory.metadata;
          }

          return result;
        });

        return {
          success: true,
          data: {
            results: formattedMemories,
            count: formattedMemories.length,
            query: query,
          },
        };
      } catch (error) {
        return {
          success: false,
          data: undefined,
          error: `Failed to retrieve memory items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });

  /**
   * Tool for listing all items in the AI's memory
   */
  MemoryListTool = new DynamicStructuredTool({
    name: 'memory-list',
    description: "List all items in the AI's long-term memory",

    schema: z.object({
      type: z.enum(['conversation', 'file', 'context', 'command', 'all']).default('all'),
      limit: z.number().min(1).default(20),
      includeMetadata: z.boolean().default(true),
      sortBy: z.enum(['timestamp', 'relevance']).default('timestamp'),
      sortDirection: z.enum(['asc', 'desc']).default('desc'),
    }),

    func: async (params: Record<string, unknown>) => {
      const {
        type = 'all',
        limit = 20,
        includeMetadata = true,
        sortBy = 'timestamp',
        sortDirection = 'desc',
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
          } else if (
            sortBy === 'relevance' &&
            a.relevanceScore !== undefined &&
            b.relevanceScore !== undefined
          ) {
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
            timestamp: memory.timestamp,
          };

          if (includeMetadata && memory.metadata) {
            result.metadata = memory.metadata;
          }

          return result;
        });

        return {
          success: true,
          data: {
            results: formattedMemories,
            count: formattedMemories.length,
            totalCount: memories.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          data: undefined,
          error: `Failed to list memory items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });

  /**
   * Tool for deleting items from the AI's memory
   */
  MemoryDeleteTool = new DynamicStructuredTool({
    name: 'memory-delete',
    description: "Delete items from the AI's long-term memory",

    schema: z.object({
      id: z.string().describe('ID of the memory item to delete'),
      clearAll: z
        .boolean()
        .describe('Whether to clear all memories (use with caution)')
        .default(false),
      type: z
        .enum(['conversation', 'file', 'context', 'command'])
        .describe('Type of memory items to delete'),
    }),

    func: async (params: Record<string, unknown>) => {
      const { id, clearAll = false, type } = params;

      try {
        if (id) {
          if (typeof id !== 'string') {
            return { success: false, data: undefined, error: 'ID parameter must be a string' };
          }

          await this.memoryManager.deleteMemory(id as string);
          return {
            success: true,
            data: {
              message: `Memory item with ID ${id} deleted successfully`,
            },
          };
        } else if (clearAll) {
          await this.memoryManager.clearMemories();
          return {
            success: true,
            data: {
              message: 'All memory items cleared successfully',
            },
          };
        } else if (type) {
          if (
            typeof type !== 'string' ||
            !['conversation', 'file', 'context', 'command'].includes(type as string)
          ) {
            return {
              success: false,
              data: undefined,
              error: 'Type parameter must be a valid memory type',
            };
          }

          const deletedCount = await this.memoryManager.deleteMemoriesByType(
            type as 'conversation' | 'file' | 'context' | 'command'
          );
          return {
            success: true,
            data: {
              message: `${deletedCount} memory items of type ${type} deleted successfully`,
            },
          };
        } else {
          return {
            success: false,
            data: undefined,
            error: 'Either id, clearAll, or type parameter must be provided',
          };
        }
      } catch (error) {
        return {
          success: false,
          data: undefined,
          error: `Failed to delete memory item(s): ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });
}
