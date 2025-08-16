// Global test setup
import 'jest';

// Mock external dependencies
jest.mock('ollama', () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    list: jest.fn(),
    generate: jest.fn(),
    chat: jest.fn(),
    pull: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  readJsonSync: jest.fn(),
  writeJsonSync: jest.fn(),
  existsSync: jest.fn(),
  ensureDirSync: jest.fn(),
}));

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

// Console mocks for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Extend Jest matchers
expect.extend({
  toBeValidJSON(received) {
    try {
      JSON.parse(received);
      return {
        message: () => `Expected ${received} not to be valid JSON`,
        pass: true,
      };
    } catch {
      return {
        message: () => `Expected ${received} to be valid JSON`,
        pass: false,
      };
    }
  },
});
