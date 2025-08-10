import {
  OllamaClient,
  MemoryManager,
  PluginManager,
  ConfigManager,
  AIMessage,
  toolRegistry,
  Tool,
  ToolResult
} from '@ai-cli/core';
import { ToolCall } from 'ollama';

interface AgentProcessorProps {
  client: OllamaClient;
  memory: MemoryManager;
  plugins: PluginManager;
  configManager: ConfigManager;
}

interface AgentCallbacks {
  onThinking: (thought: string) => void;
  onToolCall: (tool: string, params: Record<string, unknown>) => void;
  onConfirmation: (action: ConfirmationAction) => void;
  onResponse: (response: string) => void;
  onError: (error: string) => void;
  onProgress: (step: string, current: number, total: number) => void;
}

interface ConfirmationAction {
  type: 'confirmation';
  content: string;
  tool: string;
  parameters: Record<string, unknown>;
  requiresConfirmation: boolean;
}

interface AgentTask {
  id: string;
  description: string;
  steps: AgentStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  context: Record<string, unknown>;
}

interface AgentStep {
  id: string;
  action: 'tool_call' | 'analysis' | 'reflection' | 'planning';
  description: string;
  tool?: string;
  parameters?: Record<string, unknown>;
  result?: ToolResult;
  status: 'pending' | 'completed' | 'failed';
  reasoning: string;
}

export class TrueAgentProcessor {
  private client: OllamaClient;
  private memory: MemoryManager;
  private plugins: PluginManager;
  private configManager: ConfigManager;
  private maxIterations = 10;
  private currentTask?: AgentTask;

  constructor(props: AgentProcessorProps) {
    this.client = props.client;
    this.memory = props.memory;
    this.plugins = props.plugins;
    this.configManager = props.configManager;
  }

  async processUserInput(
    input: string,
    conversationHistory: Array<{ role: string; content: string; timestamp: Date }>,
    callbacks: AgentCallbacks
  ): Promise<void> {
    try {
      // Phase 1: Planning - Break down the user request into a task
      callbacks.onThinking('🧠 Planning approach to your request...');
      
      const task = await this.planTask(input, conversationHistory);
      this.currentTask = task;
      
      callbacks.onProgress('Planning completed', 1, task.steps.length + 1);
      
      // Phase 2: Execution - Execute the plan with iterative refinement
      await this.executeTask(task, callbacks);
      
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async planTask(
    input: string,
    conversationHistory: Array<{ role: string; content: string; timestamp: Date }>
  ): Promise<AgentTask> {
    const availableTools = this.getEnabledTools();
    const config = this.configManager.getConfig();

    const planningPrompt = `You are an autonomous AI agent planning how to accomplish a user's request. Break down the request into a series of logical steps that can be executed using available tools.

USER REQUEST: "${input}"

AVAILABLE TOOLS:
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

PLANNING PRINCIPLES:
1. Think step-by-step and break complex tasks into smaller parts
2. Use tools strategically to gather information before making decisions
3. Plan for iteration - you can analyze results and take follow-up actions
4. Consider error handling and alternative approaches
5. Be thorough but efficient

RESPONSE FORMAT (JSON):
{
  "task_description": "Clear description of what needs to be accomplished",
  "strategy": "High-level approach",
  "steps": [
    {
      "action": "tool_call|analysis|reflection",
      "description": "What this step accomplishes",
      "tool": "tool-name (if action is tool_call)",
      "parameters": {"param": "value"},
      "reasoning": "Why this step is needed"
    }
  ],
  "expected_outcome": "What success looks like"
}

Create a comprehensive plan:`;

    const messages: AIMessage[] = [
      ...conversationHistory.slice(-3).map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.timestamp
      })),
      {
        role: 'user',
        content: planningPrompt,
        timestamp: new Date()
      }
    ];

    const response = await this.client.chat(messages, {
      model: config.currentModel,
      temperature: 0.3, // Lower temperature for better planning
      maxTokens: 2000
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in planning response');
      }

      const plan = JSON.parse(jsonMatch[0]);
      
      return {
        id: `task_${Date.now()}`,
        description: plan.task_description,
        steps: plan.steps.map((step: any, index: number) => ({
          id: `step_${index}`,
          action: step.action,
          description: step.description,
          tool: step.tool,
          parameters: step.parameters,
          status: 'pending',
          reasoning: step.reasoning
        })),
        status: 'pending',
        context: {
          userRequest: input,
          strategy: plan.strategy,
          expectedOutcome: plan.expected_outcome
        }
      };

    } catch (error) {
      // Fallback: Create a simple single-step task
      return {
        id: `task_${Date.now()}`,
        description: `Respond to: ${input}`,
        steps: [{
          id: 'step_0',
          action: 'analysis',
          description: 'Analyze and respond to user request',
          status: 'pending',
          reasoning: 'Direct response needed'
        }],
        status: 'pending',
        context: { userRequest: input }
      };
    }
  }

  private async executeTask(task: AgentTask, callbacks: AgentCallbacks): Promise<void> {
    task.status = 'in_progress';
    let iteration = 0;
    let stepIndex = 0;
    
    while (stepIndex < task.steps.length && iteration < this.maxIterations) {
      const step = task.steps[stepIndex];
      
      callbacks.onProgress(
        `Executing: ${step.description}`,
        stepIndex + 2, // +2 because planning was step 1
        task.steps.length + 1
      );

      try {
        await this.executeStep(step, task, callbacks);
        
        // After each step, reflect and decide if we need additional actions
        if (step.status === 'completed' && step.result) {
          const shouldContinue = await this.reflectAndPlan(task, step, callbacks);
          
          if (shouldContinue.needsMoreSteps) {
            // Add new steps based on reflection
            task.steps.push(...shouldContinue.newSteps);
          }
        }
        
        stepIndex++;
      } catch (error) {
        step.status = 'failed';
        
        // Try to recover with alternative approach
        const recovery = await this.attemptRecovery(task, step, error as Error, callbacks);
        if (recovery.recoverySteps.length > 0) {
          task.steps.splice(stepIndex + 1, 0, ...recovery.recoverySteps);
        } else {
          callbacks.onError(`Step failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          break;
        }
      }
      
      iteration++;
    }

    // Generate final response
    const finalResponse = await this.generateFinalResponse(task);
    callbacks.onResponse(finalResponse);
    
    task.status = 'completed';
  }

  private async executeStep(
    step: AgentStep,
    task: AgentTask,
    callbacks: AgentCallbacks
  ): Promise<void> {
    callbacks.onThinking(`🔄 ${step.reasoning}`);

    switch (step.action) {
      case 'tool_call':
        if (step.tool && step.parameters) {
          // Check if confirmation is needed
          if (this.requiresConfirmation(step.tool, step.parameters)) {
            callbacks.onConfirmation({
              type: 'confirmation',
              content: `Execute ${step.tool}? This will: ${step.description}`,
              tool: step.tool,
              parameters: step.parameters,
              requiresConfirmation: true
            });
            return; // Will be continued after confirmation
          }

          callbacks.onToolCall(step.tool, step.parameters);
          
          const tool = toolRegistry.get(step.tool);
          if (tool) {
            step.result = await tool.execute(step.parameters);
            step.status = step.result.success ? 'completed' : 'failed';
            
            // Store result in task context for future steps
            task.context[`${step.tool}_result`] = step.result.data;
          } else {
            throw new Error(`Tool not found: ${step.tool}`);
          }
        }
        break;

      case 'analysis':
      case 'reflection':
        // These are thinking steps - just mark as completed
        step.status = 'completed';
        break;

      default:
        step.status = 'completed';
    }
  }

  private async reflectAndPlan(
    task: AgentTask,
    completedStep: AgentStep,
    callbacks: AgentCallbacks
  ): Promise<{ needsMoreSteps: boolean; newSteps: AgentStep[] }> {
    if (!completedStep.result?.success) {
      return { needsMoreSteps: false, newSteps: [] };
    }

    callbacks.onThinking('🤔 Analyzing results and planning next actions...');

    const reflectionPrompt = `You are an autonomous AI agent reflecting on the results of an action. Based on the results, determine if additional actions are needed to fully accomplish the user's request.

ORIGINAL REQUEST: "${task.context.userRequest}"
TASK DESCRIPTION: "${task.description}"
COMPLETED STEP: "${completedStep.description}"
STEP RESULT: ${JSON.stringify(completedStep.result.data, null, 2)}

AVAILABLE TOOLS:
${this.getEnabledTools().map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

REFLECTION QUESTIONS:
1. Does this result fully answer the user's request?
2. Are there any follow-up actions that would be helpful?
3. Can we provide more value by analyzing or processing this data further?
4. Are there any obvious next steps based on what we found?

RESPONSE FORMAT (JSON):
{
  "analysis": "Your analysis of the current results",
  "is_task_complete": false,
  "next_actions": [
    {
      "action": "tool_call|analysis",
      "description": "What this action will accomplish",
      "tool": "tool-name (if needed)",
      "parameters": {"param": "value"},
      "reasoning": "Why this action is valuable"
    }
  ],
  "completion_assessment": "How close are we to fully satisfying the user's request?"
}

Reflect and plan:`;

    const config = this.configManager.getConfig();
    const response = await this.client.chat([
      {
        role: 'user',
        content: reflectionPrompt,
        timestamp: new Date()
      }
    ], {
      model: config.currentModel,
      temperature: 0.4,
      maxTokens: 1500
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { needsMoreSteps: false, newSteps: [] };
      }

      const reflection = JSON.parse(jsonMatch[0]);
      
      if (reflection.is_task_complete || !reflection.next_actions?.length) {
        return { needsMoreSteps: false, newSteps: [] };
      }

      const newSteps = reflection.next_actions.map((action: any, index: number) => ({
        id: `dynamic_step_${Date.now()}_${index}`,
        action: action.action,
        description: action.description,
        tool: action.tool,
        parameters: action.parameters,
        status: 'pending',
        reasoning: action.reasoning
      }));

      return { needsMoreSteps: true, newSteps };

    } catch (error) {
      return { needsMoreSteps: false, newSteps: [] };
    }
  }

  private async attemptRecovery(
    task: AgentTask,
    failedStep: AgentStep,
    error: Error,
    callbacks: AgentCallbacks
  ): Promise<{ recoverySteps: AgentStep[] }> {
    callbacks.onThinking('🔧 Attempting to recover from error...');

    const recoveryPrompt = `An action failed during task execution. Suggest alternative approaches to recover and continue.

FAILED STEP: "${failedStep.description}"
ERROR: "${error.message}"
ORIGINAL REQUEST: "${task.context.userRequest}"

AVAILABLE TOOLS:
${this.getEnabledTools().map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Suggest 1-2 alternative approaches to accomplish the same goal or work around this issue.

RESPONSE FORMAT (JSON):
{
  "recovery_strategy": "Brief description of the approach",
  "alternative_steps": [
    {
      "action": "tool_call",
      "description": "What this recovery step will do",
      "tool": "tool-name",
      "parameters": {"param": "value"},
      "reasoning": "Why this might work better"
    }
  ]
}

Recovery plan:`;

    try {
      const config = this.configManager.getConfig();
      const response = await this.client.chat([
        {
          role: 'user',
          content: recoveryPrompt,
          timestamp: new Date()
        }
      ], {
        model: config.currentModel,
        temperature: 0.5,
        maxTokens: 1000
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { recoverySteps: [] };
      }

      const recovery = JSON.parse(jsonMatch[0]);
      
      const recoverySteps = recovery.alternative_steps?.map((step: any, index: number) => ({
        id: `recovery_step_${Date.now()}_${index}`,
        action: step.action,
        description: step.description,
        tool: step.tool,
        parameters: step.parameters,
        status: 'pending',
        reasoning: step.reasoning
      })) || [];

      return { recoverySteps };

    } catch {
      return { recoverySteps: [] };
    }
  }

  private async generateFinalResponse(task: AgentTask): Promise<string> {
    const completedSteps = task.steps.filter(step => step.status === 'completed');
    const toolResults = completedSteps
      .filter(step => step.result)
      .map(step => ({
        step: step.description,
        tool: step.tool,
        result: step.result
      }));

    const responsePrompt = `Generate a comprehensive response to the user based on the completed task execution.

ORIGINAL REQUEST: "${task.context.userRequest}"
TASK DESCRIPTION: "${task.description}"

COMPLETED ACTIONS:
${completedSteps.map(step => `- ${step.description} ${step.result ? '✅' : ''}`).join('\n')}

TOOL RESULTS:
${toolResults.map(tr => `
${tr.step} (${tr.tool}):
${this.formatToolResult(tr.result!)}
`).join('\n')}

Provide a helpful, comprehensive response that:
1. Summarizes what was accomplished
2. Presents key findings and information
3. Provides context and explains significance
4. Suggests relevant next steps or follow-up actions
5. Is conversational and user-friendly

Response:`;

    const config = this.configManager.getConfig();
    return await this.client.chat([
      {
        role: 'user',
        content: responsePrompt,
        timestamp: new Date()
      }
    ], {
      model: config.currentModel,
      temperature: 0.7,
      maxTokens: 2000
    });
  }

  async executeConfirmedAction(
    action: ConfirmationAction,
    callbacks: Pick<AgentCallbacks, 'onResponse' | 'onError'>
  ): Promise<void> {
    try {
      const tool = toolRegistry.get(action.tool);
      if (tool) {
        const result = await tool.execute(action.parameters);
        
        if (result.success) {
          // Continue with the current task after confirmation
          if (this.currentTask) {
            const currentStep = this.currentTask.steps.find(s => s.tool === action.tool);
            if (currentStep) {
              currentStep.result = result;
              currentStep.status = 'completed';
              this.currentTask.context[`${action.tool}_result`] = result.data;
            }
          }
          
          const response = `✅ Successfully executed ${action.tool}.\n\n${this.formatToolResult(result)}\n\nContinuing with the task...`;
          callbacks.onResponse(response);
        } else {
          callbacks.onError(`Tool execution failed: ${result.error}`);
        }
      } else {
        callbacks.onError(`Tool not found: ${action.tool}`);
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private getEnabledTools(): Tool[] {
    const config = this.configManager.getConfig();
    const allTools = toolRegistry.list();
    return allTools.filter(tool => config.enabledTools.includes(tool.name));
  }

  private requiresConfirmation(toolName: string, parameters: Record<string, unknown>): boolean {
    const destructiveTools = ['file-write', 'file-edit', 'shell-exec'];

    if (destructiveTools.includes(toolName)) {
      if (toolName === 'shell-exec') {
        const command = parameters.command as string;
        if (command) {
          const safeCommands = [
            'ls', 'dir', 'pwd', 'whoami', 'ps', 'top', 'df', 'free',
            'cat', 'head', 'tail', 'less', 'more', 'grep', 'find',
            'git status', 'git log', 'git diff', 'npm list', 'node -v',
            'npm test', 'npm run build', 'tsc --noEmit'
          ];
          
          const commandStart = command.trim().split(' ')[0].toLowerCase();
          const fullCommand = command.trim().toLowerCase();
          
          return !safeCommands.some(safe => 
            fullCommand.startsWith(safe.toLowerCase()) || commandStart === safe.split(' ')[0]
          );
        }
      }
      return true;
    }

    return false;
  }

  private formatToolResult(result: ToolResult): string {
    if (!result.success) {
      return `❌ Error: ${result.error}`;
    }

    if (typeof result.data === 'string') {
      return result.data;
    }

    if (typeof result.data === 'object' && result.data !== null) {
      if (Array.isArray(result.data)) {
        if (result.data.length === 0) {
          return "No items found.";
        }
        
        return result.data.slice(0, 20).map((item, index) => {
          if (typeof item === 'object') {
            if ('name' in item && 'type' in item) {
              const icon = item.type === 'directory' ? '📁' : '📄';
              return `${icon} ${item.name}`;
            }
            return `${index + 1}. ${JSON.stringify(item)}`;
          }
          return `${index + 1}. ${item}`;
        }).join('\n') + (result.data.length > 20 ? '\n... (showing first 20 items)' : '');
      }

      return JSON.stringify(result.data, null, 2);
    }

    return String(result.data);
  }
}
