# Shell AI

A powerful, intelligent shell assistant powered by local AI models through Ollama. Shell AI brings advanced AI capabilities directly to your terminal, enabling natural language interaction with your file system, shell commands, and development workflow.

A powerful, lightweight command-line interface for interacting with local AI models (powered by Ollama). This project is inspired by Google’s Gemini-CLI, adapted to run locally and enhanced with powerful agentic capabilities.

[![NPM Version](https://img.shields.io/npm/v/@shell-ai/cli.svg)](https://www.npmjs.com/package/@shell-ai/cli)
[![GitHub Stars](https://img.shields.io/github/stars/nishant9083/shell-ai.svg)](https://github.com/nishant9083/shell-ai)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Issues](https://img.shields.io/github/issues/nishant9083/shell-ai.svg)](https://github.com/nishant9083/shell-ai/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/nishant9083/shell-ai/blob/main/CONTRIBUTING.md)

## Features
- 🧠 **Intelligent Agent**: Utilizes a ReAct (Reason-Act) agent model, allowing it to reason about your requests and use a set of tools to accomplish complex tasks.
- 🔗 **Model Context Protocol (MCP) Integration**: Connect to external MCP servers to extend functionality with custom tools and services.
- 🎯 **Zero-Network Inference**: Runs entirely on your machine using Ollama, ensuring privacy and offline functionality.
- 🛠️ **Extensive Toolset**: Comes with a rich set of tools for file system operations, shell command execution, web searching, and more.
- 📊 **Enhanced Logging**: Interactive log viewer with real-time filtering and navigation for better debugging and monitoring.
- ⚙️ **TypeScript Support**: Fully typed with TS 5.x for robust development.
- 📦 **Modular Workspace**: Separated `core` and `cli` packages for clean architecture and maintainability.

## Table of Contents
- [Shell AI](#shell-ai)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Options](#options)
  - [Interaction Modes](#interaction-modes)
    - [Interactive Chat](#interactive-chat)
    - [Slash Commands](#slash-commands)
  - [Available Tools](#available-tools)
  - [Model Context Protocol (MCP) Integration](#model-context-protocol-mcp-integration)
    - [MCP Configuration](#mcp-configuration)
    - [Supported Transport Types](#supported-transport-types)
    - [Authentication Methods](#authentication-methods)
    - [Available MCP Tools](#available-mcp-tools)
  - [Logging and Debugging](#logging-and-debugging)
    - [Interactive Log Viewer](#interactive-log-viewer)
    - [Log Levels](#log-levels)
  - [Configuration](#configuration)
  - [Development](#development)
    - [Publishing](#publishing)
  - [Contributing](#contributing)
  - [License](#license)

https://github.com/user-attachments/assets/12a96147-797e-48a2-9fa3-3824d5b050fe

## Installation
```bash
npm install -g @shell-ai/cli
```
Or run directly with npx:
```bash
npx @shell-ai/cli
```

Make sure you have [Ollama](https://ollama.ai/) installed and a model pulled:
```bash
ollama pull gpt-oss
```

## Usage
```bash
# Start an interactive chat session
shell-ai

# Use a specific model
shell-ai --model mistral
```

### Options
| Option                     | Description                     |
| -------------------------- | ------------------------------- |
| `-m, --model <model>`      | Specify the Ollama model.       |
| `-t, --temperature <temp>` | Set the model's temperature.    |
| `-s, --system <prompt>`    | Provide a custom system prompt. |
| `-h, --help`               | Show help.                      |

## Interaction Modes

### Interactive Chat
Run `shell-ai` without any arguments to start an interactive session. You can chat with the AI, and it will use its tools to answer questions or perform tasks.

```
$ shell-ai
> What is the current directory?
... agent thinking ...
> The current directory is /home/user/project. It contains 5 files and 2 directories.
> /help
... shows help menu ...
```

### Slash Commands
Inside the interactive chat, you can use slash commands for specific actions:

| Command  | Description                             |
| -------- | --------------------------------------- |
| `/help`  | Show available commands and tools.      |
| `/model` | Switch between available Ollama models. |
| `/info`  | Display statistics about the agent.     |
| `/clear` | Clear the current conversation history. |
| `/exit`  | End the current session.                |


## Available Tools
The agent has access to the following tools to perform tasks:

| Tool                  | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `file-read`           | Read the contents of a file.                            |
| `file-write`          | Write content to a file.                                |
| `file-edit`           | Edit specific lines or perform find-and-replace.        |
| `file-search`         | Search for text patterns in files.                      |
| `shell-exec`          | Execute shell commands. **Requires user confirmation.** |
| `directory-list`      | List files and directories in a path.                   |
| `current-directory`   | Get the current working directory and its contents.     |
| `web-search`          | Perform a web search.                                   |
| `wikipedia-search`    | Search for articles on Wikipedia.                       |
| `memory-add`          | Add a fact to the agent's long-term memory.             |
| `memory-retrieve`     | Retrieve facts from the agent's memory.                 |
| `search-file-content` | A powerful grep-like tool to find content in files.     |

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

### Available MCP Tools

Once connected, MCP servers automatically expose their tools to the Shell AI agent. Tools are discovered dynamically and integrated into the existing tool registry.

## Logging and Debugging

Shell AI includes a comprehensive logging system to help you monitor and debug agent operations:

### Interactive Log Viewer

Access the log viewer using the `/logs` slash command. The viewer provides:

- **Real-time Log Updates**: See logs as they're generated
- **Level Filtering**: Filter by log level (info, warn, error, debug)
- **Keyboard Navigation**: 
  - Arrow keys: Navigate through logs
  - Page Up/Down: Scroll through multiple pages
  - Number keys (1-5): Quick filter by level
  - 'c': Clear all logs
  - 'q' or Escape: Exit viewer

### Log Levels

- **Info**: General information about operations
- **Warn**: Warning messages that don't stop execution
- **Error**: Error messages for failed operations
- **Debug**: Detailed debugging information

Log entries include timestamps, source information, and structured details for comprehensive debugging.

## Configuration
You can set defaults via a `.shell-ai-config` file in your home directory.

## Development
The repository is a monorepo using npm workspaces.

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

### Publishing
```bash
# Build and test before publishing
npm run prepublishOnly

# Publish the CLI package
npm publish --workspace @shell-ai/cli --access public

# Publish the core package
npm publish --workspace @shell-ai/core --access public
```

## Contributing
We welcome issues and pull requests! Please read the `CONTRIBUTING.md` guide for details.

1. Fork the repo.
2. Create a feature branch.
3. Run tests and lint.
4. Open a pull request.

## License
Apache-2.0 © 2025 Shell AI Team