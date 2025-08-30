# @shell-ai/cli

Interactive command-line interface for Shell AI with Ollama backend.

[![NPM Version](https://img.shields.io/npm/v/@shell-ai/cli.svg)](https://www.npmjs.com/package/@shell-ai/cli)
[![GitHub Stars](https://img.shields.io/github/stars/nishant9083/shell-ai.svg)](https://github.com/nishant9083/shell-ai)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Issues](https://img.shields.io/github/issues/nishant9083/shell-ai.svg)](https://github.com/nishant9083/shell-ai/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/nishant9083/shell-ai/blob/main/CONTRIBUTING.md)


## Overview

This package provides the command-line interface for Shell AI, enabling users to interact with local AI models through a powerful terminal interface with comprehensive model, and memory management.

## Features

- **Interactive Chat**: Real-time conversation with AI models using React-based terminal UI
- **Model Management**: Download, list, and remove Ollama models
- **Configuration Management**: Comprehensive config system with nested key support
- **Memory Management**: Conversation persistence with search and statistics
- **Tool Integration**: Access to Shell AI's complete tool ecosystem
- **Agent Integration**: ReAct agent model with reasoning capabilities

## Installation

### Global Installation

```bash
npm install -g @shell-ai/cli
```

### Direct Usage

```bash
npx @shell-ai/cli
```

## Usage

```bash
shell-ai
```

With options:

```bash
# Use specific model and Ollama URL
shell-ai --model mistral --url http://localhost:11434

# Custom system prompt and temperature
shell-ai --system "You are a coding expert" --temperature 0.9

# Set max tokens
shell-ai --max-tokens 2048
```

## Interactive Mode Commands

Within the interactive chat session, use slash commands:

- `/help` - Show available commands and usage
- `/model` - Switch between models
- `/info` - Show information about the current session
- `/clear` - Clear conversation history
- `/exit` or `/quit` - Exit the interactive session

## Global Options

Available for most commands:

- `-u, --url <url>` - Set Ollama URL (default: http://localhost:11434)
- `-m, --model <model>` - Use specific model
- `-s, --system <prompt>` - Set custom system prompt
- `-t, --temperature <temp>` - Set temperature (0-2)
- `--max-tokens <tokens>` - Set maximum tokens for response

## Configuration

### Configuration File

Shell AI automatically creates and manages a configuration file with settings for:

- Current model selection
- Ollama URL
- System prompts
- Memory settings (max messages, persistence, file path)
- Temperature and token limits

### Example Configuration

```json
{
  "currentModel": "gpt-oss",
  "ollamaUrl": "http://localhost:11434",
  "systemPrompt": "You are a helpful AI assistant",
  "temperature": 0.7,
  "memory": {
    "maxMessages": 50,
    "persistToFile": true,
    "filePath": "~/.shell-ai/memory.json"
  }
}
```

## Model Context Protocol (MCP) Integration

Shell AI supports the Model Context Protocol (MCP), allowing you to extend functionality by connecting to external MCP servers. This enables integration with databases, APIs, custom tools, and third-party services.

### MCP Configuration

Create a configuration file at `~/.shell-ai/mcp.json` to define your MCP servers:

```json
{
  "servers": [
    {
      "name": "github-server",
      "enabled": true,
      "http": {
        "url": "https://api.github.com/mcp",
        "auth": {
          "type": "bearer",
          "token": "your_github_token"
        }
      },
      "description": "GitHub MCP server integration"
    }
  ],
  "globalTimeout": 30000,
  "maxConcurrentConnections": 10,
  "enableAutoReconnect": true
}
```

### Supported Transport Types

- **HTTP**: Standard HTTP connections with authentication support
- **SSE**: Server-Sent Events for real-time communication
- **STDIO**: Local process communication for development

### Authentication Methods

- **Bearer Token**: For OAuth2 and API tokens
- **Basic Auth**: Username/password authentication
- **API Key**: Custom API key headers
- **OAuth2**: Full OAuth2 flow support

*For example checkout the [MCP Example Integration](https://github.com/nishant9083/shell-ai/blob/main/mcp_example.json) for a complete implementation.*

## Memory System

Shell AI includes a sophisticated memory system that:

- Persists conversations across sessions
- Supports different memory types (conversation, file, command)
- Enables searching through past interactions
- Provides detailed statistics and management


## Requirements

- Node.js >= 20.18.1
- [Ollama](https://ollama.ai/) installed and running
- At least one Ollama model downloaded

### Quick Setup

```bash
# Install and start Ollama
# Visit https://ollama.ai/ for installation instructions

# Pull a model
ollama pull gpt-oss

# Start Ollama server (if not running)
ollama serve

# Install and run Shell AI
npm install -g @shell-ai/cli
shell-ai
```

## Troubleshooting

### Ollama Connection Issues

1. Ensure Ollama is running: `ollama serve`
2. Check available models: `ollama list` or `shell-ai model list`
3. Test connection: `shell-ai --url <your-ollama-url> --model <your-model>`

### Permission Issues

If you encounter permission issues with global installation:

```bash
# Use npx instead
npx @shell-ai/cli

# Or install with proper permissions (Unix/macOS)
sudo npm install -g @shell-ai/cli
```

## License

Apache-2.0 © 2025 Shell AI Team
