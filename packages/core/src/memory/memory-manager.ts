import * as path from 'path';
import * as os from 'os';

import fs from 'fs-extra';

import { MemoryItem, ChatMessage } from '../types/index.js';

export class MemoryManager {
  private memories: MemoryItem[] = [];
  private maxMemories: number;
  private persistToFile: boolean;
  private filePath: string;

  constructor(maxMemories = 100, persistToFile = true, filePath?: string) {
    this.maxMemories = maxMemories;
    this.persistToFile = persistToFile;
    this.filePath = filePath || path.join(os.homedir(), '.shell-ai', 'memory.json');

    if (this.persistToFile) {
      this.loadFromFile();
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      if (await fs.pathExists(this.filePath)) {
        const data = await fs.readJson(this.filePath);
        this.memories = data.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
    } catch (error) {
      console.warn(`Failed to load memory from ${this.filePath}:`, error);
    }
  }

  private async saveToFile(): Promise<void> {
    if (!this.persistToFile) return;

    try {
      await fs.ensureDir(path.dirname(this.filePath));
      await fs.writeJson(this.filePath, this.memories, { spaces: 2 });
    } catch (error) {
      console.error(`Failed to save memory to ${this.filePath}:`, error);
    }
  }

  async addMemory(item: MemoryItem): Promise<string> {
    const memory: MemoryItem = {
      ...item,
      timestamp: item.timestamp || new Date(),
    };

    // If no ID is provided, generate one
    if (!memory.id) {
      memory.id = this.generateId();
    }

    this.memories.unshift(memory);

    // Trim to max size
    if (this.memories.length > this.maxMemories) {
      this.memories = this.memories.slice(0, this.maxMemories);
    }

    if (this.persistToFile) {
      await this.saveToFile();
    }

    return memory.id;
  }

  async addConversation(messages: ChatMessage[]): Promise<string> {
    const content = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    return await this.addMemory({
      id: this.generateId(),
      type: 'conversation',
      content,
      timestamp: new Date(),
      metadata: {
        messageCount: messages.length,
        participants: [...new Set(messages.map(msg => msg.role))],
      },
    });
  }

  async addFileContext(filePath: string, content: string, operation?: string): Promise<string> {
    return await this.addMemory({
      id: this.generateId(),
      type: 'file',
      content,
      timestamp: new Date(),
      metadata: {
        filePath,
        operation: operation || 'read',
        size: content.length,
      },
    });
  }

  async addCommand(command: string, output: string, success: boolean): Promise<string> {
    return await this.addMemory({
      id: this.generateId(),
      type: 'command',
      content: `Command: ${command}\nOutput: ${output}`,
      timestamp: new Date(),
      metadata: {
        command,
        success,
        outputLength: output.length,
      },
    });
  }

  async addContext(context: string, type = 'context'): Promise<string> {
    return await this.addMemory({
      id: this.generateId(),
      type: type as 'conversation' | 'file' | 'context' | 'command',
      content: context,
      timestamp: new Date(),
    });
  }

  async searchMemories(
    query: string,
    options?: {
      type?: MemoryItem['type'];
      limit?: number;
      minRelevanceScore?: number;
    }
  ): Promise<MemoryItem[]> {
    const { type, limit = 10, minRelevanceScore = 0 } = options || {};

    let filtered = this.memories;

    // Filter by type if specified
    if (type) {
      filtered = filtered.filter(memory => memory.type === type);
    }

    // Simple text search (in a real implementation, you might want to use
    // more sophisticated search like vector similarity)
    const searchTerms = query.toLowerCase().split(/\s+/);

    const scored = filtered.map(memory => {
      const content = memory.content.toLowerCase();
      const metadata = JSON.stringify(memory.metadata || {}).toLowerCase();
      // const searchText = `${content} ${metadata}`;

      let score = 0;
      searchTerms.forEach(term => {
        const contentMatches = (content.match(new RegExp(term, 'g')) || []).length;
        const metadataMatches = (metadata.match(new RegExp(term, 'g')) || []).length;
        score += contentMatches + metadataMatches * 0.5;
      });

      return {
        ...memory,
        relevanceScore: score,
      };
    });

    return scored
      .filter(memory => (memory.relevanceScore || 0) >= minRelevanceScore)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, limit);
  }

  getRecentMemories(limit = 10, type?: MemoryItem['type']): MemoryItem[] {
    let filtered = this.memories;

    if (type) {
      filtered = filtered.filter(memory => memory.type === type);
    }

    return filtered.slice(0, limit);
  }

  getMemoryById(id: string): MemoryItem | undefined {
    return this.memories.find(memory => memory.id === id);
  }

  async deleteMemory(id: string): Promise<boolean> {
    const index = this.memories.findIndex(memory => memory.id === id);
    if (index !== -1) {
      this.memories.splice(index, 1);
      if (this.persistToFile) {
        await this.saveToFile();
      }
      return true;
    }
    return false;
  }

  // Alias for backward compatibility
  removeMemory(id: string): boolean {
    this.deleteMemory(id);
    return true;
  }

  async clearMemories(type?: MemoryItem['type']): Promise<void> {
    if (type) {
      this.memories = this.memories.filter(memory => memory.type !== type);
    } else {
      this.memories = [];
    }

    if (this.persistToFile) {
      await this.saveToFile();
    }
  }

  async deleteMemoriesByType(type: MemoryItem['type']): Promise<number> {
    const initialCount = this.memories.length;
    this.memories = this.memories.filter(memory => memory.type !== type);
    const deletedCount = initialCount - this.memories.length;

    if (this.persistToFile) {
      await this.saveToFile();
    }

    return deletedCount;
  }

  async getAllMemories(): Promise<MemoryItem[]> {
    return [...this.memories];
  }

  getMemoryStats(): {
    total: number;
    byType: Record<string, number>;
    oldestMemory?: Date;
    newestMemory?: Date;
  } {
    const byType: Record<string, number> = {};

    this.memories.forEach(memory => {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
    });

    const timestamps = this.memories.map(m => m.timestamp);

    return {
      total: this.memories.length,
      byType,
      oldestMemory:
        timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
      newestMemory:
        timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined,
    };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  updateConfig(maxMemories?: number, persistToFile?: boolean, filePath?: string): void {
    if (maxMemories !== undefined) {
      this.maxMemories = maxMemories;
      if (this.memories.length > maxMemories) {
        this.memories = this.memories.slice(0, maxMemories);
      }
    }

    if (persistToFile !== undefined) {
      this.persistToFile = persistToFile;
    }

    if (filePath !== undefined) {
      this.filePath = filePath;
      if (this.persistToFile) {
        this.loadFromFile();
      }
    }

    if (this.persistToFile) {
      this.saveToFile();
    }
  }
}
