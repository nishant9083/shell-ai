import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import * as path from 'path';
import { BaseTool } from './base-tool.js';
import { ToolResult } from '../types/index.js';

const execAsync = promisify(exec);

export class ShellExecTool extends BaseTool {
  name = 'shell-exec';
  description = 'Execute shell commands and return their output';
  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute'
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory for command execution (default: current directory)'
      },
      timeout: {
        type: 'number',
        description: 'Command timeout in milliseconds (default: 30000)',
        default: 30000
      },
      env: {
        type: 'object',
        description: 'Environment variables to set for the command'
      },
      captureOutput: {
        type: 'boolean',
        description: 'Capture command output (default: true)',
        default: true
      }
    },
    required: ['command']
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { 
      command, 
      workingDirectory, 
      timeout = 30000, 
      env,
      captureOutput = true 
    } = params;

    if (typeof command !== 'string') {
      return this.createResult(false, undefined, 'Command parameter must be a string');
    }

    try {
      const cwd = workingDirectory ? path.resolve(workingDirectory as string) : process.cwd();
      
      // Verify working directory exists
      if (workingDirectory && !await fs.pathExists(cwd)) {
        return this.createResult(false, undefined, `Working directory does not exist: ${cwd}`);
      }

      const execOptions = {
        cwd,
        timeout: timeout as number,
        env: env ? { ...process.env, ...(env as Record<string, string>) } : process.env,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      };

      if (captureOutput) {
        const { stdout, stderr } = await execAsync(command as string, execOptions);
        
        return this.createResult(true, {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command: command as string,
          workingDirectory: cwd,
          exitCode: 0
        });
      } else {
        // For non-captured output, we'll use spawn and just return when it completes
        return new Promise((resolve) => {
          const child = spawn(command as string, [], {
            ...execOptions,
            stdio: 'inherit',
            shell: true
          });

          child.on('close', (code) => {
            resolve(this.createResult(true, {
              command: command as string,
              workingDirectory: cwd,
              exitCode: code || 0
            }));
          });

          child.on('error', (error) => {
            resolve(this.createResult(false, undefined, `Command failed: ${error.message}`));
          });
        });
      }

    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ETIMEDOUT') {
        return this.createResult(false, undefined, `Command timed out after ${timeout}ms`);
      }
      
      // Handle exec errors that include stdout/stderr
      if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
        const execError = error as { stdout: string; stderr: string; code?: number };
        return this.createResult(false, {
          stdout: execError.stdout,
          stderr: execError.stderr,
          exitCode: execError.code || 1
        }, `Command failed with exit code ${execError.code || 1}`);
      }

      return this.createResult(false, undefined, `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class DirectoryListTool extends BaseTool {
  name = 'directory-list';
  description = 'List files and directories in a given path';
  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list (default: current directory)'
      },
      recursive: {
        type: 'boolean',
        description: 'List files recursively (default: false)',
        default: false
      },
      showHidden: {
        type: 'boolean',
        description: 'Show hidden files (default: false)',
        default: false
      },
      includeStats: {
        type: 'boolean',
        description: 'Include file statistics (size, modified date, etc.) (default: false)',
        default: false
      },
      filterExtensions: {
        type: 'array',
        description: 'Filter by file extensions (e.g., [".ts", ".js"])',
        items: { type: 'string' }
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum directory depth for recursive listing (default: 10)',
        default: 10
      }
    }
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const { 
      path: dirPath = '.', 
      recursive = false, 
      showHidden = false, 
      includeStats = false,
      filterExtensions,
      maxDepth = 10
    } = params;

    try {
      const absolutePath = path.resolve(dirPath as string);
      
      if (!await fs.pathExists(absolutePath)) {
        return this.createResult(false, undefined, `Path does not exist: ${absolutePath}`);
      }

      const stat = await fs.stat(absolutePath);
      if (!stat.isDirectory()) {
        return this.createResult(false, undefined, `Path is not a directory: ${absolutePath}`);
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

        const entries = await fs.readdir(currentPath);
        
        for (const entry of entries) {
          if (!showHidden && entry.startsWith('.')) continue;

          const entryPath = path.join(currentPath, entry);
          const entryStat = await fs.stat(entryPath);
          const isDirectory = entryStat.isDirectory();

          // Filter by extensions if specified
          if (filterExtensions && Array.isArray(filterExtensions) && !isDirectory) {
            const ext = path.extname(entry);
            if (!(filterExtensions as string[]).includes(ext)) continue;
          }

          const item: typeof results[0] = {
            name: entry,
            path: entryPath,
            type: isDirectory ? 'directory' : 'file'
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

      return this.createResult(true, {
        path: absolutePath,
        items: results,
        totalItems: results.length,
        directories: results.filter(item => item.type === 'directory').length,
        files: results.filter(item => item.type === 'file').length
      });

    } catch (error) {
      return this.createResult(false, undefined, `Directory listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class CurrentDirectoryTool extends BaseTool {
    name = 'current-directory';
    description = 'Get the current working directory and list its contents';
    parameters = {
        type: 'object',
        properties: {
            showHidden: {
                type: 'boolean',
                description: 'Show hidden files and directories (default: false)',
                default: false
            },
            includeStats: {
                type: 'boolean',
                description: 'Include file statistics (size, modified date, etc.) (default: true)',
                default: true
            },
            sortBy: {
                type: 'string',
                description: 'Sort files by: name, size, modified, type (default: name)',
                enum: ['name', 'size', 'modified', 'type'],
                default: 'name'
            }
        }
    };

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
        const { 
            showHidden = false, 
            includeStats = true,
            sortBy = 'name'
        } = params;

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
                const entryStat = await fs.stat(entryPath);
                const isDirectory = entryStat.isDirectory();

                const item: typeof results[0] = {
                    name: entry,
                    type: isDirectory ? 'directory' : 'file'
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

            return this.createResult(true, {
                currentDirectory: currentPath,
                items: results,
                totalItems: results.length,
                directories: results.filter(item => item.type === 'directory').length,
                files: results.filter(item => item.type === 'file').length
            });

        } catch (error) {
            return this.createResult(false, undefined, `Failed to read current directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
