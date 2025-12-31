/**
 * Drizzle ORM Schema Definitions
 * Matches the PostgreSQL init-db.sql schema
 */

import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    integer,
    jsonb,
    pgEnum,
    inet,
    index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// ENUMS
// =============================================================================

export const userRoleEnum = pgEnum('user_role', ['OVERLORD', 'ADMIN', 'LORD']);

export const serviceTypeEnum = pgEnum('service_type', ['agent', 'web_app', 'mobile_app', 'api']);

export const serviceStatusEnum = pgEnum('service_status', [
    'healthy', 'unhealthy', 'degraded', 'unknown', 'starting', 'stopping'
]);

export const commandStatusEnum = pgEnum('command_status', [
    'pending', 'in_progress', 'completed', 'failed', 'timeout'
]);

export const workflowStatusEnum = pgEnum('workflow_status', [
    'created', 'running', 'paused', 'completed', 'failed', 'cancelled'
]);

export const eventTypeEnum = pgEnum('event_type', [
    'service.registered',
    'service.deregistered',
    'service.health_changed',
    'command.dispatched',
    'command.completed',
    'command.failed',
    'workflow.started',
    'workflow.completed',
    'workflow.failed'
]);

// =============================================================================
// WORKSPACES TABLE
// =============================================================================

export const workspaces = pgTable('workspaces', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    ownerId: uuid('owner_id').notNull(),
    settings: jsonb('settings').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    slugIdx: index('idx_workspaces_slug').on(table.slug),
    ownerIdx: index('idx_workspaces_owner').on(table.ownerId),
}));

// =============================================================================
// USERS TABLE
// =============================================================================

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    role: userRoleEnum('role').notNull().default('LORD'),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    permissions: jsonb('permissions'),
    voiceId: varchar('voice_id', { length: 255 }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    roleIdx: index('idx_users_role').on(table.role),
    workspaceIdx: index('idx_users_workspace').on(table.workspaceId),
}));

// =============================================================================
// API KEYS TABLE
// =============================================================================

export const apiKeys = pgTable('api_keys', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(),
    permissions: jsonb('permissions').default({}),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userIdx: index('idx_api_keys_user').on(table.userId),
    hashIdx: index('idx_api_keys_hash').on(table.keyHash),
}));

// =============================================================================
// SERVICES TABLE
// =============================================================================

export const services = pgTable('services', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    type: serviceTypeEnum('type').notNull(),
    baseUrl: varchar('base_url', { length: 512 }).notNull(),
    healthEndpoint: varchar('health_endpoint', { length: 255 }).default('/health'),
    capabilities: jsonb('capabilities').default([]),
    metadata: jsonb('metadata').default({}),
    version: varchar('version', { length: 50 }).default('1.0.0'),
    status: serviceStatusEnum('status').default('starting'),
    lastHealthCheck: jsonb('last_health_check'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    typeIdx: index('idx_services_type').on(table.type),
    statusIdx: index('idx_services_status').on(table.status),
}));

// =============================================================================
// WORKFLOWS TABLE
// =============================================================================

export const workflows = pgTable('workflows', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    status: workflowStatusEnum('status').default('created'),
    currentStepIndex: integer('current_step_index').default(0),
    metadata: jsonb('metadata').default({}),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
    statusIdx: index('idx_workflows_status').on(table.status),
}));

// =============================================================================
// WORKFLOW STEPS TABLE
// =============================================================================

export const workflowSteps = pgTable('workflow_steps', {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
    stepId: varchar('step_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    serviceId: varchar('service_id', { length: 255 }).references(() => services.id, { onDelete: 'set null' }),
    command: varchar('command', { length: 255 }).notNull(),
    params: jsonb('params').default({}),
    dependsOn: text('depends_on').array().default([]),
    status: commandStatusEnum('status').default('pending'),
    result: jsonb('result'),
    stepOrder: integer('step_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
    workflowIdx: index('idx_workflow_steps_workflow').on(table.workflowId),
    statusIdx: index('idx_workflow_steps_status').on(table.status),
}));

// =============================================================================
// COMMANDS TABLE
// =============================================================================

export const commands = pgTable('commands', {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceId: varchar('service_id', { length: 255 }).references(() => services.id, { onDelete: 'set null' }),
    command: varchar('command', { length: 255 }).notNull(),
    params: jsonb('params').default({}),
    status: commandStatusEnum('status').default('pending'),
    result: jsonb('result'),
    error: text('error'),
    dispatchedBy: uuid('dispatched_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    timeoutMs: integer('timeout_ms').default(30000),
}, (table) => ({
    serviceIdx: index('idx_commands_service').on(table.serviceId),
    statusIdx: index('idx_commands_status').on(table.status),
}));

// =============================================================================
// EVENTS TABLE
// =============================================================================

export const events = pgTable('events', {
    id: uuid('id').primaryKey().defaultRandom(),
    type: eventTypeEnum('type').notNull(),
    serviceId: varchar('service_id', { length: 255 }),
    data: jsonb('data').default({}),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
}, (table) => ({
    typeIdx: index('idx_events_type').on(table.type),
    serviceIdx: index('idx_events_service').on(table.serviceId),
    timestampIdx: index('idx_events_timestamp').on(table.timestamp),
}));

// =============================================================================
// SESSIONS TABLE
// =============================================================================

export const sessions = pgTable('sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    userIdx: index('idx_sessions_user').on(table.userId),
    tokenIdx: index('idx_sessions_token').on(table.tokenHash),
    expiresIdx: index('idx_sessions_expires').on(table.expiresAt),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const workspacesRelations = relations(workspaces, ({ many }) => ({
    users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    workspace: one(workspaces, {
        fields: [users.workspaceId],
        references: [workspaces.id],
    }),
    apiKeys: many(apiKeys),
    sessions: many(sessions),
    createdByUser: one(users, {
        fields: [users.createdBy],
        references: [users.id],
    }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
    user: one(users, {
        fields: [apiKeys.userId],
        references: [users.id],
    }),
}));

export const workflowsRelations = relations(workflows, ({ many }) => ({
    steps: many(workflowSteps),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
    workflow: one(workflows, {
        fields: [workflowSteps.workflowId],
        references: [workflows.id],
    }),
    service: one(services, {
        fields: [workflowSteps.serviceId],
        references: [services.id],
    }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type NewWorkflowStep = typeof workflowSteps.$inferInsert;

export type Command = typeof commands.$inferSelect;
export type NewCommand = typeof commands.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
