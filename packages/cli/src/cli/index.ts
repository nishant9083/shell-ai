import { Command } from 'commander';
import { ConfigManager, OllamaClient, MemoryManager } from '@shell-ai/core';

import { InteractiveChat } from './agent-chat.js';
const packageJson = await import('../../package.json', {
  with: { type: 'json' },
});

const version = packageJson.default.version;

export async function main(): Promise<void> {
  try {
    const program = new Command();

    program
      .name('shell-ai')
      .description('Shell AI - A powerful AI assistant powered by Ollama')
      .version(version)
      .option('-u, --url <ollama url>', 'Set Ollama URL')
      .option('-m, --model <model>', 'Use specific model')
      .option('-s, --system <prompt>', 'Set system prompt')
      .option('-t, --temperature <temp>', 'Set temperature (0-2)', parseFloat)
      .option('--max-tokens <tokens>', 'Set max tokens', parseInt)
      .action(chatAction);

    async function chatAction(options: any) {
      // Initialize core components
      const configManager = new ConfigManager(options.url, options.model);
      if (!(await configManager.initialize())) {
        return;
      }
      if (options.temperature !== undefined) {
        configManager.updateConfig({
          temperature: options.temperature,
        });
      }
      if (options.maxTokens !== undefined) {
        configManager.updateConfig({
          maxTokens: options.maxTokens,
        });
      }
      if (options.system !== undefined) {
        configManager.updateConfig({
          systemPrompt: options.system,
        });
      }
      const config = configManager.getConfig();
      const client = new OllamaClient(config);
      const memory = new MemoryManager(
        config.memory.maxMessages,
        config.memory.persistToFile,
        config.memory.filePath
      );

      const chat = new InteractiveChat({
        client,
        memory,
        configManager,
        model: options.model,
        systemPrompt: options.system || config.systemPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

      await chat.start();
    }

    await program.parseAsync(process.argv);

    // Function to set terminal title
    function setTerminalTitle(title: string): void {
      process.stdout.write(`\x1B]0;${title}\x07`);
      // Restore original title when exiting
      process.on('exit', () => {
        setTerminalTitle('');
      });
    }

    // Set terminal title at program start
    setTerminalTitle('Shell AI');
  } catch (error) {
    console.error(error);
  }
}
