import * as path from 'path';
import fs from 'fs-extra';
import { BaseTool } from './base-tool.js';
import { ToolResult } from '../types/index.js';

export class FileReadTool extends BaseTool {
  name = 'file-read';
  description = 'Read the contents of a file';
  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read'
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        default: 'utf8'
      }
    },
    required: ['path']
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { path: filePath, encoding = 'utf8' } = params;

    if (typeof filePath !== 'string') {
      return this.createResult(false, undefined, 'Path parameter must be a string');
    }

    try {
      const absolutePath = path.resolve(filePath);
      const content = await fs.readFile(absolutePath, encoding as BufferEncoding);
      
      return this.createResult(true, { 
        content, 
        path: absolutePath,
        size: content.length 
      });
    } catch (error) {
      return this.createResult(false, undefined, `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class FileWriteTool extends BaseTool {
  name = 'file-write';
  description = 'Write content to a file';
  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        default: 'utf8'
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist (default: true)',
        default: true
      }
    },
    required: ['path', 'content']
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { path: filePath, content, encoding = 'utf8', createDirectories = true } = params;

    if (typeof filePath !== 'string') {
      return this.createResult(false, undefined, 'Path parameter must be a string');
    }

    if (typeof content !== 'string') {
      return this.createResult(false, undefined, 'Content parameter must be a string');
    }

    try {
      const absolutePath = path.resolve(filePath);
      
      if (createDirectories) {
        await fs.ensureDir(path.dirname(absolutePath));
      }

      await fs.writeFile(absolutePath, content, encoding as BufferEncoding);
      
      return this.createResult(true, { 
        path: absolutePath,
        bytesWritten: Buffer.byteLength(content, encoding as BufferEncoding)
      });
    } catch (error) {
      return this.createResult(false, undefined, `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class FileEditTool extends BaseTool {
  name = 'file-edit';
  description = 'Edit specific lines in a file or perform find-and-replace operations';
  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit'
      },
      operation: {
        type: 'string',
        enum: ['replace-lines', 'insert-lines', 'delete-lines', 'find-replace'],
        description: 'Type of edit operation to perform'
      },
      startLine: {
        type: 'number',
        description: 'Start line number (1-based) for line operations'
      },
      endLine: {
        type: 'number',
        description: 'End line number (1-based) for line operations'
      },
      content: {
        type: 'string',
        description: 'New content for replace/insert operations'
      },
      searchPattern: {
        type: 'string',
        description: 'Pattern to search for in find-replace operations'
      },
      replaceWith: {
        type: 'string',
        description: 'Text to replace the search pattern with'
      },
      useRegex: {
        type: 'boolean',
        description: 'Use regular expressions for find-replace (default: false)',
        default: false
      }
    },
    required: ['path', 'operation']
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { 
      path: filePath, 
      operation, 
      startLine, 
      endLine, 
      content, 
      searchPattern, 
      replaceWith, 
      useRegex = false 
    } = params;

    if (typeof filePath !== 'string') {
      return this.createResult(false, undefined, 'Path parameter must be a string');
    }

    if (typeof operation !== 'string') {
      return this.createResult(false, undefined, 'Operation parameter must be a string');
    }

    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = await fs.readFile(absolutePath, 'utf8');
      const lines = fileContent.split('\n');

      let newContent: string;

      switch (operation) {
        case 'replace-lines':
          if (typeof startLine !== 'number' || typeof content !== 'string') {
            return this.createResult(false, undefined, 'Replace operation requires startLine and content parameters');
          }
          const end = typeof endLine === 'number' ? endLine : startLine;
          const newLines = (content as string).split('\n');
          lines.splice(startLine - 1, end - startLine + 1, ...newLines);
          newContent = lines.join('\n');
          break;

        case 'insert-lines':
          if (typeof startLine !== 'number' || typeof content !== 'string') {
            return this.createResult(false, undefined, 'Insert operation requires startLine and content parameters');
          }
          const insertLines = (content as string).split('\n');
          lines.splice(startLine - 1, 0, ...insertLines);
          newContent = lines.join('\n');
          break;

        case 'delete-lines':
          if (typeof startLine !== 'number') {
            return this.createResult(false, undefined, 'Delete operation requires startLine parameter');
          }
          const deleteEnd = typeof endLine === 'number' ? endLine : startLine;
          lines.splice(startLine - 1, deleteEnd - startLine + 1);
          newContent = lines.join('\n');
          break;

        case 'find-replace':
          if (typeof searchPattern !== 'string' || typeof replaceWith !== 'string') {
            return this.createResult(false, undefined, 'Find-replace operation requires searchPattern and replaceWith parameters');
          }
          if (useRegex) {
            const regex = new RegExp(searchPattern as string, 'g');
            newContent = fileContent.replace(regex, replaceWith as string);
          } else {
            newContent = fileContent.split(searchPattern as string).join(replaceWith as string);
          }
          break;

        default:
          return this.createResult(false, undefined, `Unsupported operation: ${operation}`);
      }

      await fs.writeFile(absolutePath, newContent, 'utf8');

      return this.createResult(true, {
        path: absolutePath,
        operation,
        linesAffected: operation === 'find-replace' ? 'N/A' : 
          (operation === 'delete-lines' ? (typeof endLine === 'number' ? endLine - (startLine as number) + 1 : 1) :
          (operation === 'insert-lines' ? (content as string).split('\n').length : 
          (typeof endLine === 'number' ? endLine - (startLine as number) + 1 : 1)))
      });

    } catch (error) {
      return this.createResult(false, undefined, `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class FileSearchTool extends BaseTool {
  name = 'file-search';
  description = 'Search for text patterns in files';
  parameters = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Text pattern to search for'
      },
      path: {
        type: 'string',
        description: 'File or directory path to search in'
      },
      recursive: {
        type: 'boolean',
        description: 'Search recursively in subdirectories (default: true)',
        default: true
      },
      useRegex: {
        type: 'boolean',
        description: 'Use regular expressions (default: false)',
        default: false
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case sensitive search (default: false)',
        default: false
      },
      fileExtensions: {
        type: 'array',
        description: 'Filter by file extensions (e.g., [".ts", ".js"])',
        items: { type: 'string' }
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100)',
        default: 100
      }
    },
    required: ['pattern', 'path']
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { 
      pattern, 
      path: searchPath, 
      recursive = true, 
      useRegex = false, 
      caseSensitive = false,
      fileExtensions,
      maxResults = 100
    } = params;

    if (typeof pattern !== 'string') {
      return this.createResult(false, undefined, 'Pattern parameter must be a string');
    }

    if (typeof searchPath !== 'string') {
      return this.createResult(false, undefined, 'Path parameter must be a string');
    }

    try {
      const absolutePath = path.resolve(searchPath);
      const results: Array<{
        file: string;
        line: number;
        content: string;
        match: string;
      }> = [];

      const searchInFile = async (filePath: string) => {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (results.length >= (maxResults as number)) return;

            let found = false;
            let match = '';

            if (useRegex) {
              const flags = caseSensitive ? 'g' : 'gi';
              const regex = new RegExp(pattern as string, flags);
              const regexMatch = line.match(regex);
              if (regexMatch) {
                found = true;
                match = regexMatch[0];
              }
            } else {
              const searchLine = caseSensitive ? line : line.toLowerCase();
              const searchPattern = caseSensitive ? pattern : (pattern as string).toLowerCase();
              if (searchLine.includes(searchPattern)) {
                found = true;
                match = pattern as string;
              }
            }

            if (found) {
              results.push({
                file: filePath,
                line: index + 1,
                content: line.trim(),
                match
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
        }
      };

      const processPath = async (currentPath: string) => {
        const stat = await fs.stat(currentPath);

        if (stat.isFile()) {
          if (fileExtensions && Array.isArray(fileExtensions)) {
            const ext = path.extname(currentPath);
            if (!(fileExtensions as string[]).includes(ext)) {
              return;
            }
          }
          await searchInFile(currentPath);
        } else if (stat.isDirectory() && recursive) {
          const entries = await fs.readdir(currentPath);
          for (const entry of entries) {
            if (results.length >= (maxResults as number)) break;
            await processPath(path.join(currentPath, entry));
          }
        }
      };

      await processPath(absolutePath);

      return this.createResult(true, {
        results,
        totalMatches: results.length,
        searchPath: absolutePath,
        pattern: pattern as string
      });

    } catch (error) {
      return this.createResult(false, undefined, `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
