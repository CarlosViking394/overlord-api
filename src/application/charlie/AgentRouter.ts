/**
 * Agent Router
 *
 * Routes user intents to specialized Charlie agents.
 * Each agent has specific capabilities and expertise.
 */

import type { IntentType, AgentType, Intent } from './types';

export interface AgentDefinition {
  id: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  priority: number;
}

export const AGENTS: Record<AgentType, AgentDefinition> = {
  backend: {
    id: 'backend',
    name: 'BackEndCharlie',
    description: 'Specializes in backend development, APIs, databases, and server-side logic',
    capabilities: [
      'api_development',
      'database_design',
      'server_configuration',
      'authentication',
      'data_modeling',
    ],
    systemPrompt: `You are BackEndCharlie, a specialized backend development agent.
You excel at:
- Designing and implementing RESTful and GraphQL APIs
- Database schema design (PostgreSQL, MongoDB, Redis)
- Server-side Node.js/TypeScript development
- Authentication and authorization systems
- Microservices architecture

Always provide clean, production-ready code with proper error handling.`,
    priority: 80,
  },

  frontend: {
    id: 'frontend',
    name: 'FrontEndCharlie',
    description: 'Specializes in frontend development, React, and user interfaces',
    capabilities: [
      'react_development',
      'component_design',
      'state_management',
      'ui_implementation',
    ],
    systemPrompt: `You are FrontEndCharlie, a specialized frontend development agent.
You excel at:
- React and Next.js development
- TypeScript for type-safe frontends
- Component architecture and design patterns
- State management (React Context, Zustand)
- Performance optimization

Always write clean, reusable components with proper typing.`,
    priority: 80,
  },

  architecture: {
    id: 'architecture',
    name: 'ArchitectureCharlie',
    description: 'Specializes in system design and technical planning',
    capabilities: [
      'system_design',
      'architecture_review',
      'tech_stack_selection',
      'scalability_planning',
    ],
    systemPrompt: `You are ArchitectureCharlie, a specialized architecture agent.
You excel at:
- System design and architecture planning
- Technology choices and tradeoffs
- Designing scalable systems
- Creating technical documentation

Always consider maintainability, scalability, and developer experience.`,
    priority: 90,
  },

  bugHunter: {
    id: 'bugHunter',
    name: 'BugHunterCharlie',
    description: 'Specializes in debugging and quality assurance',
    capabilities: [
      'debugging',
      'error_analysis',
      'test_development',
      'performance_profiling',
    ],
    systemPrompt: `You are BugHunterCharlie, a specialized debugging agent.
You excel at:
- Tracking down and fixing bugs
- Analyzing error logs and stack traces
- Writing comprehensive test suites
- Performance profiling

Always provide clear explanations and systematic fixes.`,
    priority: 85,
  },

  webDesign: {
    id: 'webDesign',
    name: 'WebDesignCharlie',
    description: 'Specializes in UI/UX design and styling',
    capabilities: [
      'ui_design',
      'ux_improvement',
      'design_systems',
      'animation',
    ],
    systemPrompt: `You are WebDesignCharlie, a specialized UI/UX design agent.
You excel at:
- Creating beautiful user interfaces
- Design system development
- Color theory and typography
- CSS animations and micro-interactions

Always prioritize usability while maintaining aesthetic appeal.`,
    priority: 75,
  },

  general: {
    id: 'general',
    name: 'Charlie',
    description: 'General-purpose assistant for all development tasks',
    capabilities: ['general_help', 'explanation', 'guidance', 'coordination'],
    systemPrompt: `You are Charlie, a helpful AI development assistant.
You can help with all aspects of software development and can coordinate
with specialized agents when needed.`,
    priority: 50,
  },
};

const INTENT_AGENT_MAP: Record<IntentType, AgentType[]> = {
  create_project: ['architecture', 'frontend', 'backend'],
  deployment: ['backend', 'architecture'],
  component_modification: ['frontend', 'webDesign'],
  api_modification: ['backend', 'architecture'],
  feature_addition: ['architecture', 'backend', 'frontend'],
  bug_fix: ['bugHunter', 'backend', 'frontend'],
  code_review: ['bugHunter', 'architecture'],
  file_operation: ['general'],
  system_command: ['general'],
  query: ['general'],
  greeting: ['general'],
  help: ['general'],
  unknown: ['general'],
};

export function selectAgent(intent: Intent): AgentDefinition {
  const candidateAgentTypes = INTENT_AGENT_MAP[intent.type] || ['general'];
  const candidates = candidateAgentTypes.map(type => AGENTS[type]).filter(Boolean);

  if (candidates.length === 0) {
    return AGENTS.general;
  }

  return candidates.reduce((best, current) =>
    current.priority > best.priority ? current : best
  );
}

export function selectAgentByContext(message: string, intent: Intent): AgentDefinition {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('api') || lowerMessage.includes('endpoint') || lowerMessage.includes('database')) {
    return AGENTS.backend;
  }

  if (lowerMessage.includes('component') || lowerMessage.includes('react') || lowerMessage.includes('ui')) {
    return AGENTS.frontend;
  }

  if (lowerMessage.includes('design') || lowerMessage.includes('style') || lowerMessage.includes('css')) {
    return AGENTS.webDesign;
  }

  if (lowerMessage.includes('bug') || lowerMessage.includes('fix') || lowerMessage.includes('error')) {
    return AGENTS.bugHunter;
  }

  if (lowerMessage.includes('architecture') || lowerMessage.includes('plan') || lowerMessage.includes('create') && lowerMessage.includes('project')) {
    return AGENTS.architecture;
  }

  return selectAgent(intent);
}

export function getAgentSystemPrompt(agentType: AgentType): string {
  return AGENTS[agentType]?.systemPrompt || AGENTS.general.systemPrompt;
}

export function getAllAgents(): AgentDefinition[] {
  return Object.values(AGENTS);
}
