import * as path from 'path';
import * as os from 'os';

import fs from 'fs-extra';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/sse.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';

import {
  MCPConfig,
  MCPServerConfig,
  MCPConnection,
  MCPTool,
  MCPAuthConfig,
} from '../types/index.js';

const DEFAULT_MCP_CONFIG: MCPConfig = {
  servers: [],
  globalTimeout: 30000,
  maxConcurrentConnections: 10,
  enableAutoReconnect: true,
  logLevel: 'info',
};

export class MCPManager {
  private config: MCPConfig;
  private configPath: string;
  private connections: Map<string, MCPConnection> = new Map();
  private tools: Map<string, DynamicStructuredTool> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }

  private getDefaultConfigPath(): string {
    const configDir = path.join(os.homedir(), '.shell-ai');
    return path.join(configDir, 'mcp.json');
  }

  private loadConfig(): MCPConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readJsonSync(this.configPath);
        return { ...DEFAULT_MCP_CONFIG, ...configData };
      }
    } catch (error) {
      console.warn(`Failed to load MCP config from ${this.configPath}:`, error);
    }

    // Return default config and save it
    this.saveConfig(DEFAULT_MCP_CONFIG);
    return { ...DEFAULT_MCP_CONFIG };
  }

  private saveConfig(config: MCPConfig): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeJsonSync(this.configPath, config, { spaces: 2 });
    } catch (error) {
      console.error(`Failed to save MCP config to ${this.configPath}:`, error);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔗 Initializing MCP connections...');

      const enabledServers = this.config.servers.filter(server => server.enabled);
      if (enabledServers.length === 0) {
        console.log('📭 No MCP servers configured');
        return true;
      }

      const connectionPromises = enabledServers.map(server =>
        this.connectToServer(server).catch(error => {
          console.error(`❌ Failed to connect to MCP server ${server.name}:`, error.message);
          return false;
        })
      );

      const results = await Promise.all(connectionPromises);
      const successfulConnections = results.filter(Boolean).length;

      console.log(`🔗 Connected to ${successfulConnections}/${enabledServers.length} MCP servers`);

      if (successfulConnections > 0) {
        console.log(`🛠️ Registered ${this.tools.size} MCP tools`);
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  private async connectToServer(serverConfig: MCPServerConfig): Promise<boolean> {
    try {
      let transport: any;

      // Determine connection type and create appropriate transport
      if (serverConfig.command) {
        transport = await this.createStdioTransport(serverConfig);
      } else if (serverConfig.http) {
        transport = await this.createHttpTransport(serverConfig);
      } else if (serverConfig.sse) {
        transport = await this.createSSETransport(serverConfig);
      } else {
        throw new Error(`No valid connection configuration for server ${serverConfig.name}`);
      }

      const client = new Client(
        {
          name: 'shell-ai',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      await client.connect(transport);

      // List available tools
      const toolsResponse = await client.listTools();
      const mcpTools: MCPTool[] = toolsResponse.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema,
        serverName: serverConfig.name,
      }));

      // Register tools as LangChain tools
      for (const mcpTool of mcpTools) {
        const langchainTool = this.createLangChainTool(mcpTool, client);
        this.tools.set(`mcp-${serverConfig.name}-${mcpTool.name}`, langchainTool);
      }

      // Store connection
      this.connections.set(serverConfig.name, {
        serverName: serverConfig.name,
        client,
        tools: mcpTools,
        isConnected: true,
      });

      console.log(`✅ Connected to MCP server: ${serverConfig.name} (${mcpTools.length} tools)`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to MCP server ${serverConfig.name}:`, error);
      return false;
    }
  }

  private async createStdioTransport(serverConfig: MCPServerConfig): Promise<StdioClientTransport> {
    if (!serverConfig.command) {
      throw new Error('Command configuration is required for stdio transport');
    }

    const server: StdioServerParameters = {
      command: serverConfig.command.program,
      args: serverConfig.command.args || [],
      env: { ...serverConfig.command.env },
      cwd: serverConfig.command.cwd || process.cwd(),
    };

    return new StdioClientTransport(server);
  }

  private async createHttpTransport(
    serverConfig: MCPServerConfig
  ): Promise<StreamableHTTPClientTransport> {
    if (!serverConfig.http) {
      throw new Error('HTTP configuration is required for HTTP transport');
    }

    // Build headers with authentication
    const headers = await this.buildAuthHeaders(
      serverConfig.http.headers || {},
      serverConfig.http.auth
    );

    const options: StreamableHTTPClientTransportOptions = {
      requestInit: {
        headers,
      },
    };

    return new StreamableHTTPClientTransport(new URL(serverConfig.http.url), options);
  }

  private async createSSETransport(serverConfig: MCPServerConfig): Promise<SSEClientTransport> {
    if (!serverConfig.sse) {
      throw new Error('SSE configuration is required for SSE transport');
    }

    // Build headers with authentication
    const headers = await this.buildAuthHeaders(
      serverConfig.sse.headers || {},
      serverConfig.sse.auth
    );

    const options: SSEClientTransportOptions = {
      requestInit: {
        headers,
      },
    };

    return new SSEClientTransport(new URL(serverConfig.sse.url), options);
  }

  private async buildAuthHeaders(
    baseHeaders: Record<string, string>,
    authConfig?: MCPAuthConfig
  ): Promise<Record<string, string>> {
    const headers = { ...baseHeaders };

    if (!authConfig) {
      return headers;
    }

    switch (authConfig.type) {
      case 'bearer':
        if (authConfig.token) {
          headers['Authorization'] = `Bearer ${authConfig.token}`;
        }
        break;

      case 'basic': {
        if (authConfig.username && authConfig.password) {
          const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString(
            'base64'
          );
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      }

      case 'api_key':
        if (authConfig.apiKey) {
          const headerName = authConfig.apiKeyHeader || 'X-API-Key';
          headers[headerName] = authConfig.apiKey;
        }
        break;

      case 'oauth2': {
        // Handle OAuth2 token refresh/retrieval
        const token = await this.getOAuth2Token(authConfig);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        break;
      }
      case 'custom':
        if (authConfig.customHeaders) {
          Object.assign(headers, authConfig.customHeaders);
        }
        break;

      default:
        console.warn(`Unsupported authentication type: ${authConfig.type}`);
    }

    return headers;
  }

  private async getOAuth2Token(authConfig: MCPAuthConfig): Promise<string | null> {
    if (!authConfig.clientId || !authConfig.clientSecret || !authConfig.tokenUrl) {
      console.error('OAuth2 configuration incomplete');
      return null;
    }

    try {
      const tokenData = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        ...(authConfig.scope && { scope: authConfig.scope }),
      });

      const response = await axios.post(authConfig.tokenUrl, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data.access_token;
    } catch (error) {
      console.error('Failed to obtain OAuth2 token:', error);
      return null;
    }
  }

  // Helper method to validate authentication configuration
  private validateAuthConfig(authConfig: MCPAuthConfig): boolean {
    switch (authConfig.type) {
      case 'bearer':
        return !!authConfig.token;
      case 'basic':
        return !!(authConfig.username && authConfig.password);
      case 'api_key':
        return !!authConfig.apiKey;
      case 'oauth2':
        return !!(authConfig.clientId && authConfig.clientSecret && authConfig.tokenUrl);
      case 'custom':
        return !!(authConfig.customHeaders && Object.keys(authConfig.customHeaders).length > 0);
      default:
        return false;
    }
  }

  private createLangChainTool(mcpTool: MCPTool, client: Client): DynamicStructuredTool {
    // Convert MCP JSON schema to Zod schema
    // const zodSchema = this.jsonSchemaToZod(mcpTool.inputSchema);

    return new DynamicStructuredTool({
      name: `mcp-${mcpTool.serverName}-${mcpTool.name}`,
      description: `[MCP:${mcpTool.serverName}] ${mcpTool.description}`,
      schema: {
        ...mcpTool.inputSchema,
        properties: {
          ...mcpTool.inputSchema.properties,
          approved: {
            type: 'boolean',
            description: 'Whether the action is approved',
          },
        },
      },
      func: async (input: any) => {
        const { approved, ...args } = input;
        if (!approved) {
          return {
            success: false,
            error: 'User did not approve the action',
          };
        }
        try {
          const result = await client.callTool({
            name: mcpTool.name,
            arguments: args,
          });

          if (result.isError) {
            return {
              success: false,
              error: (result.content as string) || 'Unknown MCP tool error',
            };
          }

          return {
            success: true,
            data: result.content,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });
  }

  private jsonSchemaToZod(schema: any): z.ZodSchema {
    // Simple JSON Schema to Zod conversion
    // This is a basic implementation - you may want to expand this for complex schemas

    if (!schema || typeof schema !== 'object') {
      return z.any();
    }

    if (schema.type === 'object' && schema.properties) {
      const shape: Record<string, z.ZodSchema> = {};

      for (const [key, prop] of Object.entries(schema.properties as any)) {
        shape[key] = this.jsonSchemaToZod(prop);

        // Add descriptions if available
        if ((prop as any).description) {
          shape[key] = shape[key].describe((prop as any).description);
        }
      }

      let objectSchema = z.object(shape);

      // Handle required fields
      if (schema.required && Array.isArray(schema.required)) {
        const optional = Object.keys(shape).filter(key => !schema.required.includes(key));
        if (optional.length > 0) {
          objectSchema = objectSchema.partial(
            optional.reduce((acc, key) => ({ ...acc, [key]: true }), {})
          );
        }
      } else {
        objectSchema = objectSchema.partial();
      }

      return objectSchema;
    }

    switch (schema.type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'integer':
        return z.number().int();
      case 'boolean':
        return z.boolean();
      case 'array':
        return z.array(this.jsonSchemaToZod(schema.items));
      default:
        return z.any();
    }
  }

  getTools(): DynamicStructuredTool[] {
    return Array.from(this.tools.values());
  }

  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  getConfig(): MCPConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<MCPConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  addServer(serverConfig: MCPServerConfig): void {
    const existingIndex = this.config.servers.findIndex(s => s.name === serverConfig.name);

    if (existingIndex >= 0) {
      this.config.servers[existingIndex] = serverConfig;
    } else {
      this.config.servers.push(serverConfig);
    }

    this.saveConfig(this.config);
  }

  removeServer(serverName: string): void {
    this.config.servers = this.config.servers.filter(s => s.name !== serverName);
    this.saveConfig(this.config);

    // Disconnect if connected
    if (this.connections.has(serverName)) {
      this.disconnectServer(serverName);
    }
  }

  async disconnectServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (connection && connection.isConnected) {
      try {
        await connection.client.close();

        // Remove tools from this server
        for (const tool of connection.tools) {
          this.tools.delete(`mcp-${serverName}-${tool.name}`);
        }

        this.connections.delete(serverName);
        console.log(`🔌 Disconnected from MCP server: ${serverName}`);
      } catch (error) {
        console.error(`Error disconnecting from ${serverName}:`, error);
      }
    }
  }

  async shutdown(): Promise<void> {
    try {
      console.log('🔌 Shutting down MCP connections...');

      const disconnectPromises = Array.from(this.connections.keys()).map(serverName =>
        this.disconnectServer(serverName)
      );

      await Promise.all(disconnectPromises);
      console.log('✅ All MCP connections closed');
    } catch (error) {
      console.log(error);
    }
  }

  getServerStatus(serverName: string): MCPConnection | undefined {
    return this.connections.get(serverName);
  }

  async reconnectServer(serverName: string): Promise<boolean> {
    const serverConfig = this.config.servers.find(s => s.name === serverName);
    if (!serverConfig) {
      console.error(`Server configuration not found: ${serverName}`);
      return false;
    }

    // Disconnect first if connected
    if (this.connections.has(serverName)) {
      await this.disconnectServer(serverName);
    }

    return this.connectToServer(serverConfig);
  }
}
