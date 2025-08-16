import * as path from 'path';

import fs from 'fs-extra';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export interface GrepMatch {
  line: number;
  content: string;
  lineNumber: number;
  beforeContext?: string[];
  afterContext?: string[];
}

export interface GrepResult {
  file: string;
  matches: GrepMatch[];
  totalMatches: number;
}

export const SearchFileContentTool = new DynamicStructuredTool({
  name: 'search-file-content',
  description: 'Search for patterns in files using regular expressions or plain text',
  schema: z
    .object({
      pattern: z.string().describe('Pattern to search for (supports regex when isRegex is true)'),
      files: z.array(z.string()).optional().describe('Array of file paths to search in'),
      directory: z
        .string()
        .optional()
        .describe('Directory to search in (alternative to files array)'),
      recursive: z
        .boolean()
        .default(false)
        .describe('Search recursively in subdirectories (when using directory)'),
      isRegex: z.boolean().default(false).describe('Treat pattern as regular expression'),
      ignoreCase: z.boolean().default(false).describe('Case-insensitive search'),
      contextLines: z
        .number()
        .default(0)
        .describe('Number of context lines to include before and after matches'),
      filePattern: z
        .string()
        .optional()
        .describe('File pattern to match when searching directory (e.g., "*.ts", "*.js")'),
      exclude: z
        .array(z.string())
        .default([])
        .describe(
          'Patterns to exclude from search (file paths or directory names. eg: ["**/node_modules/**", "**/.git/**"])'
        ),
      maxMatches: z.number().default(100).describe('Maximum number of matches per file'),
      maxFiles: z.number().default(1000).describe('Maximum number of files to search'),
    })
    .refine(data => data.files || data.directory, {
      message: 'Either files array or directory must be provided',
    }),
  func: async (params: Record<string, unknown>) => {
    const {
      pattern,
      files,
      directory,
      recursive = false,
      isRegex = false,
      ignoreCase = false,
      contextLines = 0,
      filePattern,
      exclude = [],
      maxMatches = 100,
      maxFiles = 1000,
    } = params;

    if (typeof pattern !== 'string') {
      return { success: false, error: 'Pattern parameter must be a string' };
    }

    try {
      let searchFiles: string[] = [];

      if (files && Array.isArray(files)) {
        searchFiles = files.filter(f => typeof f === 'string') as string[];
      } else if (directory && typeof directory === 'string') {
        searchFiles = await findFilesInDirectory(
          directory,
          recursive as boolean,
          filePattern as string,
          exclude as string[],
          maxFiles as number
        );
      } else {
        return { success: false, error: 'Either files array or directory must be provided' };
      }

      if (searchFiles.length === 0) {
        return { success: true, data: { results: [], totalFiles: 0, totalMatches: 0 } };
      }

      const regex = createRegex(pattern, isRegex as boolean, ignoreCase as boolean);
      const results: GrepResult[] = [];
      let totalMatches = 0;

      for (const file of searchFiles.slice(0, maxFiles as number)) {
        try {
          const fileResult = await searchInFile(
            file,
            regex,
            contextLines as number,
            maxMatches as number
          );

          if (fileResult.matches.length > 0) {
            results.push(fileResult);
            totalMatches += fileResult.totalMatches;
          }
        } catch (_error) {
          // Skip files that can't be read (binary files, permission issues, etc.)
          continue;
        }
      }

      return {
        success: true,
        data: {
          results,
          totalFiles: searchFiles.length,
          totalMatches,
          searchPattern: pattern,
          isRegex: isRegex as boolean,
          ignoreCase: ignoreCase as boolean,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Grep search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

function createRegex(pattern: string, isRegex: boolean, ignoreCase: boolean): RegExp {
  try {
    const flags = ignoreCase ? 'gi' : 'g';

    if (isRegex) {
      return new RegExp(pattern, flags);
    } else {
      // Escape special regex characters for literal search
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escapedPattern, flags);
    }
  } catch (error) {
    throw new Error(
      `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function findFilesInDirectory(
  directory: string,
  recursive: boolean,
  filePattern?: string,
  exclude: string[] = [],
  maxFiles: number = 1000
): Promise<string[]> {
  const files: string[] = [];
  const absoluteDir = path.resolve(directory);

  if (!(await fs.pathExists(absoluteDir))) {
    throw new Error(`Directory does not exist: ${absoluteDir}`);
  }

  const stats = await fs.stat(absoluteDir);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${absoluteDir}`);
  }

  await walkDirectory(absoluteDir, files, recursive, filePattern, exclude, maxFiles);
  return files;
}

async function walkDirectory(
  dir: string,
  files: string[],
  recursive: boolean,
  filePattern?: string,
  exclude: string[] = [],
  maxFiles: number = 1000
): Promise<void> {
  if (files.length >= maxFiles) {
    return;
  }

  const entries = await fs.readdir(dir);

  for (const entry of entries) {
    if (files.length >= maxFiles) {
      break;
    }

    const fullPath = path.join(dir, entry);
    const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    // Check if path should be excluded
    if (exclude.some(pattern => matchesPattern(relativePath, pattern))) {
      continue;
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      if (recursive) {
        await walkDirectory(fullPath, files, recursive, filePattern, exclude, maxFiles);
      }
    } else if (stats.isFile()) {
      // Check if file matches pattern
      if (!filePattern || matchesPattern(entry, filePattern)) {
        files.push(fullPath);
      }
    }
  }
}

function matchesPattern(filename: string, pattern: string): boolean {
  // Simple glob pattern matching
  const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');

  // Use case-insensitive matching on Windows and macOS (typical behavior)
  const flags = process.platform === 'linux' ? '' : 'i';
  const regex = new RegExp(`^${regexPattern}$`, flags);
  return regex.test(filename);
}

async function searchInFile(
  filePath: string,
  regex: RegExp,
  contextLines: number,
  maxMatches: number
): Promise<GrepResult> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const matches: GrepMatch[] = [];

    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
      const line = lines[i];
      const match = regex.exec(line);

      if (match) {
        const beforeContext =
          contextLines > 0 ? lines.slice(Math.max(0, i - contextLines), i) : undefined;

        const afterContext =
          contextLines > 0
            ? lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines))
            : undefined;

        matches.push({
          line: i + 1,
          content: line,
          lineNumber: i + 1,
          beforeContext,
          afterContext,
        });

        // Reset regex lastIndex to find multiple matches in the same line
        regex.lastIndex = 0;
      }
    }

    return {
      file: filePath,
      matches,
      totalMatches: matches.length,
    };
  } catch (error) {
    // If UTF-8 fails, it might be a binary file or different encoding
    // Just rethrow to let the caller handle it
    throw new Error(
      `Cannot read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
export const FileGrepTool = new DynamicStructuredTool({
  name: 'file-grep',
  description: 'Find files and directories matching name patterns',
  schema: z.object({
    pattern: z.string().describe('Name pattern to search for (supports glob patterns)'),
    rootDirectory: z
      .string()
      .default(process.cwd())
      .describe('Root directory to start search from (default: current directory)'),
    recursive: z.boolean().default(true).describe('Search recursively in subdirectories'),
    type: z
      .enum(['all', 'file', 'directory'])
      .default('all')
      .describe('Type of items to find: "all", "file", or "directory"'),
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
      .describe('Path patterns to exclude from search'),
    maxDepth: z.number().default(15).describe('Maximum directory depth to search'),
    maxResults: z.number().default(1000).describe('Maximum number of results to return'),
    hidden: z
      .boolean()
      .default(false)
      .describe('Include hidden files and directories (starting with .)'),
    sortBy: z
      .enum(['name', 'path', 'size', 'modified'])
      .default('path')
      .describe('Sort results by name, path, size, or modified time'),
  }),
  func: async (params: Record<string, unknown>) => {
    const {
      pattern,
      rootDirectory = process.cwd(),
      recursive = true,
      type = 'all',
      excludePaths = [
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
      maxDepth = 15,
      maxResults = 1000,
      hidden = false,
      sortBy = 'path',
    } = params;

    if (typeof pattern !== 'string') {
      return { success: false, error: 'Pattern parameter must be a string' };
    }

    if (typeof rootDirectory !== 'string') {
      return { success: false, error: 'Root directory parameter must be a string' };
    }

    try {
      const absoluteRootDir = path.resolve(rootDirectory as string);

      if (!(await fs.pathExists(absoluteRootDir))) {
        return { success: false, error: `Root directory does not exist: ${absoluteRootDir}` };
      }

      const stats = await fs.stat(absoluteRootDir);
      if (!stats.isDirectory()) {
        return { success: false, error: `Root path is not a directory: ${absoluteRootDir}` };
      }

      const results: Array<{
        path: string;
        name: string;
        type: 'file' | 'directory';
        size?: number;
        modified?: Date;
        isHidden: boolean;
      }> = [];

      await findMatches(absoluteRootDir, pattern as string, results, {
        recursive: recursive as boolean,
        type: type as 'all' | 'file' | 'directory',
        excludePaths: Array.isArray(excludePaths) ? (excludePaths as string[]) : [],
        maxDepth: maxDepth as number,
        maxResults: maxResults as number,
        hidden: hidden as boolean,
        currentDepth: 0,
      });

      // Sort results
      const sortedResults = sortResults(results, sortBy as string);

      return {
        success: true,
        data: {
          results: sortedResults,
          totalResults: sortedResults.length,
          rootDirectory: absoluteRootDir,
          pattern,
          type,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `File grep failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

async function findMatches(
  directory: string,
  pattern: string,
  results: Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: Date;
    isHidden: boolean;
  }>,
  options: {
    recursive: boolean;
    type: 'all' | 'file' | 'directory';
    excludePaths: string[];
    maxDepth: number;
    maxResults: number;
    hidden: boolean;
    currentDepth: number;
  }
): Promise<void> {
  // Stop if we've reached maxResults or maxDepth
  if (results.length >= options.maxResults || options.currentDepth > options.maxDepth) {
    return;
  }

  try {
    const entries = await fs.readdir(directory);

    for (const entry of entries) {
      // Stop if we've reached maxResults
      if (results.length >= options.maxResults) {
        return;
      }

      const fullPath = path.join(directory, entry);
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      const isHidden = entry.startsWith('.');

      // Skip hidden files/directories if not requested
      if (isHidden && !options.hidden) {
        continue;
      }

      // Check if path should be excluded
      if (
        options.excludePaths.some(excludePattern => matchGlobPattern(relativePath, excludePattern))
      ) {
        continue;
      }

      const stats = await fs.stat(fullPath);
      const isDirectory = stats.isDirectory();
      const isFile = stats.isFile();
      const type = isDirectory ? 'directory' : 'file';

      // Check if this entry matches the pattern
      const matchesPattern = matchGlobPattern(entry, pattern);

      // Add to results if it matches pattern and type filter
      if (
        matchesPattern &&
        (options.type === 'all' ||
          (options.type === 'file' && isFile) ||
          (options.type === 'directory' && isDirectory))
      ) {
        results.push({
          path: fullPath,
          name: entry,
          type,
          size: isFile ? stats.size : undefined,
          modified: new Date(stats.mtime),
          isHidden,
        });
      }

      // Recurse into directories if requested
      if (isDirectory && options.recursive) {
        await findMatches(fullPath, pattern, results, {
          ...options,
          currentDepth: options.currentDepth + 1,
        });
      }
    }
  } catch (_error) {
    // Skip directories that can't be read due to permissions
    return;
  }
}

function matchGlobPattern(input: string, pattern: string): boolean {
  // Create a regex pattern from the glob pattern
  const regexPattern = pattern
    .replace(/\\/g, '/')
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/{{DOUBLE_STAR}}/g, '.*');

  // Use case-insensitive matching on Windows and macOS (typical behavior)
  const flags = process.platform === 'linux' ? '' : 'i';
  const regex = new RegExp(`^${regexPattern}$`, flags);
  return regex.test(input);
}

function sortResults(
  results: Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: Date;
    isHidden: boolean;
  }>,
  sortBy: string
) {
  return [...results].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'path':
        return a.path.localeCompare(b.path);
      case 'size':
        // Sort directories first, then by size
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return (a.size || 0) - (b.size || 0);
      case 'modified':
        return (a.modified?.getTime() || 0) - (b.modified?.getTime() || 0);
      default:
        return a.path.localeCompare(b.path);
    }
  });
}

export const GrepReplaceTool = new DynamicStructuredTool({
  name: 'grep-replace',
  description: 'Search and replace patterns in files',
  schema: z
    .object({
      pattern: z.string().describe('Pattern to search for'),
      replacement: z.string().describe('Replacement string'),
      files: z
        .array(z.string())
        .optional()
        .describe('Array of file paths to search and replace in'),
      directory: z
        .string()
        .optional()
        .describe('Directory to search in (alternative to files array)'),
      recursive: z.boolean().default(false).describe('Search recursively in subdirectories'),
      isRegex: z.boolean().default(false).describe('Treat pattern as regular expression'),
      ignoreCase: z.boolean().default(false).describe('Case-insensitive search'),
      filePattern: z.string().optional().describe('File pattern to match when searching directory'),
      exclude: z.array(z.string()).default([]).describe('Patterns to exclude from search'),
      dryRun: z
        .boolean()
        .default(false)
        .describe('Preview changes without actually modifying files'),
      backup: z.boolean().default(false).describe('Create backup files before modification'),
    })
    .refine(data => data.files || data.directory, {
      message: 'Either files array or directory must be provided',
    }),
  func: async (params: {
    pattern: string;
    replacement: string;
    files?: string[];
    directory?: string;
    recursive?: boolean;
    isRegex?: boolean;
    ignoreCase?: boolean;
    filePattern?: string;
    exclude?: string[];
    dryRun?: boolean;
    backup?: boolean;
  }) => {
    const {
      pattern,
      replacement,
      files,
      directory,
      recursive = false,
      isRegex = false,
      ignoreCase = false,
      filePattern,
      exclude = [],
      dryRun = false,
      backup = false,
    } = params;

    if (typeof pattern !== 'string' || typeof replacement !== 'string') {
      return { success: false, error: 'Pattern and replacement must be strings' };
    }

    try {
      // First, find all matches using the search tool
      const searchResult = await SearchFileContentTool.invoke({
        pattern,
        files,
        directory,
        recursive,
        isRegex,
        ignoreCase,
        filePattern,
        exclude,
        maxMatches: 10000,
        maxFiles: 1000,
      });

      if (!searchResult.success || !searchResult.data) {
        return searchResult;
      }

      const { results } = searchResult.data as { results: GrepResult[] };
      const modifications: Array<{
        file: string;
        originalContent: string;
        newContent: string;
        matchCount: number;
      }> = [];

      const regex = createRegex(pattern, isRegex as boolean, ignoreCase as boolean);

      for (const result of results) {
        const originalContent = await fs.readFile(result.file, 'utf8');
        const newContent = originalContent.replace(regex, replacement);

        if (originalContent !== newContent) {
          modifications.push({
            file: result.file,
            originalContent,
            newContent,
            matchCount: result.totalMatches,
          });

          if (!dryRun) {
            // Create backup if requested
            if (backup) {
              await fs.copy(result.file, `${result.file}.backup`);
            }

            // Write the modified content
            await fs.writeFile(result.file, newContent, 'utf8');
          }
        }
      }

      return {
        success: true,
        data: {
          modifications,
          totalFiles: modifications.length,
          totalReplacements: modifications.reduce((sum, mod) => sum + mod.matchCount, 0),
          dryRun: dryRun as boolean,
          pattern,
          replacement,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Grep replace failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
