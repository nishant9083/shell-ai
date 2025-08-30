# @shell-ai/core

Core functionality for Shell AI - providing the foundation for local AI model integration, tools, and utilities.

[![NPM Version](https://img.shields.io/npm/v/@shell-ai/core.svg)](https://www.npmjs.com/package/@shell-ai/core)
[![GitHub Stars](https://img.shields.io/github/stars/nishant9083/shell-ai.svg)](https://github.com/nishant9083/shell-ai)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Issues](https://img.shields.io/github/issues/nishant9083/shell-ai.svg)](https://github.com/nishant9083/shell-ai/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/nishant9083/shell-ai/blob/main/CONTRIBUTING.md)

## Overview

This package contains the core functionality of Shell AI, including:

- **Ollama Client**: Integration with Ollama for local AI model inference
- **Tool System**: Extensible tool framework for file operations, shell commands, and more
- **Memory Management**: Conversation persistence and retrieval
- **Configuration Management**: User preferences and settings
- **Plugin System**: Extensible architecture for custom tools
- **Agent System**: LangGraph-based agent orchestration
- **Model Context Protocol (MCP) Integration**: Support for connecting to MCP servers and utilizing external tools
- **Logging and Debugging**: Comprehensive logging system for monitoring and debugging agent operations

## Installation

```bash
npm install @shell-ai/core
```

## Usage

```typescript
import { 
  OllamaClient, 
  ConfigManager, 
  MemoryManager, 
  ToolRegistry 
} from '@shell-ai/core';

// Initialize the Ollama client
const client = new OllamaClient('http://localhost:11434');

// Configure the system
const config = new ConfigManager();
config.updateConfig({ currentModel: 'llama3' });

// Set up memory management
const memory = new MemoryManager(config.getConfig());

// Access available tools
const tools = new ToolRegistry();
console.log(tools.listTools());
```

## Available Tools

- **File Operations**: Read, write, edit, and search files
- **Shell Commands**: Execute system commands with confirmation
- **Web Search**: Search the web and Wikipedia
- **Memory Tools**: Store and retrieve conversation context
- **Directory Operations**: List and navigate directories

## Configuration

The core package handles configuration through:

- Configuration files (~/.shell-ai/config.json)
- Runtime configuration updates

## License

Apache-2.0 © 2025 Shell AI Team
