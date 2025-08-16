/* eslint-disable prettier/prettier */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

import fs from 'fs-extra';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { minimatch } from 'minimatch';

const execAsync = promisify(exec);

      const isExcluded = (filePath: string, absolutePath: string, exP: string[]): boolean => {
        // Get path relative to the base directory
        const relPath = path.relative(absolutePath, filePath);

        // Check if the path matches any exclude pattern
        return (exP as string[]).some(pattern =>
          minimatch(relPath, pattern, { dot: true })
        );
      };

export const ShellExecTool = new DynamicStructuredTool({
  name: 'shell-exec',
  description: 'Execute shell commands and return their output',
  schema: z.object({
    command: z.string().describe('Shell command to execute'),
    workingDirectory: z
      .string()
      .optional()
      .describe('Working directory for command execution (default: current directory)'),
    timeout: z.number().default(30000).describe('Command timeout in milliseconds (default: 30000)'),
    env: z
      .record(z.string())
      .optional()
      .describe('Environment variables to set for command execution'),
    captureOutput: z
      .boolean()
      .default(true)
      .describe('Whether to capture command output (default: true)'),
    approved: z
      .boolean()
      .optional()
      .default(false)
      .describe("Don't modify it. It will be approved by the user before execution"),
  }),

  func: async (params: Record<string, unknown>) => {
    const {
      command,
      workingDirectory,
      timeout = 30000,
      env,
      captureOutput = true,
      approved = false,
    } = params;

    if (!approved) {
      return { success: false, error: 'User denied the command execution.' };
    }

    if (typeof command !== 'string') {
      return { success: false, error: 'Command parameter must be a string' };
    }

    try {
      const cwd = workingDirectory ? path.resolve(workingDirectory as string) : process.cwd();

      // Verify working directory exists
      if (workingDirectory && !(await fs.pathExists(cwd))) {
        return { success: false, error: `Working directory does not exist: ${cwd}` };
      }

      const execOptions = {
        cwd,
        timeout: timeout as number,
        env: env ? { ...process.env, ...(env as Record<string, string>) } : process.env,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      };

      if (captureOutput) {
        const { stdout, stderr } = await execAsync(command as string, execOptions);

        return {
          success: true,
          data: {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            command: command as string,
            workingDirectory: cwd,
            exitCode: 0,
          },
        };
      } else {
        // For non-captured output, we'll use spawn and just return when it completes
        return new Promise(resolve => {
          const child = spawn(command as string, [], {
            ...execOptions,
            stdio: 'inherit',
            shell: true,
          });

          child.on('close', code => {
            resolve({
              success: true,
              data: {
                command: command as string,
                workingDirectory: cwd,
                exitCode: code || 0,
              },
            });
          });

          child.on('error', error => {
            resolve({ success: false, error: `Command failed: ${error.message}` });
          });
        });
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ETIMEDOUT') {
        return { success: false, error: `Command timed out after ${timeout}ms` };
      }

      // Handle exec errors that include stdout/stderr
      if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
        const execError = error as { stdout: string; stderr: string; code?: number };
        return {
          success: false,
          error: `Command failed with exit code ${execError.code || 1}`,
          data: {
            stdout: execError.stdout,
            stderr: execError.stderr,
            exitCode: execError.code || 1,
          },
        };
      }

      return {
        success: false,
        error: `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
export const DirectoryListTool = new DynamicStructuredTool({
  name: 'directory-list',
  description: 'List files and directories in a given path',
  schema: z.object({
    path: z.string().optional().describe('Directory path to list (default: current directory)'),
    recursive: z.boolean().default(false).describe('List files recursively (default: false)'),
    showHidden: z.boolean().default(false).describe('Show hidden files (default: false)'),
    includeStats: z
      .boolean()
      .default(false)
      .describe('Include file statistics (size, modified date, etc.) (default: false)'),
    filterExtensions: z
      .array(z.string())
      .optional()
      .describe('Filter by file extensions (e.g., [".ts", ".js"])'),
    maxDepth: z
      .number()
      .default(10)
      .describe('Maximum directory depth for recursive listing (default: 10)'),
    excludePaths: z
      .array(z.string())
      .default([
        '**/node_modules/**',
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/CVS/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.tmp',
        '**/*.temp',
        '**/*.log',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/target/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/*.suo',
        '**/*.user',
        '**/.vs/**',
        '**/bin/**',
        '**/obj/**',
        '**/.cache/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/coverage/**',
        '**/.nyc_output/**',
        '**/bower_components/**',
        '**/vendor/**',
      ])
      .describe('Paths to exclude from the directory listing'),
  }),

  func: async (params: Record<string, unknown>) => {
    const {
      path: dirPath = '.',
      recursive = false,
      showHidden = false,
      includeStats = false,
      filterExtensions,
      maxDepth = 4,
      excludePaths = [],
    } = params;

    const exP = [
      ...(excludePaths as string[]),
      ...[
        '**/node_modules/**',
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/CVS/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.tmp',
        '**/*.temp',
        '**/*.log',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/target/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/*.suo',
        '**/*.user',
        '**/.vs/**',
        '**/bin/**',
        '**/obj/**',
        '**/.cache/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/coverage/**',
        '**/.nyc_output/**',
        '**/bower_components/**',
        '**/vendor/**',
      ],
    ];
    try {
      const absolutePath = path.resolve(dirPath as string);

      if (!(await fs.pathExists(absolutePath))) {
        return { success: false, error: `Path does not exist: ${absolutePath}` };
      }

      const stat = await fs.stat(absolutePath);
      if (!stat.isDirectory()) {
        return { success: false, error: `Path is not a directory: ${absolutePath}` };
      }

      const results: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
        size?: number;
        modified?: Date;
        permissions?: string;
        extension?: string;
      }> = [];

      const listDirectory = async (currentPath: string, depth = 0) => {
        if (depth > (maxDepth as number)) return;

        // Skip if this directory matches an exclude pattern
        if (currentPath !== absolutePath && isExcluded(currentPath, absolutePath, exP)) return;

        const entries = await fs.readdir(currentPath);

        for (const entry of entries) {
          if (!showHidden && entry.startsWith('.')) continue;

          const entryPath = path.join(currentPath, entry);

          // Skip if this path matches an exclude pattern
          if (isExcluded(entryPath, absolutePath, exP)) continue;

          const entryStat = await fs.stat(entryPath);
          const isDirectory = entryStat.isDirectory();

          // Filter by extensions if specified
          if (filterExtensions && Array.isArray(filterExtensions) && !isDirectory) {
            const ext = path.extname(entry);
            if (!(filterExtensions as string[]).includes(ext)) continue;
          }

          const item: (typeof results)[0] = {
            name: entry,
            path: entryPath,
            type: isDirectory ? 'directory' : 'file',
          };

          if (includeStats) {
            item.size = entryStat.size;
            item.modified = entryStat.mtime;
            item.permissions = entryStat.mode.toString(8);
            if (!isDirectory) {
              item.extension = path.extname(entry);
            }
          }

          results.push(item);

          // Recurse into subdirectories if requested
          if (recursive && isDirectory) {
            await listDirectory(entryPath, depth + 1);
          }
        }
      };

      await listDirectory(absolutePath);

      return {
        success: true,
        data: {
          path: absolutePath,
          items: results,
          totalItems: results.length,
          directories: results.filter(item => item.type === 'directory').length,
          files: results.filter(item => item.type === 'file').length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Directory listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

export const CurrentDirectoryTool = new DynamicStructuredTool({
  name: 'current-directory',
  description: 'Get the current working directory and list its contents',
  schema: z.object({
    showHidden: z
      .boolean()
      .default(false)
      .describe('Show hidden files and directories (default: false)'),
    includeStats: z
      .boolean()
      .default(true)
      .describe('Include file statistics (size, modified date, etc.) (default: true)'),
    sortBy: z
      .enum(['name', 'size', 'modified', 'type'])
      .default('name')
      .describe('Sort files by: name, size, modified, type (default: name)'),
  }),

  func: async (params: Record<string, unknown>) => {
    const { showHidden = false, includeStats = true, sortBy = 'name' } = params;

    const exP = [
        '**/node_modules/**',
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/CVS/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.tmp',
        '**/*.temp',
        '**/*.log',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/target/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/*.suo',
        '**/*.user',
        '**/.vs/**',
        '**/bin/**',
        '**/obj/**',
        '**/.cache/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/coverage/**',
        '**/.nyc_output/**',
        '**/bower_components/**',
        '**/vendor/**',      
    ];

    try {
      const currentPath = process.cwd();
      const entries = await fs.readdir(currentPath);

      const results: Array<{
        name: string;
        type: 'file' | 'directory';
        size?: number;
        modified?: Date;
        extension?: string;
      }> = [];

      for (const entry of entries) {
        if (!showHidden && entry.startsWith('.')) continue;

        const entryPath = path.join(currentPath, entry);

        if (isExcluded(entryPath, currentPath, exP)) continue;
        const entryStat = await fs.stat(entryPath);
        const isDirectory = entryStat.isDirectory();

        const item: (typeof results)[0] = {
          name: entry,
          type: isDirectory ? 'directory' : 'file',
        };

        if (includeStats) {
          item.size = entryStat.size;
          item.modified = entryStat.mtime;
          if (!isDirectory) {
            item.extension = path.extname(entry);
          }
        }

        results.push(item);
      }

      // Sort results based on sortBy parameter
      results.sort((a, b) => {
        switch (sortBy) {
          case 'size':
            return (b.size || 0) - (a.size || 0);
          case 'modified':
            return (b.modified?.getTime() || 0) - (a.modified?.getTime() || 0);
          case 'type':
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          case 'name':
          default:
            return a.name.localeCompare(b.name);
        }
      });

      return {
        success: true,
        data: {
          currentDirectory: currentPath,
          items: results,
          totalItems: results.length,
          directories: results.filter(item => item.type === 'directory').length,
          files: results.filter(item => item.type === 'file').length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read current directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
