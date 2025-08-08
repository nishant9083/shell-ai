import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { MemoryItem, AIMessage } from '../types/index.js';

export class MemoryManager {
  private memories: MemoryItem[] = [];
  private maxMemories: number;
  private persistToFile: boolean;
  private filePath: string;

  constructor(maxMemories = 100, persistToFile = true, filePath?: string) {
    this.maxMemories = maxMemories;
    this.persistToFile = persistToFile;
    this.filePath = filePath || path.join(os.homedir(), '.ai-cli', 'memory.json');
    
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
          timestamp: new Date(item.timestamp)
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

  addMemory(item: Omit<MemoryItem, 'id' | 'timestamp'>): string {
    const memory: MemoryItem = {
      id: this.generateId(),
      timestamp: new Date(),
      ...item
    };

    this.memories.unshift(memory);

    // Trim to max size
    if (this.memories.length > this.maxMemories) {
      this.memories = this.memories.slice(0, this.maxMemories);
    }

    if (this.persistToFile) {
      this.saveToFile();
    }

    return memory.id;
  }

  addConversation(messages: AIMessage[]): string {
    const content = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    return this.addMemory({
      type: 'conversation',
      content,
      metadata: {
        messageCount: messages.length,
        participants: [...new Set(messages.map(msg => msg.role))]
      }
    });
  }

  addFileContext(filePath: string, content: string, operation?: string): string {
    return this.addMemory({
      type: 'file',
      content,
      metadata: {
        filePath,
        operation: operation || 'read',
        size: content.length
      }
    });
  }

  addCommand(command: string, output: string, success: boolean): string {
    return this.addMemory({
      type: 'command',
      content: `Command: ${command}\nOutput: ${output}`,
      metadata: {
        command,
        success,
        outputLength: output.length
      }
    });
  }

  addContext(context: string, type = 'context'): string {
    return this.addMemory({
      type: type as any,
      content: context
    });
  }

  searchMemories(query: string, options?: {
    type?: MemoryItem['type'];
    limit?: number;
    minRelevanceScore?: number;
  }): MemoryItem[] {
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
      const searchText = `${content} ${metadata}`;
      
      let score = 0;
      searchTerms.forEach(term => {
        const contentMatches = (content.match(new RegExp(term, 'g')) || []).length;
        const metadataMatches = (metadata.match(new RegExp(term, 'g')) || []).length;
        score += contentMatches + metadataMatches * 0.5;
      });

      return {
        ...memory,
        relevanceScore: score
      };
    });

    return scored
      .filter(memory => memory.relevanceScore >= minRelevanceScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
      .map(({ relevanceScore, ...memory }) => memory);
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

  removeMemory(id: string): boolean {
    const index = this.memories.findIndex(memory => memory.id === id);
    if (index !== -1) {
      this.memories.splice(index, 1);
      if (this.persistToFile) {
        this.saveToFile();
      }
      return true;
    }
    return false;
  }

  clearMemories(type?: MemoryItem['type']): void {
    if (type) {
      this.memories = this.memories.filter(memory => memory.type !== type);
    } else {
      this.memories = [];
    }

    if (this.persistToFile) {
      this.saveToFile();
    }
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
      oldestMemory: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
      newestMemory: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined
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
