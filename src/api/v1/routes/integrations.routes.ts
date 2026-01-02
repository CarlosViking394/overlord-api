/**
 * Integrations Routes - Third-party integrations hub
 *
 * Enables Charlie to manage integrations that transform
 * business ideas into reality (GitHub, Vercel, Domains, etc.)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiResponseBuilder } from '../../responses/ApiResponse';
import {
    IIntegrationsHub,
    IntegrationProvider,
    IntegrationCategory,
    ActionPlan,
} from '../../../application/integrations';

// ==================
// Route Params & Body Types
// ==================

interface ProviderParams {
    provider: IntegrationProvider;
}

interface PlanParams {
    planId: string;
}

interface ActionParams {
    actionId: string;
}

interface UserIdQuery {
    userId: string;
}

interface CreatePlanBody {
    name: string;
    description: string;
    actions: Array<{
        step: number;
        integration: IntegrationProvider;
        method: string;
        description: string;
        params: Record<string, unknown>;
    }>;
}

interface ExecuteActionBody {
    integration: IntegrationProvider;
    method: string;
    params: Record<string, unknown>;
}

interface OAuthCallbackBody {
    code: string;
    state: string;
}

// ==================
// Routes Registration
// ==================

export function integrationsRoutes(
    fastify: FastifyInstance,
    hub: IIntegrationsHub
): void {
    // ==================
    // Hub Status & Discovery
    // ==================

    /**
     * GET /integrations
     * List all available integrations
     */
    fastify.get('/integrations', async (_request: FastifyRequest, reply: FastifyReply) => {
        const integrations = hub.getAllIntegrations().map((i) => ({
            provider: i.provider,
            category: i.category,
            displayName: i.displayName,
            description: i.description,
            iconUrl: i.iconUrl,
            docsUrl: i.docsUrl,
            requiredScopes: i.requiredScopes,
        }));

        return reply.send(ApiResponseBuilder.ok(integrations));
    });

    /**
     * GET /integrations/categories/:category
     * List integrations by category
     */
    fastify.get<{ Params: { category: IntegrationCategory } }>(
        '/integrations/categories/:category',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        category: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            const integrations = hub
                .getIntegrationsByCategory(request.params.category)
                .map((i) => ({
                    provider: i.provider,
                    displayName: i.displayName,
                    description: i.description,
                }));

            return reply.send(ApiResponseBuilder.ok(integrations));
        }
    );

    /**
     * GET /integrations/status
     * Get hub status for user (connected/disconnected integrations)
     */
    fastify.get<{ Querystring: UserIdQuery }>(
        '/integrations/status',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const status = await hub.getHubStatus(request.query.userId);
                return reply.send(ApiResponseBuilder.ok(status));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    // ==================
    // Connection Management
    // ==================

    /**
     * GET /integrations/connections
     * List user's connected integrations
     */
    fastify.get<{ Querystring: UserIdQuery }>(
        '/integrations/connections',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const connections = await hub.getConnectedIntegrations(request.query.userId);
                // Don't expose credentials in response
                const safe = connections.map((c) => ({
                    provider: c.provider,
                    category: c.category,
                    status: c.status,
                    connectedAt: c.connectedAt,
                }));
                return reply.send(ApiResponseBuilder.ok(safe));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    /**
     * GET /integrations/:provider/auth
     * Get OAuth URL for connecting an integration
     */
    fastify.get<{ Params: ProviderParams; Querystring: UserIdQuery }>(
        '/integrations/:provider/auth',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        provider: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            const integration = hub.getIntegration(request.params.provider);

            if (!integration) {
                return reply
                    .status(404)
                    .send(
                        ApiResponseBuilder.notFound(
                            `Integration ${request.params.provider} not found`
                        )
                    );
            }

            try {
                const state = crypto.randomUUID();
                const authUrl = await integration.getAuthUrl(request.query.userId, state);
                return reply.send(ApiResponseBuilder.ok({ authUrl, state }));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    /**
     * POST /integrations/:provider/callback
     * Handle OAuth callback
     */
    fastify.post<{ Params: ProviderParams; Querystring: UserIdQuery; Body: OAuthCallbackBody }>(
        '/integrations/:provider/callback',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        provider: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['code', 'state'],
                    properties: {
                        code: { type: 'string' },
                        state: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            const integration = hub.getIntegration(request.params.provider);

            if (!integration) {
                return reply
                    .status(404)
                    .send(
                        ApiResponseBuilder.notFound(
                            `Integration ${request.params.provider} not found`
                        )
                    );
            }

            try {
                const credentials = await integration.handleCallback(
                    request.query.userId,
                    request.body.code,
                    request.body.state
                );

                // Don't expose full credentials, just confirmation
                return reply.send(
                    ApiResponseBuilder.ok({
                        connected: true,
                        provider: request.params.provider,
                        scopes: credentials.scopes,
                    })
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(400).send(ApiResponseBuilder.error(message, 400));
            }
        }
    );

    /**
     * DELETE /integrations/:provider
     * Disconnect an integration
     */
    fastify.delete<{ Params: ProviderParams; Querystring: UserIdQuery }>(
        '/integrations/:provider',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        provider: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            const integration = hub.getIntegration(request.params.provider);

            if (!integration) {
                return reply
                    .status(404)
                    .send(
                        ApiResponseBuilder.notFound(
                            `Integration ${request.params.provider} not found`
                        )
                    );
            }

            try {
                await integration.disconnect(request.query.userId);
                return reply.send(
                    ApiResponseBuilder.ok({
                        disconnected: true,
                        provider: request.params.provider,
                    })
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    // ==================
    // Action Plans
    // ==================

    /**
     * GET /integrations/plans
     * List user's action plans
     */
    fastify.get<{ Querystring: UserIdQuery & { status?: ActionPlan['status']; limit?: number } }>(
        '/integrations/plans',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                        status: { type: 'string' },
                        limit: { type: 'number' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const plans = await hub.listPlans(request.query.userId, {
                    status: request.query.status,
                    limit: request.query.limit,
                });
                return reply.send(ApiResponseBuilder.ok(plans));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    /**
     * POST /integrations/plans
     * Create a new action plan
     */
    fastify.post<{ Querystring: UserIdQuery; Body: CreatePlanBody }>(
        '/integrations/plans',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['name', 'description', 'actions'],
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        actions: { type: 'array' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const plan = await hub.createPlan(
                    request.query.userId,
                    request.body.name,
                    request.body.description,
                    request.body.actions.map((a) => ({
                        ...a,
                        actionLevel: 'create' as const, // Will be determined by hub
                        requiresApproval: false, // Will be determined by hub
                    }))
                );
                return reply.status(201).send(ApiResponseBuilder.ok(plan));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    /**
     * GET /integrations/plans/:planId
     * Get an action plan by ID
     */
    fastify.get<{ Params: PlanParams; Querystring: UserIdQuery }>(
        '/integrations/plans/:planId',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        planId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const plan = await hub.getPlan(request.query.userId, request.params.planId);
                if (!plan) {
                    return reply
                        .status(404)
                        .send(ApiResponseBuilder.notFound('Plan not found'));
                }
                return reply.send(ApiResponseBuilder.ok(plan));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    /**
     * POST /integrations/plans/:planId/execute
     * Execute an action plan
     */
    fastify.post<{ Params: PlanParams; Querystring: UserIdQuery }>(
        '/integrations/plans/:planId/execute',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        planId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const plan = await hub.executePlan(request.query.userId, request.params.planId);
                return reply.send(ApiResponseBuilder.ok(plan));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(400).send(ApiResponseBuilder.error(message, 400));
            }
        }
    );

    /**
     * POST /integrations/plans/:planId/cancel
     * Cancel an in-progress plan
     */
    fastify.post<{ Params: PlanParams; Querystring: UserIdQuery }>(
        '/integrations/plans/:planId/cancel',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        planId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                await hub.cancelPlan(request.query.userId, request.params.planId);
                return reply.send(ApiResponseBuilder.ok({ cancelled: true }));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(400).send(ApiResponseBuilder.error(message, 400));
            }
        }
    );

    // ==================
    // Approvals
    // ==================

    /**
     * GET /integrations/approvals
     * Get pending actions requiring approval
     */
    fastify.get<{ Querystring: UserIdQuery }>(
        '/integrations/approvals',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const approvals = await hub.getPendingApprovals(request.query.userId);
                return reply.send(ApiResponseBuilder.ok(approvals));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );

    /**
     * POST /integrations/approvals/:actionId/approve
     * Approve a pending action
     */
    fastify.post<{ Params: ActionParams; Querystring: UserIdQuery }>(
        '/integrations/approvals/:actionId/approve',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        actionId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                await hub.approveAction(request.query.userId, request.params.actionId);
                return reply.send(ApiResponseBuilder.ok({ approved: true }));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(400).send(ApiResponseBuilder.error(message, 400));
            }
        }
    );

    /**
     * POST /integrations/approvals/:actionId/reject
     * Reject a pending action
     */
    fastify.post<{ Params: ActionParams; Querystring: UserIdQuery; Body: { reason?: string } }>(
        '/integrations/approvals/:actionId/reject',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        actionId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
                body: {
                    type: 'object',
                    properties: {
                        reason: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                await hub.rejectAction(
                    request.query.userId,
                    request.params.actionId,
                    request.body?.reason
                );
                return reply.send(ApiResponseBuilder.ok({ rejected: true }));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(400).send(ApiResponseBuilder.error(message, 400));
            }
        }
    );

    // ==================
    // Direct Action Execution
    // ==================

    /**
     * POST /integrations/execute
     * Execute a single action directly
     * (For Charlie to execute ad-hoc actions)
     */
    fastify.post<{ Querystring: UserIdQuery; Body: ExecuteActionBody }>(
        '/integrations/execute',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['integration', 'method', 'params'],
                    properties: {
                        integration: { type: 'string' },
                        method: { type: 'string' },
                        params: { type: 'object' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const result = await hub.executeAction(
                    request.query.userId,
                    request.body.integration,
                    request.body.method,
                    request.body.params
                );
                return reply.send(ApiResponseBuilder.ok(result));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(400).send(ApiResponseBuilder.error(message, 400));
            }
        }
    );

    // ==================
    // Events & Audit
    // ==================

    /**
     * GET /integrations/events
     * Get integration events for audit
     */
    fastify.get<{
        Querystring: UserIdQuery & {
            integration?: IntegrationProvider;
            limit?: number;
        };
    }>(
        '/integrations/events',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['userId'],
                    properties: {
                        userId: { type: 'string' },
                        integration: { type: 'string' },
                        limit: { type: 'number' },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const events = await hub.getEvents(request.query.userId, {
                    integration: request.query.integration,
                    limit: request.query.limit,
                });
                return reply.send(ApiResponseBuilder.ok(events));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.status(500).send(ApiResponseBuilder.error(message, 500));
            }
        }
    );
}
