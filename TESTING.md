# Shell AI Test Suite Plan

This document outlines the proposed testing strategy for Shell AI, including test organization, coverage goals, and best practices to follow as development progresses.

## Planned Test Structure

### Core Package Tests (`packages/core/src/`)

#### Configuration Tests
- **Location**: `config/__tests__/config.test.ts`
- **To Cover**: Configuration management, validation, persistence
- **Key Features to Test**:
  - Config loading and saving
  - Environment variable handling
  - Validation of configuration values
  - Default configuration handling

#### Client Tests
- **Location**: `client/__tests__/ollama-client.test.ts`
- **To Cover**: Ollama API integration
- **Key Features to Test**:
  - Model listing and management
  - Text generation
  - Chat functionality
  - Error handling and retries

#### Memory Tests
- **Location**: `memory/__tests__/memory-manager.test.ts`
- **To Cover**: Conversation memory and persistence
- **Key Features to Test**:
  - Memory storage and retrieval
  - Search functionality
  - Statistics and analytics
  - Memory cleanup and limits

#### Agent Tests
- **Location**: `agent/__tests__/langgraph-agent.test.ts`
- **To Cover**: Core agent functionality
- **Key Features to Test**:
  - Tool registration and execution
  - Conversation handling
  - Memory integration
  - Configuration management

#### Tool Tests
- **Location**: `tools/__tests__/`
- **To Cover**: All tool implementations
- **Files to Create**:
  - `file-tools.test.ts` - File operations (read, write, edit)
  - `system-tools.test.ts` - System operations (shell, directory)
  - `grep-tool.test.ts` - Search and replace functionality
  - `memory-tools.test.ts` - Memory manipulation tools
  - `web-search.test.ts` - Web search capabilities
  - `tool-registry.test.ts` - Tool management and execution  

#### Integration Tests
- **Location**: `__tests__/integration.test.ts`
- **To Cover**: End-to-end system functionality
- **Key Features to Test**:
  - Complete workflow testing
  - Tool chaining
  - Error recovery
  - Performance testing

### CLI Package Tests (`packages/cli/src/`)

#### CLI Component Tests
- **Location**: `cli/__tests__/`
- **Files to Create**:
  - `command-processor.test.ts` - Command parsing and execution
  - `agent-chat.test.ts` - Chat interface component
  - `interactive-chat.test.ts` - Interactive terminal interface
  - `autocomplete.test.ts` - Command completion
  - `langgraph-agent-adapter.test.ts` - Agent integration
  - `native-agent-processor.test.ts` - Native processing

#### CLI Integration Tests
- **Location**: `__tests__/cli-integration.test.ts`
- **To Cover**: Complete CLI application testing
- **Key Features to Test**:
  - Command-line argument parsing
  - Exit codes and error handling
  - Output formatting
  - Performance benchmarks

## Test Categories

### Unit Tests
- **Purpose**: Test individual components in isolation
- **Scope**: Single functions, classes, or modules
- **Tools**: Jest with mocking
- **Location**: `__tests__` directories within each module

### Integration Tests
- **Purpose**: Test interaction between multiple components
- **Scope**: Workflows, tool chains, data flow
- **Tools**: Jest with real dependencies
- **Location**: `__tests__/integration.test.ts`

### End-to-End Tests
- **Purpose**: Test complete user workflows
- **Scope**: CLI commands, interactive sessions
- **Tools**: Child process spawning, file system operations
- **Location**: `__tests__/cli-integration.test.ts`

### Performance Tests
- **Purpose**: Ensure acceptable performance characteristics
- **Scope**: Response times, memory usage, concurrency
- **To Be Included in**: Integration and E2E tests

## Target Test Coverage

### Coverage Targets
- **Statements**: > 85%
- **Branches**: > 80%
- **Functions**: > 90%
- **Lines**: > 85%

### Coverage Areas to Implement

#### Core Package
- ⏳ Configuration management (Target: 95%)
- ⏳ Ollama client (Target: 90%)
- ⏳ Memory management (Target: 92%)
- ⏳ Tool system (Target: 88%)
- ⏳ Agent functionality (Target: 85%)

#### CLI Package
- ⏳ Command processing (Target: 87%)
- ⏳ Interactive interface (Target: 83%)
- ⏳ Agent integration (Target: 89%)
- ⏳ Auto-completion (Target: 91%)

## Running Tests (To Be Implemented)

### All Tests
```bash
npm test
```

### Package-Specific Tests
```bash
# Core package only
npm run test:core

# CLI package only
npm run test:cli
```

### Integration Tests
```bash
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Custom Test Runner (Planned)
```bash
# Run specific test categories
node test-runner.js category tools
node test-runner.js category memory
node test-runner.js category cli

# Run specific packages
node test-runner.js core
node test-runner.js cli

# List available tests
node test-runner.js list
```

## Testing Strategy

### Mocking Strategy
- **External Dependencies**: All external APIs and services will be mocked
- **File System**: `fs-extra` will be mocked for predictable testing
- **Network Requests**: HTTP clients will be mocked
- **Time-based Operations**: Timers will be mocked when necessary

### Test Data
- **Configuration**: Test configurations in `jest.setup.js`
- **Mock Responses**: Predefined mock data for consistent testing
- **Temporary Files**: Will be created in `/tmp` with automatic cleanup

### Assertions
- **Success/Failure**: All tool operations should return success/error status
- **Data Validation**: Response data structure validation
- **Error Messages**: Meaningful error message testing
- **Performance**: Response time assertions for critical paths

## Best Practices to Follow

### Test Organization
1. **Describe Blocks**: Group related tests logically
2. **Setup/Teardown**: Use `beforeEach`/`afterEach` for clean state
3. **Descriptive Names**: Test names should clearly indicate what is being tested
4. **Single Assertion**: Each test should verify one specific behavior

### Test Data
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up temporary files and data
3. **Realistic Data**: Use realistic test data that mirrors real usage
4. **Edge Cases**: Include boundary conditions and error scenarios

### Mocking Guidelines
1. **Minimal Mocking**: Mock only what's necessary
2. **Behavior Testing**: Focus on testing behavior, not implementation
3. **Mock Verification**: Verify that mocks are called correctly
4. **Reset Mocks**: Clear mock state between tests

### Performance Testing
1. **Timeouts**: Set reasonable timeouts for async operations
2. **Memory Leaks**: Monitor for memory leaks in long-running tests
3. **Concurrency**: Test concurrent operations where applicable
4. **Load Testing**: Include tests with realistic data volumes

## Continuous Integration (To Be Set Up)

### GitHub Actions
- **On Push**: Run all tests on every push
- **On PR**: Full test suite including integration tests
- **Coverage**: Upload coverage reports to codecov
- **Node Versions**: Test on Node.js 18.x and 20.x

### Pre-commit Hooks
- **Linting**: ESLint checks before commit
- **Type Checking**: TypeScript compilation
- **Test Suite**: Fast unit tests only
- **Formatting**: Prettier formatting

## Debugging Tests

### Anticipated Issues
1. **Async Timing**: Use proper `await` and timeout handling
2. **Mock State**: Ensure mocks are reset between tests
3. **File Paths**: Use absolute paths in tests
4. **Environment**: Check for environment-specific behavior

### Debug Tools to Use
1. **Jest Debug**: `node --inspect-brk node_modules/.bin/jest`
2. **Console Logging**: Strategic console.log statements
3. **Test Isolation**: Run single tests with `jest -t "test name"`
4. **Coverage Analysis**: Use coverage reports to find untested code

## Future Test Improvements

### Planned Enhancements
1. **Visual Regression**: Screenshot testing for CLI output
2. **Load Testing**: Automated performance regression testing
3. **Mutation Testing**: Test the quality of tests themselves
4. **Property-Based Testing**: Generate test cases automatically

### Test Environment
1. **Containerization**: Docker-based test environments
2. **Database Testing**: In-memory database for integration tests
3. **Service Mocking**: Mock external services more comprehensively
4. **Cross-Platform**: Test on Windows, macOS, and Linux

## Contributing to Tests

### Adding New Tests
1. Follow existing test structure and naming conventions
2. Include both positive and negative test cases
3. Add integration tests for new features
4. Update test documentation

### Test Review Checklist
- [ ] Tests are independent and isolated
- [ ] All edge cases are covered
- [ ] Error conditions are tested
- [ ] Performance implications are considered
- [ ] Tests are maintainable and readable

### Reporting Issues
1. Include test output and error messages
2. Provide steps to reproduce
3. Include environment information
4. Suggest potential fixes if possible

## Metrics and Monitoring (To Be Implemented)

### Test Metrics to Track
- **Execution Time**: Track test suite performance
- **Flaky Tests**: Identify and fix unreliable tests
- **Coverage Trends**: Monitor coverage over time
- **Failure Rates**: Track test reliability

### Quality Gates
- **Minimum Coverage**: 85% overall coverage required
- **No Flaky Tests**: All tests must pass consistently
- **Performance Bounds**: Tests must complete within time limits
- **Zero Critical Issues**: No critical security or functionality issues
