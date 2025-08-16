# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-16

### Added
- Initial release of Shell AI
- Interactive command-line interface for local AI models
- Integration with Ollama for local AI inference
- ReAct agent model with reasoning capabilities
- Comprehensive toolset for file operations, shell commands, and web search
- Memory management for conversation persistence
- TypeScript support with full type definitions
- Modular workspace architecture with core and CLI packages
- Zero-network inference for privacy

### Features
- **Core Tools**: File read/write/edit, directory listing, shell execution
- **Search Tools**: Web search, Wikipedia integration, content search
- **Memory Tools**: Add, retrieve, and manage conversation memory
- **Agent Commands**: Help, tools listing, model management
- **Configuration**: Environment variables and config file support

### Technical
- Built with TypeScript 5.x
- ESM modules for modern Node.js
- Commander.js for CLI interface
- Chalk for terminal styling
- Ink for React-based terminal UI components
- ESLint and Prettier for code quality
