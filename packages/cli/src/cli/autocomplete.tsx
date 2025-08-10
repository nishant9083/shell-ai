import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import path from 'path';
import fs from 'fs/promises';

export interface AutocompleteOption {
  value: string;
  description: string;
  type: 'command' | 'file' | 'folder';
  icon?: string;
}

interface AutocompleteProps {
  input: string;
  selectedIndex: number;
  options: AutocompleteOption[];
  maxItems?: number;
}

export class AutocompleteManager {
  private currentWorkingDirectory: string = process.cwd();

  private slashCommands: AutocompleteOption[] = [
    { value: 'help', description: 'Show available commands and features', type: 'command', icon: figures.info },
    { value: 'quit', description: 'Exit the AI-CLI agent', type: 'command', icon: figures.cross },
    { value: 'exit', description: 'Exit the AI-CLI agent', type: 'command', icon: figures.cross },
    { value: 'clear', description: 'Clear conversation history', type: 'command', icon: figures.bullet },
    { value: 'model', description: 'Switch AI model or show current model', type: 'command', icon: figures.pointer },
    { value: 'status', description: 'Show agent status and capabilities', type: 'command', icon: figures.info },
    { value: 'history', description: 'Show conversation history', type: 'command', icon: figures.line },
    { value: 'save', description: 'Save current conversation', type: 'command', icon: figures.tick },
    { value: 'load', description: 'Load a saved conversation', type: 'command', icon: figures.arrowUp },
    { value: 'tools', description: 'List available tools and their status', type: 'command', icon: figures.pointer },
    { value: 'config', description: 'Show or modify configuration', type: 'command', icon: figures.pointer },
    { value: 'plugins', description: 'Manage plugins', type: 'command', icon: figures.play },
  ];

  async getSlashCompletions(query: string): Promise<AutocompleteOption[]> {
    const searchTerm = query.toLowerCase();
    return this.slashCommands.filter(cmd => 
      cmd.value.toLowerCase().includes(searchTerm) || 
      cmd.description.toLowerCase().includes(searchTerm)
    );
  }

  async getFileCompletions(query: string, currentPath?: string): Promise<AutocompleteOption[]> {
    try {
      const basePath = currentPath || this.currentWorkingDirectory;
      const searchPath = query.includes('/') || query.includes('\\') 
        ? path.resolve(basePath, path.dirname(query))
        : basePath;
      
      const searchTerm = query.includes('/') || query.includes('\\')
        ? path.basename(query).toLowerCase()
        : query.toLowerCase();

      const items = await fs.readdir(searchPath, { withFileTypes: true });
      const completions: AutocompleteOption[] = [];

      for (const item of items) {
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) {
          continue;
        }

        const fullPath = path.join(searchPath, item.name);
        const relativePath = path.relative(this.currentWorkingDirectory, fullPath);

        if (item.isDirectory()) {
          completions.push({
            value: relativePath + path.sep,
            description: `Directory - ${item.name}`,
            type: 'folder',
            icon: figures.pointer
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
            icon: figures.bullet
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
    } catch (error) {
      return [];
    }
  }

  setWorkingDirectory(path: string): void {
    this.currentWorkingDirectory = path;
  }
}

export const Autocomplete= React.memo(({ input, selectedIndex, options, maxItems = 8 }:AutocompleteProps) => {
  if (options.length === 0) {
    return null;
  }
    // Copy the options to avoid mutation issues and handle pagination
    const totalOptions = options.length;
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
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="gray" dimColor>
          {input.startsWith('/') ? '🔧 Commands' : '📁 Files & Folders'} 
          <Text color="cyan"> (↑↓ to navigate, Tab to select)</Text>
        </Text>
      </Box>
      {visibleOptions.slice(0,maxItems).map((option, index) => (
        <Box key={option.value}>
          <Text color={index === currentSelectedIndex ? 'cyan' : 'white'} 
                >
            {option.icon || figures.bullet} {option.value}
          </Text>
          <Text color={index === currentSelectedIndex ? 'cyan' : "gray"} > - {option.description}</Text>
        </Box>
      ))}
      {options.length > maxItems && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {figures.ellipsis} {maxItems}+ results (keep typing to filter)
          </Text>
        </Box>
      )}
    </Box>
  );
});

export default Autocomplete;
