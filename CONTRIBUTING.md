# Contributing to Shell AI

Thank you for your interest in contributing to Shell AI! This guide will help you get started with contributing to our project.

## Getting Started

### Prerequisites

- Node.js >= 20.18.1
- npm >= 8.0.0
- [Ollama](https://ollama.ai/) installed and running
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/shell-ai.git
   cd shell-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start development**
   ```bash
   npm run dev
   ```

## Project Structure

```
shell-ai/
├── packages/
│   ├── core/           # Core functionality
│   │   ├── src/
│   │   │   ├── agent/     # LangGraph agent implementation
│   │   │   ├── client/    # Ollama client
│   │   │   ├── config/    # Configuration management
│   │   │   ├── memory/    # Memory management
│   │   │   ├── prompts/   # System prompts
│   │   │   ├── tools/     # Tool implementations
│   │   │   ├── types/     # TypeScript type definitions
│   │   │   └── utils/     # Utility functions
│   │   └── package.json
│   └── cli/            # CLI interface
│       ├── src/
│       │   ├── cli/       # CLI implementation
│       │   ├── ui/        # Terminal UI components
│       │   └── types/     # TypeScript type definitions
│       └── package.json
├── scripts/            # Build and utility scripts
└── package.json       # Root package.json
```

## Development Workflow

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run all tests
   npm test
   
   # Type checking
   npm run type-check
   
   # Linting
   npm run lint
   
   # Build to ensure no compilation errors
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `style:` for formatting changes
   - `refactor:` for code refactoring
   - `test:` for adding tests
   - `chore:` for maintenance tasks

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```


### Code Style

- **TypeScript**: We use TypeScript for type safety
- **ESLint**: Enforced code style (run `npm run lint`)
- **Prettier**: Code formatting (run `npm run format`)
- **Import Order**: Organized imports (external, internal, relative)

### Testing

- **Unit Tests**: Jest for unit testing
- **Integration Tests**: Test tool integrations
- **E2E Tests**: Test CLI functionality

```bash
# Run specific test file
npm test -- my-tool.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Pull Request Process

1. **Ensure CI passes**
   - All tests pass
   - Code is properly formatted
   - TypeScript compiles without errors

2. **Write a clear PR description**
   - What does this PR do?
   - Why is this change needed?
   - How to test the changes?

3. **Request review**
   - Tag relevant maintainers
   - Be responsive to feedback

4. **Update based on feedback**
   - Address all review comments
   - Make requested changes

## Release Process

Releases are handled by maintainers:

1. Version bump in package.json
2. Update CHANGELOG.md
3. Create GitHub release
4. Publish to npm

## Getting Help

- **Issues**: Check existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community Discord server

## Areas for Contribution

- **New Tools**: Add tools for different use cases
- **UI Improvements**: Enhance the terminal interface
- **Documentation**: Improve guides and examples
- **Performance**: Optimize tool execution
- **Testing**: Increase test coverage
- **Bug Fixes**: Fix reported issues

## Thank You!

Every contribution, no matter how small, is valuable to the Shell AI community. Thank you for helping make Shell AI better!
