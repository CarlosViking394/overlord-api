/**
 * Charlie Orchestrator Types
 *
 * Core types for the Charlie conversation and action system.
 */

// =============================================================================
// USER & PERMISSION TYPES
// =============================================================================

export type UserRole = 'OVERLORD' | 'ADMIN' | 'LORD';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  workspaceId?: string;
  voiceId?: string;
}

// =============================================================================
// PROJECT TYPES
// =============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  repoUrl?: string;
  localPath?: string;
  type: 'website' | 'api' | 'mobile' | 'library' | 'other';
  status: 'active' | 'archived' | 'deploying' | 'error';
  framework?: string;
  lastModified: Date;
  createdAt: Date;
  userId: string;
  workspaceId?: string;
  deployments?: Deployment[];
}

export interface Deployment {
  id: string;
  projectId: string;
  environment: 'development' | 'staging' | 'production';
  url?: string;
  status: 'pending' | 'building' | 'deployed' | 'failed';
  provider: 'vercel' | 'netlify' | 'local' | 'other';
  createdAt: Date;
  deployedAt?: Date;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  lastModified?: Date;
}

// =============================================================================
// CONVERSATION TYPES
// =============================================================================

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: ClassifiedIntent;
  actions?: ExecutedAction[];
  pendingAction?: PendingAction;
  projectContext?: string; // Which project this message relates to
}

export interface ConversationSession {
  id: string;
  userId: string;
  userRole: UserRole;
  messages: ConversationMessage[];
  context: ConversationContext;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface ConversationContext {
  activeProject?: Project;
  activeFiles?: string[];
  pendingActions?: PendingAction[];
  agentHistory?: AgentInteraction[];
}

export interface AgentInteraction {
  agent: AgentType;
  task: string;
  result: string;
  timestamp: Date;
}

// =============================================================================
// INTENT TYPES
// =============================================================================

export interface ClassifiedIntent {
  type: IntentType;
  confidence: number;
  entities: ExtractedEntity[];
}

export type IntentType =
  | 'query'
  | 'create_project'
  | 'deployment'
  | 'component_modification'
  | 'api_modification'
  | 'feature_addition'
  | 'bug_fix'
  | 'code_review'
  | 'file_operation'
  | 'system_command'
  | 'greeting'
  | 'help'
  | 'unknown';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
}

export type EntityType =
  | 'project'
  | 'app'
  | 'component'
  | 'file'
  | 'endpoint'
  | 'feature'
  | 'action'
  | 'location'
  | 'branch'
  | 'environment'
  | 'framework';

// =============================================================================
// ACTION TYPES
// =============================================================================

export interface PendingAction {
  id: string;
  sessionId: string;
  userId: string;
  type: ActionType;
  description: string;
  impact: ActionImpact;
  parameters: Record<string, unknown>;
  codeChanges?: CodeChange[];
  requiresApproval: boolean;
  approvalLevel: ApprovalLevel;
  status: ActionStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface ExecutedAction {
  id: string;
  type: ActionType;
  description: string;
  result: 'success' | 'failure';
  output?: string;
  error?: string;
  executedAt: Date;
}

export type ActionType =
  | 'project_create'
  | 'project_delete'
  | 'file_create'
  | 'file_modify'
  | 'file_delete'
  | 'git_commit'
  | 'git_push'
  | 'git_pr'
  | 'deploy_local'
  | 'deploy_staging'
  | 'deploy_production'
  | 'system_command'
  | 'query';

export interface ActionImpact {
  severity: 'low' | 'medium' | 'high' | 'critical';
  filesAffected: number;
  isReversible: boolean;
  estimatedDuration: string;
}

export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'expired';

export type ApprovalLevel = 'auto' | 'user' | 'admin';

// =============================================================================
// CODE CHANGE TYPES
// =============================================================================

export interface CodeChange {
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  content?: string;
  diff?: string;
  language?: string;
}

// =============================================================================
// AGENT TYPES
// =============================================================================

export type AgentType =
  | 'backend'
  | 'frontend'
  | 'architecture'
  | 'bugHunter'
  | 'webDesign'
  | 'general';

export interface AgentSelection {
  agent: AgentType;
  confidence: number;
  reason: string;
}

export interface Intent {
  type: IntentType;
  confidence: number;
  entities: ExtractedEntity[];
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface CharlieRequest {
  message: string;
  sessionId: string;
  userId: string;
  userRole: UserRole;
  projectId?: string; // Optional: context of current project
  audioBase64?: string;
}

export interface CharlieResponse {
  message: string;
  intent?: ClassifiedIntent;
  agentUsed?: AgentType;
  pendingAction?: PendingAction;
  codeChanges?: CodeChange[];
  suggestions?: string[];
  audioBase64?: string;
  project?: Project; // If a project was created/modified
}

// =============================================================================
// APPROVAL MATRIX
// =============================================================================

export const APPROVAL_MATRIX: Record<ActionType, Record<UserRole, ApprovalLevel>> = {
  project_create: { OVERLORD: 'auto', ADMIN: 'user', LORD: 'admin' },
  project_delete: { OVERLORD: 'user', ADMIN: 'admin', LORD: 'admin' },
  file_create: { OVERLORD: 'auto', ADMIN: 'user', LORD: 'admin' },
  file_modify: { OVERLORD: 'auto', ADMIN: 'user', LORD: 'admin' },
  file_delete: { OVERLORD: 'user', ADMIN: 'admin', LORD: 'admin' },
  git_commit: { OVERLORD: 'auto', ADMIN: 'user', LORD: 'admin' },
  git_push: { OVERLORD: 'user', ADMIN: 'admin', LORD: 'admin' },
  git_pr: { OVERLORD: 'user', ADMIN: 'user', LORD: 'admin' },
  deploy_local: { OVERLORD: 'auto', ADMIN: 'auto', LORD: 'user' },
  deploy_staging: { OVERLORD: 'user', ADMIN: 'user', LORD: 'admin' },
  deploy_production: { OVERLORD: 'user', ADMIN: 'admin', LORD: 'admin' },
  system_command: { OVERLORD: 'user', ADMIN: 'admin', LORD: 'admin' },
  query: { OVERLORD: 'auto', ADMIN: 'auto', LORD: 'auto' },
};
