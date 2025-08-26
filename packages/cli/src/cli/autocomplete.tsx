import path from 'path';
import fs from 'fs/promises';

import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

export interface AutocompleteOption {
  value: string;
  description: string;
  type: 'command' | 'file' | 'folder';
  icon?: string;
}

interface AutocompleteProps {
  selectedIndex: number;
  options: AutocompleteOption[];
  maxItems?: number;
}

export class AutocompleteManager {
  private currentWorkingDirectory: string = process.cwd();

  private slashCommands: AutocompleteOption[] = [
    {
      value: 'help',
      description: 'Show available commands and features',
      type: 'command',
      icon: figures.info,
    },
    { value: 'quit', description: 'Exit the Shell AI agent', type: 'command', icon: figures.cross },
    { value: 'exit', description: 'Exit the Shell AI agent', type: 'command', icon: figures.cross },
    {
      value: 'clear',
      description: 'Clear Screen',
      type: 'command',
      icon: figures.bullet,
    },
    {
      value: 'model',
      description: 'Switch AI model. Usage: /model gpt-oss',
      type: 'command',
      icon: figures.pointer,
    },
    {
      value: 'info',
      description: 'Show agent status and capabilities',
      type: 'command',
      icon: figures.info,
    },
    {
      value: 'mcp',
      description: 'List Model Context Protocol (MCP) tools',
      type: 'command',
      icon: '🔨',
    },
    // {
    //   value: 'history',
    //   description: 'Show conversation history',
    //   type: 'command',
    //   icon: figures.line,
    // },
    // {
    //   value: 'save',
    //   description: 'Save current conversation',
    //   type: 'command',
    //   icon: figures.tick,
    // },
    // {
    //   value: 'load',
    //   description: 'Load a saved conversation',
    //   type: 'command',
    //   icon: figures.arrowUp,
    // },
    // {
    //   value: 'tools',
    //   description: 'List available tools and their status',
    //   type: 'command',
    //   icon: figures.pointer,
    // },
    // {
    //   value: 'config',
    //   description: 'Show or modify configuration',
    //   type: 'command',
    //   icon: figures.pointer,
    // },
    // { value: 'plugins', description: 'Manage plugins', type: 'command', icon: figures.play },
  ];

  async getSlashCompletions(query: string): Promise<AutocompleteOption[]> {
    const searchTerm = query.toLowerCase();
    return this.slashCommands.filter(
      cmd => cmd.value.toLowerCase().includes(searchTerm)
      //    ||
      //   cmd.description.toLowerCase().includes(searchTerm)
    );
  }

  async getFileCompletions(query: string, currentPath?: string): Promise<AutocompleteOption[]> {
    try {
      const basePath = currentPath || this.currentWorkingDirectory;

      // Check if query ends with a slash
      const endsWithSlash = query.endsWith('/') || query.endsWith('\\');

      // Determine the correct search path
      let searchPath: string;
      if (endsWithSlash && (query.includes('/') || query.includes('\\'))) {
        // If query ends with slash, use the entire query as the directory path
        searchPath = path.resolve(basePath, query);
      } else if (query.includes('/') || query.includes('\\')) {
        // If query contains but doesn't end with slash, use dirname
        searchPath = path.resolve(basePath, path.dirname(query));
      } else {
        // No slashes in query, use base path
        searchPath = basePath;
      }

      // If query ends with slash, we want to show all contents of that directory
      const searchTerm = endsWithSlash
        ? ''
        : query.includes('/') || query.includes('\\')
          ? path.basename(query).toLowerCase()
          : query.toLowerCase();

      const items = await fs.readdir(searchPath, { withFileTypes: true });
      const completions: AutocompleteOption[] = [];

      for (const item of items) {
        // Modified condition: only filter if searchTerm exists and doesn't match
        if (searchTerm !== '' && !item.name.toLowerCase().includes(searchTerm)) {
          continue;
        }

        const fullPath = path.join(searchPath, item.name);
        const relativePath = path.relative(this.currentWorkingDirectory, fullPath);

        if (item.isDirectory()) {
          completions.push({
            value: relativePath + path.sep,
            description: `Directory - ${item.name}`,
            type: 'folder',
            icon: figures.pointer,
          });
        } else {
          const ext = path.extname(item.name);
          let description = `File - ${item.name}`;

          // Add file type context
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            description += ' (TypeScript/JavaScript)';
          } else if (['.json'].includes(ext)) {
            description += ' (JSON)';
          } else if (['.md', '.txt'].includes(ext)) {
            description += ' (Text/Markdown)';
          } else if (['.py'].includes(ext)) {
            description += ' (Python)';
          }

          completions.push({
            value: relativePath,
            description,
            type: 'file',
            icon: figures.bullet,
          });
        }
      }

      return completions.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.value.localeCompare(b.value);
      });
    } catch (_error) {
      return [];
    }
  }

  setWorkingDirectory(path: string): void {
    this.currentWorkingDirectory = path;
  }
}

export const Autocomplete = React.memo(
  ({ selectedIndex, options, maxItems = 7 }: AutocompleteProps) => {
    if (options.length === 0) {
      return null;
    }
    // Copy the options to avoid mutation issues and handle pagination
    const displayOptions = [...options];

    // Calculate which subset of options to show based on selectedIndex
    let startIndex = 0;
    if (selectedIndex >= maxItems) {
      // If selected index is beyond maxItems, adjust the view window
      startIndex = Math.max(0, selectedIndex - maxItems + 1);
    }

    const visibleOptions = displayOptions.slice(startIndex, startIndex + maxItems);
    const currentSelectedIndex = selectedIndex - startIndex;

    return (
      <Box flexDirection="column" padding={1} marginBottom={1} width={'80%'}>
        {visibleOptions.slice(0, maxItems).map((option, index) => (
          <Box key={option.value}>
            <Text color={index === currentSelectedIndex ? 'cyan' : 'white'}>
              {option.icon || figures.bullet} {option.value}
            </Text>
            <Text color={index === currentSelectedIndex ? 'cyan' : 'gray'}>
              {' '}
              - {option.description}
            </Text>
          </Box>
        ))}
        {options.length > maxItems && (
          <Box marginTop={1}>
            <Text color="gray">
              {figures.ellipsis} {maxItems}+ results (keep typing to filter)
            </Text>
          </Box>
        )}
      </Box>
    );
  }
);

export default Autocomplete;
