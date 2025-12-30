/**
 * Core domain types for the Overlord API
 * These types represent the fundamental concepts in our multi-service environment
 */

export enum ServiceType {
    AGENT = 'agent',
    WEB_APP = 'web_app',
    MOBILE_APP = 'mobile_app',
    API = 'api'
}

export enum ServiceStatus {
    HEALTHY = 'healthy',
    UNHEALTHY = 'unhealthy',
    DEGRADED = 'degraded',
    UNKNOWN = 'unknown',
    STARTING = 'starting',
    STOPPING = 'stopping'
}

export enum CommandStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    FAILED = 'failed',
    TIMEOUT = 'timeout'
}

export enum WorkflowStatus {
    CREATED = 'created',
    RUNNING = 'running',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

export enum EventType {
    SERVICE_REGISTERED = 'service.registered',
    SERVICE_DEREGISTERED = 'service.deregistered',
    SERVICE_HEALTH_CHANGED = 'service.health_changed',
    COMMAND_DISPATCHED = 'command.dispatched',
    COMMAND_COMPLETED = 'command.completed',
    COMMAND_FAILED = 'command.failed',
    WORKFLOW_STARTED = 'workflow.started',
    WORKFLOW_COMPLETED = 'workflow.completed',
    WORKFLOW_FAILED = 'workflow.failed'
}

export interface ServiceCapability {
    name: string;
    version: string;
    description?: string;
}

export interface HealthCheckResult {
    status: ServiceStatus;
    timestamp: Date;
    responseTimeMs: number;
    details?: Record<string, unknown>;
}

export interface CommandResult {
    commandId: string;
    status: CommandStatus;
    result?: unknown;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
}

export interface WorkflowStep {
    stepId: string;
    name: string;
    serviceId: string;
    command: string;
    params?: Record<string, unknown>;
    dependsOn?: string[];
    status: CommandStatus;
    result?: unknown;
}
