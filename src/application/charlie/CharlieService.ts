/**
 * Charlie Service
 *
 * The main orchestrator for Charlie AI assistant.
 * Handles conversations, routes to agents, manages projects and actions.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CharlieRequest,
  CharlieResponse,
  ClassifiedIntent,
  ConversationSession,
  ConversationMessage,
  PendingAction,
  Project,
  FileNode,
  UserRole,
  APPROVAL_MATRIX,
  ActionType,
  Intent,
} from './types';
import { selectAgentByContext, AgentDefinition, AGENTS } from './AgentRouter';

// =============================================================================
// SESSION STORE (In-Memory - will move to DB later)
// =============================================================================

const sessions = new Map<string, ConversationSession>();
const projects = new Map<string, Project>();

// =============================================================================
// CHARLIE SERVICE CLASS
// =============================================================================

export class CharlieService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  private getOrCreateSession(
    sessionId: string,
    userId: string,
    userRole: UserRole
  ): ConversationSession {
    let session = sessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        userId,
        userRole,
        messages: [],
        context: {},
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };
      sessions.set(sessionId, session);
    }

    session.lastActiveAt = new Date();
    return session;
  }

  private addMessage(
    session: ConversationSession,
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): ConversationMessage {
    const newMessage: ConversationMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    session.messages.push(newMessage);
    return newMessage;
  }

  // ===========================================================================
  // INTENT CLASSIFICATION
  // ===========================================================================

  private async classifyIntent(message: string): Promise<ClassifiedIntent> {
    // Use Claude for intent classification if available
    if (this.anthropic) {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: `You are an intent classifier. Classify the user's message into one of these intents:
- create_project: User wants to create a new project/website/app
- deployment: User wants to deploy something
- component_modification: User wants to modify UI components
- api_modification: User wants to modify APIs/backend
- feature_addition: User wants to add a new feature
- bug_fix: User wants to fix a bug
- code_review: User wants code reviewed
- file_operation: User wants to create/edit/delete files
- query: User is asking a question
- greeting: User is saying hello
- help: User needs help
- unknown: Can't determine intent

Respond with JSON only: {"type": "intent_type", "confidence": 0.0-1.0, "entities": []}`,
          messages: [{ role: 'user', content: message }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = JSON.parse(text);
        return {
          type: parsed.type,
          confidence: parsed.confidence,
          entities: parsed.entities || [],
        };
      } catch (error) {
        console.error('Intent classification error:', error);
      }
    }

    // Fallback to keyword matching
    return this.classifyIntentFallback(message);
  }

  private classifyIntentFallback(message: string): ClassifiedIntent {
    const lowerMessage = message.toLowerCase();

    if (/^(hi|hello|hey|good morning|good afternoon)/i.test(lowerMessage)) {
      return { type: 'greeting', confidence: 0.95, entities: [] };
    }

    if (/^(help|what can you do)/i.test(lowerMessage)) {
      return { type: 'help', confidence: 0.9, entities: [] };
    }

    if (/create.*project|create.*website|create.*app|new.*project|build.*site/i.test(lowerMessage)) {
      return { type: 'create_project', confidence: 0.85, entities: [] };
    }

    if (/deploy|publish|ship|release/i.test(lowerMessage)) {
      return { type: 'deployment', confidence: 0.85, entities: [] };
    }

    if (/fix|bug|issue|error|broken/i.test(lowerMessage)) {
      return { type: 'bug_fix', confidence: 0.8, entities: [] };
    }

    if (/add|create|update|modify.*component|button|ui/i.test(lowerMessage)) {
      return { type: 'component_modification', confidence: 0.75, entities: [] };
    }

    if (/api|endpoint|route|backend|database/i.test(lowerMessage)) {
      return { type: 'api_modification', confidence: 0.75, entities: [] };
    }

    if (/feature|implement|build/i.test(lowerMessage)) {
      return { type: 'feature_addition', confidence: 0.7, entities: [] };
    }

    return { type: 'query', confidence: 0.6, entities: [] };
  }

  // ===========================================================================
  // RESPONSE GENERATION
  // ===========================================================================

  private async generateResponse(
    message: string,
    intent: ClassifiedIntent,
    agent: AgentDefinition,
    session: ConversationSession
  ): Promise<{ response: string; pendingAction?: PendingAction; project?: Project }> {

    // Use Claude for response generation if available
    if (this.anthropic && intent.type !== 'greeting' && intent.type !== 'help') {
      try {
        const contextMessages = session.messages.slice(-10).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `${agent.systemPrompt}

You are helping a user manage their software projects. The user's role is ${session.userRole}.
${session.context.activeProject ? `They are currently working on: ${session.context.activeProject.name}` : ''}

Be concise but helpful. If the user wants to create a project, ask for:
1. Project name
2. Type (website, api, mobile app)
3. Framework preference (React, Next.js, Express, etc.)

If they want to deploy, confirm the environment (local, staging, production).`,
          messages: [
            ...contextMessages,
            { role: 'user', content: message },
          ],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        return { response: text };
      } catch (error) {
        console.error('Response generation error:', error);
      }
    }

    // Fallback responses
    return this.generateFallbackResponse(message, intent, agent, session);
  }

  private generateFallbackResponse(
    message: string,
    intent: ClassifiedIntent,
    agent: AgentDefinition,
    session: ConversationSession
  ): { response: string; pendingAction?: PendingAction; project?: Project } {

    if (intent.type === 'greeting') {
      return {
        response: `Hello! I'm Charlie, your AI development assistant. I can help you:

• **Create projects** - websites, APIs, mobile apps
• **Manage code** - write, review, and fix code
• **Deploy** - to local, staging, or production

What would you like to work on?`,
      };
    }

    if (intent.type === 'help') {
      return {
        response: `I can help you with:

• **Create a project** - "Create a new Next.js website"
• **Deploy** - "Deploy my-app to Vercel"
• **Code changes** - "Add a login form to the homepage"
• **Bug fixes** - "Fix the authentication error"
• **View projects** - "Show my projects"

Just describe what you need!`,
      };
    }

    if (intent.type === 'create_project') {
      return {
        response: `I'd love to help you create a new project! To get started, please tell me:

1. **Name** - What should we call it?
2. **Type** - Website, API, mobile app, or library?
3. **Framework** - Any preference? (React, Next.js, Express, etc.)

For example: "Create a Next.js website called my-portfolio"`,
      };
    }

    if (intent.type === 'deployment') {
      const pendingAction: PendingAction = {
        id: `action_${Date.now()}`,
        sessionId: session.id,
        userId: session.userId,
        type: 'deploy_staging',
        description: 'Deploy project to staging',
        impact: {
          severity: 'medium',
          filesAffected: 0,
          isReversible: true,
          estimatedDuration: '2-5 minutes',
        },
        parameters: {},
        requiresApproval: true,
        approvalLevel: APPROVAL_MATRIX.deploy_staging[session.userRole],
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      return {
        response: `I can help you deploy! Which project would you like to deploy, and to which environment?

• **Local** - Run locally for development
• **Staging** - Deploy to staging for testing
• **Production** - Deploy to production (Vercel, Netlify, etc.)`,
        pendingAction,
      };
    }

    return {
      response: `I understand you're asking about: "${message.slice(0, 100)}..."

${agent.id !== 'general' ? `I'm consulting with ${agent.name} on this.` : ''}

Could you provide more details so I can help you better?`,
    };
  }

  // ===========================================================================
  // PROJECT MANAGEMENT
  // ===========================================================================

  async getProjects(userId: string): Promise<Project[]> {
    return Array.from(projects.values()).filter(p => p.userId === userId);
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    return projects.get(projectId);
  }

  async createProject(
    userId: string,
    name: string,
    type: Project['type'],
    framework?: string
  ): Promise<Project> {
    const project: Project = {
      id: `proj_${Date.now()}`,
      name,
      type,
      framework,
      status: 'active',
      userId,
      createdAt: new Date(),
      lastModified: new Date(),
    };
    projects.set(project.id, project);
    return project;
  }

  async getProjectFiles(projectId: string): Promise<FileNode[]> {
    const project = projects.get(projectId);
    if (!project?.localPath) {
      return [];
    }

    // TODO: Implement actual file system reading
    // For now, return mock structure
    return [
      {
        name: 'src',
        path: '/src',
        type: 'directory',
        children: [
          { name: 'index.ts', path: '/src/index.ts', type: 'file' },
          { name: 'components', path: '/src/components', type: 'directory' },
        ],
      },
      { name: 'package.json', path: '/package.json', type: 'file' },
      { name: 'README.md', path: '/README.md', type: 'file' },
    ];
  }

  // ===========================================================================
  // MAIN ORCHESTRATOR FUNCTION
  // ===========================================================================

  async processMessage(request: CharlieRequest): Promise<CharlieResponse> {
    const { message, sessionId, userId, userRole, projectId } = request;

    // Get or create session
    const session = this.getOrCreateSession(sessionId, userId, userRole);

    // Set project context if provided
    if (projectId) {
      const project = await this.getProject(projectId);
      if (project) {
        session.context.activeProject = project;
      }
    }

    // Add user message to session
    this.addMessage(session, { role: 'user', content: message });

    // Classify intent
    const intent = await this.classifyIntent(message);

    // Route to appropriate agent
    const intentObj: Intent = {
      type: intent.type,
      confidence: intent.confidence,
      entities: intent.entities,
    };
    const agent = selectAgentByContext(message, intentObj);

    // Generate response
    const { response, pendingAction, project } = await this.generateResponse(
      message,
      intent,
      agent,
      session
    );

    // Record agent interaction
    session.context.agentHistory = session.context.agentHistory || [];
    session.context.agentHistory.push({
      agent: agent.id,
      task: message.slice(0, 100),
      result: response.slice(0, 100),
      timestamp: new Date(),
    });

    // Add assistant message
    this.addMessage(session, {
      role: 'assistant',
      content: response,
      intent,
      pendingAction,
    });

    // Store pending action
    if (pendingAction) {
      session.context.pendingActions = session.context.pendingActions || [];
      session.context.pendingActions.push(pendingAction);
    }

    return {
      message: response,
      intent,
      agentUsed: agent.id,
      pendingAction,
      project,
    };
  }

  // ===========================================================================
  // ACTION APPROVAL
  // ===========================================================================

  async approveAction(
    sessionId: string,
    actionId: string,
    approved: boolean
  ): Promise<{ success: boolean; message: string }> {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    const pendingActions = session.context.pendingActions || [];
    const actionIndex = pendingActions.findIndex(a => a.id === actionId);

    if (actionIndex === -1) {
      return { success: false, message: 'Action not found' };
    }

    const action = pendingActions[actionIndex];

    if (approved) {
      action.status = 'approved';
      // TODO: Execute the action
      return {
        success: true,
        message: `Action "${action.description}" approved and queued for execution.`,
      };
    } else {
      action.status = 'rejected';
      return {
        success: true,
        message: `Action "${action.description}" has been cancelled.`,
      };
    }
  }

  // ===========================================================================
  // SESSION HELPERS
  // ===========================================================================

  getSession(sessionId: string): ConversationSession | undefined {
    return sessions.get(sessionId);
  }

  clearSession(sessionId: string): boolean {
    return sessions.delete(sessionId);
  }
}

// Singleton instance
let charlieService: CharlieService | null = null;

export function getCharlieService(): CharlieService {
  if (!charlieService) {
    charlieService = new CharlieService();
  }
  return charlieService;
}
