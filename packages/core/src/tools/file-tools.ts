import * as path from 'path';

import fs from 'fs-extra';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const FileReadTool = new DynamicStructuredTool({
  name: 'file-read',
  description: 'Read the contents of a file',
  schema: z.object({
    path: z.string().describe('Path to the file to read'),
    encoding: z.string().default('utf8').describe('File encoding (default: utf8)'),
  }),
  func: async ({ path: filePath, encoding = 'utf8' }) => {
    try {
      const absolutePath = path.resolve(filePath);
      const content = await fs.readFile(absolutePath, encoding as BufferEncoding);

      return JSON.stringify({
        success: true,
        data: {
          content,
          path: absolutePath,
          size: content.length,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});

export const FileWriteTool = new DynamicStructuredTool({
  name: 'file-write',
  description: 'Write content to a file',
  schema: z.object({
    path: z.string().describe('Path to the file to write'),
    content: z.string().describe('Content to write to the file'),
    encoding: z.string().default('utf8').describe('File encoding (default: utf8)'),
    createDirectories: z
      .boolean()
      .default(true)
      .describe("Create parent directories if they don't exist (default: true)"),
  }),
  func: async ({ path: filePath, content, encoding = 'utf8', createDirectories = true }) => {
    try {
      const absolutePath = path.resolve(filePath);

      if (createDirectories) {
        await fs.ensureDir(path.dirname(absolutePath));
      }

      await fs.writeFile(absolutePath, content, encoding as BufferEncoding);

      return JSON.stringify({
        success: true,
        data: {
          path: absolutePath,
          bytesWritten: Buffer.byteLength(content, encoding as BufferEncoding),
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});

export const FileEditTool = new DynamicStructuredTool({
  name: 'file-edit',
  description: 'Edit specific lines in a file or perform find-and-replace operations',
  schema: z.object({
    path: z.string().describe('Path to the file to edit'),
    operation: z
      .enum(['replace-lines', 'insert-lines', 'delete-lines', 'find-replace'])
      .describe('Type of edit operation to perform'),
    startLine: z.number().optional().describe('Start line number (1-based) for line operations'),
    endLine: z.number().optional().describe('End line number (1-based) for line operations'),
    content: z.string().optional().describe('New content for replace/insert operations'),
    searchPattern: z
      .string()
      .optional()
      .describe('Pattern to search for in find-replace operations'),
    replaceWith: z.string().optional().describe('Text to replace the search pattern with'),
    useRegex: z
      .boolean()
      .default(false)
      .describe('Use regular expressions for find-replace (default: false)'),
  }),
  func: async ({
    path: filePath,
    operation,
    startLine,
    endLine,
    content,
    searchPattern,
    replaceWith,
    useRegex = false,
  }) => {
    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = await fs.readFile(absolutePath, 'utf8');
      const lines = fileContent.split('\n');

      let newContent: string;

      switch (operation) {
        case 'replace-lines': {
          if (startLine === undefined || content === undefined) {
            return JSON.stringify({
              success: false,
              error: 'Replace operation requires startLine and content parameters',
            });
          }
          const end = endLine ?? startLine;
          const newLines = content.split('\n');
          lines.splice(startLine - 1, end - startLine + 1, ...newLines);
          newContent = lines.join('\n');
          break;
        }

        case 'insert-lines': {
          if (startLine === undefined || content === undefined) {
            return JSON.stringify({
              success: false,
              error: 'Insert operation requires startLine and content parameters',
            });
          }
          const insertLines = content.split('\n');
          lines.splice(startLine - 1, 0, ...insertLines);
          newContent = lines.join('\n');
          break;
        }

        case 'delete-lines': {
          if (startLine === undefined) {
            return JSON.stringify({
              success: false,
              error: 'Delete operation requires startLine parameter',
            });
          }
          const deleteEnd = endLine ?? startLine;
          lines.splice(startLine - 1, deleteEnd - startLine + 1);
          newContent = lines.join('\n');
          break;
        }

        case 'find-replace': {
          if (!searchPattern || replaceWith === undefined) {
            return JSON.stringify({
              success: false,
              error: 'Find-replace operation requires searchPattern and replaceWith parameters',
            });
          }
          if (useRegex) {
            const regex = new RegExp(searchPattern, 'g');
            newContent = fileContent.replace(regex, replaceWith);
          } else {
            newContent = fileContent.split(searchPattern).join(replaceWith);
          }
          break;
        }

        default:
          return JSON.stringify({
            success: false,
            error: `Unsupported operation: ${operation}`,
          });
      }

      await fs.writeFile(absolutePath, newContent, 'utf8');

      return JSON.stringify({
        success: true,
        data: {
          path: absolutePath,
          operation,
          linesAffected:
            operation === 'find-replace'
              ? 'N/A'
              : operation === 'delete-lines'
                ? endLine && startLine
                  ? endLine - startLine + 1
                  : 1
                : operation === 'insert-lines'
                  ? content!.split('\n').length
                  : endLine && startLine
                    ? endLine - startLine + 1
                    : 1,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});

export const FileSearchTool = new DynamicStructuredTool({
  name: 'file-search',
  description: 'Search for text patterns in files',
  schema: z.object({
    pattern: z.string().describe('Text pattern to search for'),
    path: z.string().describe('File or directory path to search in'),
    recursive: z
      .boolean()
      .default(true)
      .describe('Search recursively in subdirectories (default: true)'),
    useRegex: z.boolean().default(false).describe('Use regular expressions (default: false)'),
    caseSensitive: z.boolean().default(false).describe('Case sensitive search (default: false)'),
    fileExtensions: z
      .array(z.string())
      .optional()
      .describe('Filter by file extensions (e.g., [".ts", ".js"])'),
    maxResults: z
      .number()
      .default(100)
      .describe('Maximum number of results to return (default: 100)'),
  }),
  func: async ({
    pattern,
    path: searchPath,
    recursive = true,
    useRegex = false,
    caseSensitive = false,
    fileExtensions,
    maxResults = 100,
  }) => {
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
            if (results.length >= maxResults) return;

            let found = false;
            let match = '';

            if (useRegex) {
              const flags = caseSensitive ? 'g' : 'gi';
              const regex = new RegExp(pattern, flags);
              const regexMatch = line.match(regex);
              if (regexMatch) {
                found = true;
                match = regexMatch[0];
              }
            } else {
              const searchLine = caseSensitive ? line : line.toLowerCase();
              const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();
              if (searchLine.includes(searchPattern)) {
                found = true;
                match = pattern;
              }
            }

            if (found) {
              results.push({
                file: filePath,
                line: index + 1,
                content: line.trim(),
                match,
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
          console.error(
            `Error reading ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      };

      const processPath = async (currentPath: string) => {
        const stat = await fs.stat(currentPath);

        if (stat.isFile()) {
          if (fileExtensions && Array.isArray(fileExtensions)) {
            const ext = path.extname(currentPath);
            if (!fileExtensions.includes(ext)) {
              return;
            }
          }
          await searchInFile(currentPath);
        } else if (stat.isDirectory() && recursive) {
          const entries = await fs.readdir(currentPath);
          for (const entry of entries) {
            if (results.length >= maxResults) break;
            await processPath(path.join(currentPath, entry));
          }
        }
      };

      await processPath(absolutePath);

      return JSON.stringify({
        success: true,
        data: {
          results,
          totalMatches: results.length,
          searchPath: absolutePath,
          pattern,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});
