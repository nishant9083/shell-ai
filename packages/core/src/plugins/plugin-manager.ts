import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { Plugin, Tool, SlashCommand } from '../types/index.js';

export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private pluginDirectory: string;

  constructor(pluginDirectory?: string) {
    this.pluginDirectory = pluginDirectory || path.join(os.homedir(), '.ai-cli', 'plugins');
  }

  async loadPlugin(pluginPath: string): Promise<Plugin> {
    try {
      const absolutePath = path.resolve(pluginPath);
      
      // For now, we'll support JSON-based plugin definitions
      // In a full implementation, you might also support JavaScript modules
      if (path.extname(absolutePath) === '.json') {
        const pluginData = await fs.readJson(absolutePath);
        const plugin = this.validatePluginData(pluginData);
        
        if (plugin.initialize) {
          await plugin.initialize();
        }

        this.plugins.set(plugin.name, plugin);
        return plugin;
      } else {
        throw new Error('Only JSON plugin files are currently supported');
      }
    } catch (error) {
      throw new Error(`Failed to load plugin from ${pluginPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadPluginsFromDirectory(directory?: string): Promise<Plugin[]> {
    const pluginDir = directory || this.pluginDirectory;
    
    if (!await fs.pathExists(pluginDir)) {
      await fs.ensureDir(pluginDir);
      return [];
    }

    const plugins: Plugin[] = [];
    const entries = await fs.readdir(pluginDir);

    for (const entry of entries) {
      if (entry.endsWith('.json')) {
        try {
          const pluginPath = path.join(pluginDir, entry);
          const plugin = await this.loadPlugin(pluginPath);
          plugins.push(plugin);
        } catch (error) {
          console.warn(`Failed to load plugin ${entry}:`, error);
        }
      }
    }

    return plugins;
  }

  unloadPlugin(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      if (plugin.cleanup) {
        plugin.cleanup().catch(error => {
          console.warn(`Error during plugin cleanup for ${pluginName}:`, error);
        });
      }
      return this.plugins.delete(pluginName);
    }
    return false;
  }

  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginTools(): Tool[] {
    const tools: Tool[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.tools) {
        tools.push(...plugin.tools);
      }
    }
    return tools;
  }

  getPluginCommands(): SlashCommand[] {
    const commands: SlashCommand[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.commands) {
        commands.push(...plugin.commands);
      }
    }
    return commands;
  }

  async installPlugin(pluginData: Plugin, fileName?: string): Promise<void> {
    await fs.ensureDir(this.pluginDirectory);
    
    const pluginFileName = fileName || `${pluginData.name}.json`;
    const pluginPath = path.join(this.pluginDirectory, pluginFileName);
    
    // Validate plugin data before saving
    this.validatePluginData(pluginData);
    
    await fs.writeJson(pluginPath, pluginData, { spaces: 2 });
    
    // Load the plugin after installing
    await this.loadPlugin(pluginPath);
  }

  async uninstallPlugin(pluginName: string): Promise<boolean> {
    // Unload the plugin first
    const unloaded = this.unloadPlugin(pluginName);
    
    // Remove the plugin file
    const pluginPath = path.join(this.pluginDirectory, `${pluginName}.json`);
    if (await fs.pathExists(pluginPath)) {
      await fs.remove(pluginPath);
      return true;
    }
    
    return unloaded;
  }

  private validatePluginData(pluginData: any): Plugin {
    if (!pluginData || typeof pluginData !== 'object') {
      throw new Error('Plugin data must be an object');
    }

    if (!pluginData.name || typeof pluginData.name !== 'string') {
      throw new Error('Plugin must have a name (string)');
    }

    if (!pluginData.version || typeof pluginData.version !== 'string') {
      throw new Error('Plugin must have a version (string)');
    }

    if (!pluginData.description || typeof pluginData.description !== 'string') {
      throw new Error('Plugin must have a description (string)');
    }

    // Validate tools if present
    if (pluginData.tools) {
      if (!Array.isArray(pluginData.tools)) {
        throw new Error('Plugin tools must be an array');
      }
      
      pluginData.tools.forEach((tool: any, index: number) => {
        if (!tool.name || typeof tool.name !== 'string') {
          throw new Error(`Tool at index ${index} must have a name (string)`);
        }
        if (!tool.description || typeof tool.description !== 'string') {
          throw new Error(`Tool at index ${index} must have a description (string)`);
        }
        if (!tool.parameters || typeof tool.parameters !== 'object') {
          throw new Error(`Tool at index ${index} must have parameters (object)`);
        }
        // Note: execute function validation would need to be handled differently
        // for JSON-based plugins vs. JavaScript modules
      });
    }

    // Validate commands if present
    if (pluginData.commands) {
      if (!Array.isArray(pluginData.commands)) {
        throw new Error('Plugin commands must be an array');
      }
      
      pluginData.commands.forEach((command: any, index: number) => {
        if (!command.name || typeof command.name !== 'string') {
          throw new Error(`Command at index ${index} must have a name (string)`);
        }
        if (!command.description || typeof command.description !== 'string') {
          throw new Error(`Command at index ${index} must have a description (string)`);
        }
        // Note: execute function validation would need to be handled differently
        // for JSON-based plugins vs. JavaScript modules
      });
    }

    return pluginData as Plugin;
  }

  async createExamplePlugin(): Promise<void> {
    const examplePlugin: Plugin = {
      name: 'example-plugin',
      version: '1.0.0',
      description: 'An example plugin demonstrating the plugin system',
      tools: [
        {
          name: 'example-tool',
          description: 'An example tool that echoes input',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to echo'
              }
            },
            required: ['message']
          },
          execute: async (params: Record<string, unknown>) => {
            return {
              success: true,
              data: { echo: params.message }
            };
          }
        }
      ],
      commands: [
        {
          name: 'example',
          description: 'An example command',
          execute: async (args: string[]) => {
            console.log('Example command executed with args:', args);
          }
        }
      ]
    };

    await this.installPlugin(examplePlugin);
  }

  getPluginDirectory(): string {
    return this.pluginDirectory;
  }

  setPluginDirectory(directory: string): void {
    this.pluginDirectory = directory;
  }
}
