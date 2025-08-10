<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AI-CLI Project Instructions

This is a TypeScript monorepo project that recreates Google's Gemini-CLI functionality using Ollama for local AI processing.

## Project Structure

- `packages/core`: Core functionality including Ollama client, tools, memory management, and plugins
- `packages/cli`: Interactive command-line interface with React-based UI using Ink

## Key Features

- **Local AI Processing**: Uses Ollama instead of cloud APIs for privacy
- **Tool System**: Extensible tools for file operations, shell commands, etc.
- **Memory Management**: Conversation and context persistence
- **Plugin System**: Extensible architecture for custom functionality
- **Interactive UI**: Terminal-based chat interface with slash commands

## Development Guidelines

1. Use TypeScript with strict type checking
2. Follow the existing architecture patterns
3. All tools should extend `BaseTool` from core package
4. Commands should implement the `SlashCommand` interface
5. Use the memory system for context persistence
6. Handle errors gracefully with user-friendly messages
7. Always handle paths as absolute paths to avoid issues

## Code Style

- Use ESLint and Prettier for consistent formatting
- Import order: external, internal, relative
- Use async/await for asynchronous operations
- Prefer composition over inheritance where possible

## Testing

- Write tests for all core functionality
- Use Jest for testing framework
- Mock external dependencies (Ollama, file system)

## Architecture Notes

- The core package provides all base functionality
- The CLI package focuses on user interaction and presentation
- Tools are registered in a central registry
- Configuration is managed through a centralized config manager
- Memory system supports different types of context (conversation, file, command)
