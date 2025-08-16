# Shell AI

A powerful, intelligent shell assistant powered by local AI models through Ollama. Shell AI brings advanced AI capabilities directly to your terminal, enabling natural language interaction with your file system, shell commands, and development workflow.

A powerful, lightweight command-line interface for interacting with local AI models (powered by Ollama). This project is inspired by Google’s Gemini-CLI, adapted to run locally and enhanced with powerful agentic capabilities.

## Features
- 🧠 **Intelligent Agent**: Utilizes a ReAct (Reason-Act) agent model, allowing it to reason about your requests and use a set of tools to accomplish complex tasks.
- 🎯 **Zero-Network Inference**: Runs entirely on your machine using Ollama, ensuring privacy and offline functionality.
- 🛠️ **Extensive Toolset**: Comes with a rich set of tools for file system operations, shell command execution, web searching, and more.
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
  - [Configuration](#configuration)
  - [Development](#development)
    - [Publishing](#publishing)
  - [Contributing](#contributing)
  - [License](#license)

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
| Option | Description |
|--------|-------------|
| `-m, --model <model>` | Specify the Ollama model. |
| `-t, --temperature <temp>` | Set the model's temperature. |
| `-s, --system <prompt>` | Provide a custom system prompt. |
| `-h, --help` | Show help. |

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

| Command | Description |
|---|---|
| `/help` | Show available commands and tools. |
| `/model` | Switch between available Ollama models. |
| `/info` | Display statistics about the agent. |
| `/clear` | Clear the current conversation history. |
| `/exit` | End the current session. |


## Available Tools
The agent has access to the following tools to perform tasks:

| Tool | Description |
|---|---|
| `file-read` | Read the contents of a file. |
| `file-write` | Write content to a file. |
| `file-edit` | Edit specific lines or perform find-and-replace. |
| `file-search` | Search for text patterns in files. |
| `shell-exec` | Execute shell commands. **Requires user confirmation.** |
| `directory-list` | List files and directories in a path. |
| `current-directory` | Get the current working directory and its contents. |
| `web-search` | Perform a web search. |
| `wikipedia-search` | Search for articles on Wikipedia. |
| `memory-add` | Add a fact to the agent's long-term memory. |
| `memory-retrieve` | Retrieve facts from the agent's memory. |
| `search-file-content` | A powerful grep-like tool to find content in files. |

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
