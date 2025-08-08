import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { AppConfig } from '../types/index.js';

const DEFAULT_CONFIG: AppConfig = {
  ollamaUrl: 'http://localhost:11434',
  defaultModel: 'llama3.2',
  currentModel: 'llama3.2',
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: 'You are AI-CLI, a helpful AI assistant that can help with various tasks including file operations, shell commands, and general assistance. Always provide clear and accurate responses.',
  workingDirectory: process.cwd(),
  enabledTools: ['file-read', 'file-write', 'file-edit', 'file-search', 'shell-exec', 'directory-list'],
  plugins: [],
  memory: {
    maxMessages: 100,
    persistToFile: true,
    filePath: path.join(os.homedir(), '.ai-cli', 'memory.json')
  }
};

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }

  private getDefaultConfigPath(): string {
    const configDir = path.join(os.homedir(), '.ai-cli');
    return path.join(configDir, 'config.json');
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readJsonSync(this.configPath);
        return { ...DEFAULT_CONFIG, ...configData };
      }
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}:`, error);
    }
    
    // Return default config and save it
    this.saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(config: AppConfig): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeJsonSync(this.configPath, config, { spaces: 2 });
    } catch (error) {
      console.error(`Failed to save config to ${this.configPath}:`, error);
    }
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig(this.config);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.ollamaUrl || typeof this.config.ollamaUrl !== 'string') {
      errors.push('ollamaUrl must be a valid URL string');
    }

    if (!this.config.defaultModel || typeof this.config.defaultModel !== 'string') {
      errors.push('defaultModel must be a non-empty string');
    }

    if (typeof this.config.maxTokens !== 'number' || this.config.maxTokens <= 0) {
      errors.push('maxTokens must be a positive number');
    }

    if (typeof this.config.temperature !== 'number' || this.config.temperature < 0 || this.config.temperature > 2) {
      errors.push('temperature must be a number between 0 and 2');
    }

    if (!Array.isArray(this.config.enabledTools)) {
      errors.push('enabledTools must be an array');
    }

    if (!Array.isArray(this.config.plugins)) {
      errors.push('plugins must be an array');
    }

    if (!this.config.memory || typeof this.config.memory !== 'object') {
      errors.push('memory configuration is required');
    } else {
      if (typeof this.config.memory.maxMessages !== 'number' || this.config.memory.maxMessages <= 0) {
        errors.push('memory.maxMessages must be a positive number');
      }
      if (typeof this.config.memory.persistToFile !== 'boolean') {
        errors.push('memory.persistToFile must be a boolean');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      const mergedConfig = { ...DEFAULT_CONFIG, ...importedConfig };
      this.config = mergedConfig;
      this.saveConfig(this.config);
    } catch (error) {
      throw new Error(`Failed to import config: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }
}
