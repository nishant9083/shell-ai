# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-08-30

### Added
- **Model Context Protocol (MCP) Integration**: Full support for connecting to MCP servers
  - HTTP, SSE, and STDIO transport support
  - Multiple authentication methods (Bearer, Basic, API Key, OAuth2)
  - Automatic tool discovery and registration from MCP servers
  - Configurable MCP servers via `~/.shell-ai/mcp.json`
  - Connection management with auto-reconnect capabilities
- **Enhanced Logging System**: Comprehensive logging infrastructure
  - Interactive log viewer with keyboard navigation (`/logs` command)
  - Real-time log filtering by level (info, warn, error, debug)
  - Structured log entries with timestamps and source tracking
  - Log persistence and cleanup mechanisms
- **Improved Terminal UI**: Better user experience with enhanced interface
  - New LogViewer component with React-based terminal UI
  - Keyboard shortcuts for log navigation (arrow keys, page up/down)
  - Log filtering shortcuts (1-5 keys for different levels)
  - Terminal size adaptation for responsive layout

### Enhanced
- **Tool Registry**: Extended to support dynamic MCP tools
- **Agent System**: Improved integration with external MCP tools
- **Configuration**: Enhanced config management for MCP servers
- **Error Handling**: Better error reporting and recovery mechanisms

### Technical
- Added `@modelcontextprotocol/sdk` dependency for MCP support
- Enhanced TypeScript interfaces for MCP configuration and tools
- Improved async handling for external tool connections
- Added comprehensive logging utilities and interfaces

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
