/**
 * Integrations Hub
 *
 * Central orchestration service for all third-party integrations.
 * Charlie uses this hub to transform business ideas into reality.
 *
 * Flow:
 * 1. User describes business idea
 * 2. Charlie creates action plan with required integrations
 * 3. Hub validates user has connected required integrations
 * 4. Hub requests approval for actions (especially purchase/delete)
 * 5. Hub executes approved actions in sequence
 * 6. Hub provides status updates and handles failures
 */

import {
    IntegrationProvider,
    IntegrationCategory,
    IntegrationConnection,
    PendingAction,
    ActionLevel,
    ActionResult,
    BusinessTemplate,
    TemplateAction,
    IntegrationEvent,
} from '../../domain/integrations/types';
import { IIntegration } from './IIntegration';
import { IGitHubIntegration } from './github/IGitHubIntegration';
import { IVercelIntegration } from './vercel/IVercelIntegration';
import { IDomainsIntegration } from './domains/IDomainsIntegration';

// ==================
// Hub Types
// ==================

export interface IntegrationRegistry {
    [key: string]: IIntegration;
}

export interface ActionPlan {
    id: string;
    userId: string;
    name: string;
    description: string;
    template?: BusinessTemplate;
    actions: PlannedAction[];
    status: 'draft' | 'pending_approval' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    results: ActionResult[];
    errors: string[];
}

export interface PlannedAction {
    id: string;
    step: number;
    integration: IntegrationProvider;
    method: string;
    description: string;
    params: Record<string, unknown>;
    actionLevel: ActionLevel;
    requiresApproval: boolean;
    dependsOn?: string[]; // IDs of actions that must complete first
    status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'skipped';
    result?: ActionResult;
    error?: string;
}

export interface HubStatus {
    connected: IntegrationProvider[];
    disconnected: IntegrationProvider[];
    pendingApprovals: number;
    activePlans: number;
}

// ==================
// Action Level Configuration
// ==================

const ACTION_LEVELS_REQUIRING_APPROVAL: ActionLevel[] = ['delete', 'purchase'];
const ACTION_LEVELS_REQUIRING_CONFIRMATION: ActionLevel[] = ['modify'];

// ==================
// Integrations Hub Interface
// ==================

export interface IIntegrationsHub {
    // ==================
    // Registry
    // ==================

    /**
     * Register an integration provider
     */
    registerIntegration(integration: IIntegration): void;

    /**
     * Get integration by provider
     */
    getIntegration(provider: IntegrationProvider): IIntegration | undefined;

    /**
     * Get all registered integrations
     */
    getAllIntegrations(): IIntegration[];

    /**
     * Get integrations by category
     */
    getIntegrationsByCategory(category: IntegrationCategory): IIntegration[];

    // ==================
    // Connection Management
    // ==================

    /**
     * Get user's connected integrations
     */
    getConnectedIntegrations(userId: string): Promise<IntegrationConnection[]>;

    /**
     * Check if user has required integrations connected
     */
    validateRequiredIntegrations(
        userId: string,
        required: IntegrationProvider[]
    ): Promise<{ valid: boolean; missing: IntegrationProvider[] }>;

    /**
     * Get hub status for a user
     */
    getHubStatus(userId: string): Promise<HubStatus>;

    // ==================
    // Action Planning
    // ==================

    /**
     * Create an action plan from a business template
     */
    createPlanFromTemplate(
        userId: string,
        template: BusinessTemplate,
        userInputs: Record<string, unknown>
    ): Promise<ActionPlan>;

    /**
     * Create a custom action plan
     */
    createPlan(
        userId: string,
        name: string,
        description: string,
        actions: Omit<PlannedAction, 'id' | 'status'>[]
    ): Promise<ActionPlan>;

    /**
     * Get action plan by ID
     */
    getPlan(userId: string, planId: string): Promise<ActionPlan | undefined>;

    /**
     * List user's action plans
     */
    listPlans(
        userId: string,
        options?: { status?: ActionPlan['status']; limit?: number }
    ): Promise<ActionPlan[]>;

    // ==================
    // Approval Flow
    // ==================

    /**
     * Get pending actions requiring approval
     */
    getPendingApprovals(userId: string): Promise<PendingAction[]>;

    /**
     * Approve a pending action
     */
    approveAction(userId: string, actionId: string): Promise<void>;

    /**
     * Reject a pending action
     */
    rejectAction(userId: string, actionId: string, reason?: string): Promise<void>;

    /**
     * Approve all actions in a plan
     */
    approvePlan(userId: string, planId: string): Promise<void>;

    // ==================
    // Execution
    // ==================

    /**
     * Execute an action plan
     * Executes all approved actions in sequence
     */
    executePlan(userId: string, planId: string): Promise<ActionPlan>;

    /**
     * Execute a single action
     */
    executeAction(
        userId: string,
        integration: IntegrationProvider,
        method: string,
        params: Record<string, unknown>
    ): Promise<ActionResult>;

    /**
     * Cancel an in-progress plan
     */
    cancelPlan(userId: string, planId: string): Promise<void>;

    // ==================
    // Events & Audit
    // ==================

    /**
     * Get integration events for a user
     */
    getEvents(
        userId: string,
        options?: {
            integration?: IntegrationProvider;
            limit?: number;
            from?: Date;
            to?: Date;
        }
    ): Promise<IntegrationEvent[]>;
}

/**
 * Integrations Hub Implementation
 *
 * This is the central service that Charlie uses to:
 * 1. Discover available integrations
 * 2. Check user's connected integrations
 * 3. Plan and execute multi-step business automation
 * 4. Handle approval flow for sensitive actions
 */
export class IntegrationsHub implements IIntegrationsHub {
    private registry: IntegrationRegistry = {};
    // TODO: Inject these dependencies
    // private credentialsVault: ICredentialsVault;
    // private actionStore: IActionStore;
    // private eventStore: IEventStore;

    // ==================
    // Registry
    // ==================

    registerIntegration(integration: IIntegration): void {
        this.registry[integration.provider] = integration;
    }

    getIntegration(provider: IntegrationProvider): IIntegration | undefined {
        return this.registry[provider];
    }

    getAllIntegrations(): IIntegration[] {
        return Object.values(this.registry);
    }

    getIntegrationsByCategory(category: IntegrationCategory): IIntegration[] {
        return this.getAllIntegrations().filter((i) => i.category === category);
    }

    // ==================
    // Connection Management
    // ==================

    async getConnectedIntegrations(userId: string): Promise<IntegrationConnection[]> {
        // TODO: Implement - fetch from credentials vault
        throw new Error('Not implemented');
    }

    async validateRequiredIntegrations(
        userId: string,
        required: IntegrationProvider[]
    ): Promise<{ valid: boolean; missing: IntegrationProvider[] }> {
        const connections = await this.getConnectedIntegrations(userId);
        const connectedProviders = connections
            .filter((c) => c.status.connected)
            .map((c) => c.provider);

        const missing = required.filter((r) => !connectedProviders.includes(r));

        return {
            valid: missing.length === 0,
            missing,
        };
    }

    async getHubStatus(userId: string): Promise<HubStatus> {
        const connections = await this.getConnectedIntegrations(userId);
        const pendingApprovals = await this.getPendingApprovals(userId);
        const activePlans = await this.listPlans(userId, { status: 'in_progress' });

        const connected = connections
            .filter((c) => c.status.connected)
            .map((c) => c.provider);

        const allProviders = this.getAllIntegrations().map((i) => i.provider);
        const disconnected = allProviders.filter((p) => !connected.includes(p));

        return {
            connected,
            disconnected,
            pendingApprovals: pendingApprovals.length,
            activePlans: activePlans.length,
        };
    }

    // ==================
    // Action Planning
    // ==================

    async createPlanFromTemplate(
        userId: string,
        template: BusinessTemplate,
        userInputs: Record<string, unknown>
    ): Promise<ActionPlan> {
        const planId = this.generateId();

        // Map template actions to planned actions
        const actions: PlannedAction[] = template.actions.map((ta, index) => ({
            id: this.generateId(),
            step: ta.step,
            integration: this.extractProvider(ta.action),
            method: this.extractMethod(ta.action),
            description: ta.description,
            params: this.mergeParams(ta.params, userInputs, ta.requiresUserInput),
            actionLevel: this.determineActionLevel(ta.action),
            requiresApproval: this.requiresApproval(ta.action),
            status: 'pending' as const,
        }));

        const plan: ActionPlan = {
            id: planId,
            userId,
            name: template.name,
            description: template.description,
            template,
            actions,
            status: 'draft',
            createdAt: new Date(),
            results: [],
            errors: [],
        };

        // TODO: Store plan
        return plan;
    }

    async createPlan(
        userId: string,
        name: string,
        description: string,
        actions: Omit<PlannedAction, 'id' | 'status'>[]
    ): Promise<ActionPlan> {
        const planId = this.generateId();

        const plannedActions: PlannedAction[] = actions.map((a) => ({
            ...a,
            id: this.generateId(),
            status: 'pending' as const,
        }));

        const plan: ActionPlan = {
            id: planId,
            userId,
            name,
            description,
            actions: plannedActions,
            status: 'draft',
            createdAt: new Date(),
            results: [],
            errors: [],
        };

        // TODO: Store plan
        return plan;
    }

    async getPlan(userId: string, planId: string): Promise<ActionPlan | undefined> {
        // TODO: Implement - fetch from store
        throw new Error('Not implemented');
    }

    async listPlans(
        userId: string,
        options?: { status?: ActionPlan['status']; limit?: number }
    ): Promise<ActionPlan[]> {
        // TODO: Implement - fetch from store
        throw new Error('Not implemented');
    }

    // ==================
    // Approval Flow
    // ==================

    async getPendingApprovals(userId: string): Promise<PendingAction[]> {
        // TODO: Implement - fetch from action store
        throw new Error('Not implemented');
    }

    async approveAction(userId: string, actionId: string): Promise<void> {
        // TODO: Implement
        throw new Error('Not implemented');
    }

    async rejectAction(userId: string, actionId: string, reason?: string): Promise<void> {
        // TODO: Implement
        throw new Error('Not implemented');
    }

    async approvePlan(userId: string, planId: string): Promise<void> {
        // TODO: Implement - approve all pending actions in plan
        throw new Error('Not implemented');
    }

    // ==================
    // Execution
    // ==================

    async executePlan(userId: string, planId: string): Promise<ActionPlan> {
        const plan = await this.getPlan(userId, planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }

        // Validate all required integrations are connected
        const requiredIntegrations = [...new Set(plan.actions.map((a) => a.integration))];
        const validation = await this.validateRequiredIntegrations(userId, requiredIntegrations);

        if (!validation.valid) {
            throw new Error(
                `Missing required integrations: ${validation.missing.join(', ')}`
            );
        }

        // Check all actions requiring approval are approved
        const unapproved = plan.actions.filter(
            (a) => a.requiresApproval && a.status !== 'approved'
        );

        if (unapproved.length > 0) {
            throw new Error(
                `Actions requiring approval: ${unapproved.map((a) => a.description).join(', ')}`
            );
        }

        // Update plan status
        plan.status = 'in_progress';
        plan.startedAt = new Date();

        // Execute actions in order, respecting dependencies
        for (const action of this.sortByDependencies(plan.actions)) {
            if (action.status === 'skipped' || action.status === 'completed') {
                continue;
            }

            // Check dependencies
            if (action.dependsOn) {
                const dependenciesMet = action.dependsOn.every((depId) => {
                    const dep = plan.actions.find((a) => a.id === depId);
                    return dep?.status === 'completed';
                });

                if (!dependenciesMet) {
                    action.status = 'skipped';
                    action.error = 'Dependencies not met';
                    continue;
                }
            }

            try {
                action.status = 'executing';
                const result = await this.executeAction(
                    userId,
                    action.integration,
                    action.method,
                    action.params
                );
                action.result = result;
                action.status = result.success ? 'completed' : 'failed';

                if (!result.success) {
                    action.error = result.error;
                    plan.errors.push(`${action.description}: ${result.error}`);
                } else {
                    plan.results.push(result);
                }
            } catch (error) {
                action.status = 'failed';
                action.error = error instanceof Error ? error.message : 'Unknown error';
                plan.errors.push(`${action.description}: ${action.error}`);
            }
        }

        // Update plan status
        const hasFailures = plan.actions.some((a) => a.status === 'failed');
        plan.status = hasFailures ? 'failed' : 'completed';
        plan.completedAt = new Date();

        // TODO: Save plan state
        return plan;
    }

    async executeAction(
        userId: string,
        integration: IntegrationProvider,
        method: string,
        params: Record<string, unknown>
    ): Promise<ActionResult> {
        const startTime = Date.now();
        const integrationInstance = this.getIntegration(integration);

        if (!integrationInstance) {
            return {
                success: false,
                action: `${integration}.${method}`,
                error: `Integration ${integration} not registered`,
                duration: Date.now() - startTime,
            };
        }

        try {
            // Type assertion based on method signature
            // In production, this would be properly typed per integration
            const methodFn = (integrationInstance as Record<string, unknown>)[method];
            if (typeof methodFn !== 'function') {
                return {
                    success: false,
                    action: `${integration}.${method}`,
                    error: `Method ${method} not found on ${integration}`,
                    duration: Date.now() - startTime,
                };
            }

            const result = await methodFn.call(integrationInstance, userId, params);

            // Log event
            await this.logEvent({
                id: this.generateId(),
                userId,
                integration,
                action: method,
                actionLevel: this.determineActionLevel(`${integration}.${method}`),
                status: 'success',
                params,
                result: result.data,
                duration: Date.now() - startTime,
                timestamp: new Date(),
            });

            return {
                success: true,
                action: `${integration}.${method}`,
                data: result.data,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Log event
            await this.logEvent({
                id: this.generateId(),
                userId,
                integration,
                action: method,
                actionLevel: this.determineActionLevel(`${integration}.${method}`),
                status: 'failed',
                params,
                error: errorMessage,
                duration: Date.now() - startTime,
                timestamp: new Date(),
            });

            return {
                success: false,
                action: `${integration}.${method}`,
                error: errorMessage,
                duration: Date.now() - startTime,
            };
        }
    }

    async cancelPlan(userId: string, planId: string): Promise<void> {
        const plan = await this.getPlan(userId, planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }

        if (plan.status !== 'in_progress' && plan.status !== 'pending_approval') {
            throw new Error(`Plan ${planId} cannot be cancelled (status: ${plan.status})`);
        }

        plan.status = 'cancelled';
        // TODO: Save plan
    }

    // ==================
    // Events & Audit
    // ==================

    async getEvents(
        userId: string,
        options?: {
            integration?: IntegrationProvider;
            limit?: number;
            from?: Date;
            to?: Date;
        }
    ): Promise<IntegrationEvent[]> {
        // TODO: Implement - fetch from event store
        throw new Error('Not implemented');
    }

    // ==================
    // Private Helpers
    // ==================

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private extractProvider(action: string): IntegrationProvider {
        const [provider] = action.split('.');
        return provider as IntegrationProvider;
    }

    private extractMethod(action: string): string {
        const parts = action.split('.');
        return parts.slice(1).join('.');
    }

    private mergeParams(
        templateParams: Record<string, unknown>,
        userInputs: Record<string, unknown>,
        requiresUserInput?: string[]
    ): Record<string, unknown> {
        const params = { ...templateParams };

        if (requiresUserInput) {
            for (const key of requiresUserInput) {
                if (userInputs[key] !== undefined) {
                    params[key] = userInputs[key];
                }
            }
        }

        return params;
    }

    private determineActionLevel(action: string): ActionLevel {
        const method = this.extractMethod(action).toLowerCase();

        if (method.includes('delete') || method.includes('remove')) {
            return 'delete';
        }
        if (method.includes('purchase') || method.includes('register') || method.includes('buy')) {
            return 'purchase';
        }
        if (method.includes('create') || method.includes('add')) {
            return 'create';
        }
        if (
            method.includes('update') ||
            method.includes('set') ||
            method.includes('modify')
        ) {
            return 'modify';
        }

        return 'read';
    }

    private requiresApproval(action: string): boolean {
        const level = this.determineActionLevel(action);
        return ACTION_LEVELS_REQUIRING_APPROVAL.includes(level);
    }

    private sortByDependencies(actions: PlannedAction[]): PlannedAction[] {
        // Simple topological sort
        const sorted: PlannedAction[] = [];
        const visited = new Set<string>();

        const visit = (action: PlannedAction) => {
            if (visited.has(action.id)) return;
            visited.add(action.id);

            if (action.dependsOn) {
                for (const depId of action.dependsOn) {
                    const dep = actions.find((a) => a.id === depId);
                    if (dep) visit(dep);
                }
            }

            sorted.push(action);
        };

        // Sort by step first, then by dependencies
        const byStep = [...actions].sort((a, b) => a.step - b.step);
        for (const action of byStep) {
            visit(action);
        }

        return sorted;
    }

    private async logEvent(event: IntegrationEvent): Promise<void> {
        // TODO: Store event in event store
        console.log('[IntegrationsHub] Event:', event);
    }
}

// ==================
// Singleton Export
// ==================

let hubInstance: IntegrationsHub | null = null;

export function getIntegrationsHub(): IntegrationsHub {
    if (!hubInstance) {
        hubInstance = new IntegrationsHub();
    }
    return hubInstance;
}
