import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

// CLI Integration Tests - Tests the complete CLI application
const cliPath = path.join(__dirname, '../../dist/index.js');
const tempDir = path.join(__dirname, 'temp');
describe('CLI Integration Tests', () => {

  beforeAll(async () => {
    // Ensure CLI is built
    expect(await fs.pathExists(cliPath)).toBe(true);
    
    // Create temp directory for tests
    await fs.ensureDir(tempDir);
  });

  afterAll(async () => {
    // Cleanup temp directory
    await fs.remove(tempDir);
  });

  describe('CLI Execution', () => {
    it('should show help when --help flag is used', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Shell AI');
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Options:');
    });

    it('should show version when --version flag is used', async () => {
      const result = await runCLI(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Should contain version number
    });
   
  });

});


// Helper function to run CLI commands
async function runCLI(
  params: string[], 
  options: { timeout?: number } = {}
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const { timeout = 15000 } = options;
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...params], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI command timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}
