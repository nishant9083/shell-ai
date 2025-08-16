import * as path from 'path';
import * as os from 'os';

import fs from 'fs-extra';
import chalk from 'chalk';

import { AppConfig } from '../types/index.js';
import { OllamaClient } from '../client/ollama-client.js';
import { getCoreSystemPrompt } from '../prompts/prompts.js';

const DEFAULT_CONFIG: AppConfig = {
  ollamaUrl: 'http://localhost:11434',
  currentModel: '',
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: getCoreSystemPrompt(),
  workingDirectory: process.cwd(),
  enabledTools: [
    'file-read',
    'file-write',
    'file-edit',
    'file-search',
    'shell-exec',
    'directory-list',
    'current-directory',
    'web-search',
    'wikipedia-search',
    'memory-list',
    'memory-retrieve',
    'memory-add',
    'memory-delete',
    'file-grep',
    'grep-replace',
    'search-file-content',
  ],
  plugins: [],
  memory: {
    maxMessages: 100,
    persistToFile: true,
    filePath: path.join(os.homedir(), '.shell-ai', 'memory.json'),
  },
};

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private client: OllamaClient;

  constructor(ollamaUrl?: string, currentModel?: string, configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
    // Update config with provided values
    if (ollamaUrl) {
      this.updateConfig({ ollamaUrl });
    }
    if (currentModel) {
      this.updateConfig({ currentModel });
    }
    this.client = new OllamaClient(this.config);
  }

  async initialize(): Promise<boolean> {
    // Update models dynamically if not already set or if using defaults
    try {
      const availableModels = await this.client.listModels();
      if (availableModels.length > 0) {
        const firstAvailableModel = availableModels[0];

        // Only update if still using default values
        if (this.config.currentModel === '') {
          this.updateConfig({ currentModel: firstAvailableModel.name });
        } else {
          // Ensure the current model is valid
          const isValidModel = availableModels.some(
            model => model.name === this.config.currentModel
          );
          if (!isValidModel) {
            this.updateConfig({ currentModel: firstAvailableModel.name });
          }
        }
        // Save updated config
        this.updateConfig({
          systemPrompt: this.config.systemPrompt,
          enabledTools: this.config.enabledTools,
          workingDirectory: this.config.workingDirectory,
        });
        return true;
      } else {
        console.warn(
          chalk.yellow(
            '⚠️ No models available. Please pull a model using `ollama pull <model-name>`'
          )
        );
        return false;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      console.error(chalk.red('❌ Cannot connect to Ollama server'));
      console.error(chalk.yellow('Make sure Ollama is running at:'), this.config.ollamaUrl);
      console.error(
        chalk.green('To change the url use --url <ollama url> or see help with --help')
      );
      console.error(chalk.gray('Visit https://ollama.ai for installation instructions'));
      return false;
    }
  }

  private getDefaultConfigPath(): string {
    const configDir = path.join(os.homedir(), '.shell-ai');
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

    if (!this.config.currentModel || typeof this.config.currentModel !== 'string') {
      errors.push('currentModel must be a non-empty string');
    }

    if (typeof this.config.maxTokens !== 'number' || this.config.maxTokens <= 0) {
      errors.push('maxTokens must be a positive number');
    }

    if (
      typeof this.config.temperature !== 'number' ||
      this.config.temperature < 0 ||
      this.config.temperature > 2
    ) {
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
      if (
        typeof this.config.memory.maxMessages !== 'number' ||
        this.config.memory.maxMessages <= 0
      ) {
        errors.push('memory.maxMessages must be a positive number');
      }
      if (typeof this.config.memory.persistToFile !== 'boolean') {
        errors.push('memory.persistToFile must be a boolean');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
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
      throw new Error(
        `Failed to import config: ${error instanceof Error ? error.message : 'Invalid JSON'}`
      );
    }
  }
}
