import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager, OllamaClient, MemoryManager, PluginManager } from '@ai-cli/core';
import { EnhancedInteractiveChat } from './agent-chat.js';
import { CommandProcessor } from './command-processor.js';
import * as packageJson from '../../package.json' assert { type: 'json' };

const version = packageJson.version;

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('ai-cli')
    .description('AI-CLI - A powerful AI assistant powered by Ollama')
    .version(version);

  // Initialize core components
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const client = new OllamaClient(config);
  const memory = new MemoryManager(
    config.memory.maxMessages,
    config.memory.persistToFile,
    config.memory.filePath
  );
  const plugins = new PluginManager();

  // Load plugins
  await plugins.loadPluginsFromDirectory();

  // Check Ollama connection
  const isConnected = await client.checkConnection();
  if (!isConnected) {
    console.error(chalk.red('❌ Cannot connect to Ollama server'));
    console.error(chalk.yellow('Make sure Ollama is running at:'), config.ollamaUrl);
    console.error(chalk.gray('Visit https://ollama.ai for installation instructions'));
    process.exit(1);
  }

  // Interactive mode (default)
  program
    .command('chat', { isDefault: true })
    .description('Start interactive chat session')
    .option('-m, --model <model>', 'Use specific model', config.defaultModel)
    .option('-s, --system <prompt>', 'Set system prompt')
    .option('-t, --temperature <temp>', 'Set temperature (0-2)', parseFloat)
    .option('--max-tokens <tokens>', 'Set max tokens', parseInt)
    .action(async (options) => {
      const chat = new EnhancedInteractiveChat({
        client,
        memory,
        plugins,
        configManager,
        model: options.model,
        systemPrompt: options.system,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });
      
      // Update current model in config if specified
      if (options.model) {
        configManager.updateConfig({ currentModel: options.model });
      }
      
      await chat.start();
    });

  // Non-interactive mode
  program
    .command('ask <question>')
    .description('Ask a single question and get response')
    .option('-m, --model <model>', 'Use specific model', config.defaultModel)
    .option('-s, --system <prompt>', 'Set system prompt')
    .option('-t, --temperature <temp>', 'Set temperature (0-2)', parseFloat)
    .option('--max-tokens <tokens>', 'Set max tokens', parseInt)
    .option('--no-memory', 'Don\'t use conversation memory')
    .action(async (question, options) => {
      const processor = new CommandProcessor({
        client,
        memory: options.memory ? memory : undefined,
        plugins,
        configManager
      });

      await processor.processQuestion(question, {
        model: options.model,
        systemPrompt: options.system,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });
    });

  // Model management
  const modelCommand = program
    .command('model')
    .description('Manage Ollama models');

  modelCommand
    .command('list')
    .description('List available models')
    .action(async () => {
      try {
        const models = await client.listModels();
        console.log(chalk.blue('📦 Available Models:'));
        models.forEach(model => {
          console.log(chalk.green(`  • ${model.name}`));
          console.log(chalk.gray(`    Size: ${model.size}, Modified: ${model.modified_at}`));
        });
      } catch (error) {
        console.error(chalk.red('Failed to list models:'), error);
      }
    });

  modelCommand
    .command('pull <name>')
    .description('Download a model')
    .action(async (name) => {
      try {
        console.log(chalk.blue(`📥 Downloading model: ${name}`));
        await client.pullModel(name);
        console.log(chalk.green(`✅ Model ${name} downloaded successfully`));
      } catch (error) {
        console.error(chalk.red('Failed to download model:'), error);
      }
    });

  modelCommand
    .command('remove <name>')
    .description('Remove a model')
    .action(async (name) => {
      try {
        await client.deleteModel(name);
        console.log(chalk.green(`🗑️ Model ${name} removed successfully`));
      } catch (error) {
        console.error(chalk.red('Failed to remove model:'), error);
      }
    });

  // Configuration management
  const configCommand = program
    .command('config')
    .description('Manage AI-CLI configuration');

  configCommand
    .command('show')
    .description('Show current configuration')
    .action(() => {
      console.log(chalk.blue('🔧 Current Configuration:'));
      console.log(JSON.stringify(config, null, 2));
    });

  configCommand
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key, value) => {
      try {
        // Parse value appropriately
        let parsedValue: any = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);

        // Handle nested keys (e.g., memory.maxMessages)
        const keys = key.split('.');
        if (keys.length > 1) {
          const updates: any = {};
          let current = updates;
          for (let i = 0; i < keys.length - 1; i++) {
            current[keys[i]] = {};
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = parsedValue;
          configManager.updateConfig(updates);
        } else {
          configManager.updateConfig({ [key]: parsedValue });
        }

        console.log(chalk.green(`✅ Configuration updated: ${key} = ${parsedValue}`));
      } catch (error) {
        console.error(chalk.red('Failed to update configuration:'), error);
      }
    });

  configCommand
    .command('reset')
    .description('Reset configuration to defaults')
    .action(() => {
      configManager.resetConfig();
      console.log(chalk.green('✅ Configuration reset to defaults'));
    });

  // Memory management
  const memoryCommand = program
    .command('memory')
    .description('Manage conversation memory');

  memoryCommand
    .command('stats')
    .description('Show memory statistics')
    .action(() => {
      const stats = memory.getMemoryStats();
      console.log(chalk.blue('🧠 Memory Statistics:'));
      console.log(`Total memories: ${stats.total}`);
      console.log('By type:', stats.byType);
      if (stats.oldestMemory) {
        console.log(`Oldest: ${stats.oldestMemory.toISOString()}`);
      }
      if (stats.newestMemory) {
        console.log(`Newest: ${stats.newestMemory.toISOString()}`);
      }
    });

  memoryCommand
    .command('clear [type]')
    .description('Clear memory (optionally by type)')
    .action((type) => {
      memory.clearMemories(type);
      const message = type ? `${type} memories` : 'all memories';
      console.log(chalk.green(`🗑️ Cleared ${message}`));
    });

  memoryCommand
    .command('search <query>')
    .description('Search memories')
    .option('-l, --limit <limit>', 'Maximum results', parseInt, 10)
    .option('-t, --type <type>', 'Filter by type')
    .action((query, options) => {
      const results = memory.searchMemories(query, {
        limit: options.limit,
        type: options.type
      });
      
      console.log(chalk.blue(`🔍 Found ${results.length} results for "${query}":`));
      results.forEach((result, index) => {
        console.log(chalk.green(`\n${index + 1}. [${result.type}] ${result.id}`));
        console.log(chalk.gray(`   ${result.timestamp.toISOString()}`));
        console.log(`   ${result.content.substring(0, 100)}...`);
      });
    });

  // Plugin management
  const pluginCommand = program
    .command('plugin')
    .description('Manage plugins');

  pluginCommand
    .command('list')
    .description('List installed plugins')
    .action(() => {
      const pluginList = plugins.listPlugins();
      console.log(chalk.blue('🔌 Installed Plugins:'));
      pluginList.forEach(plugin => {
        console.log(chalk.green(`  • ${plugin.name} v${plugin.version}`));
        console.log(chalk.gray(`    ${plugin.description}`));
      });
    });

  pluginCommand
    .command('create-example')
    .description('Create an example plugin')
    .action(async () => {
      await plugins.createExamplePlugin();
      console.log(chalk.green('✅ Example plugin created'));
    });

  // Tools
  program
    .command('tools')
    .description('List available tools')
    .action(async () => {
      const processor = new CommandProcessor({
        client,
        memory,
        plugins,
        configManager
      });
      
      await processor.executeSlashCommand('/tools', []);
    });

  await program.parseAsync();
}
