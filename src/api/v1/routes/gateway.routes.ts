/**
 * Gateway Routes - Proxy and command dispatch
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IGatewayService } from '../../../application/gateway/IGatewayService';
import { ApiResponseBuilder } from '../../responses/ApiResponse';

interface ServiceIdParams {
    serviceId: string;
}

interface ProxyParams extends ServiceIdParams {
    '*': string;
}

interface DispatchBody {
    command: string;
    params?: Record<string, unknown>;
}

interface BroadcastBody {
    serviceType: string;
    message: Record<string, unknown>;
}

export function gatewayRoutes(
    fastify: FastifyInstance,
    gatewayService: IGatewayService
): void {
    // Proxy GET requests
    fastify.get<{ Params: ProxyParams; Querystring: Record<string, string> }>(
        '/api/:serviceId/*',
        {
            schema: {
                description: 'Proxy GET request to a registered service',
                tags: ['Gateway'],
                params: {
                    type: 'object',
                    properties: {
                        serviceId: { type: 'string' },
                        '*': { type: 'string' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Params: ProxyParams; Querystring: Record<string, string> }>, reply: FastifyReply) => {
            const path = '/' + request.params['*'];
            const result = await gatewayService.proxy({
                serviceId: request.params.serviceId,
                method: 'GET',
                path,
                query: request.query,
                headers: request.headers as Record<string, string>
            });

            return reply.status(result.status).send(result.body);
        }
    );

    // Proxy POST requests
    fastify.post<{ Params: ProxyParams; Body: unknown }>(
        '/api/:serviceId/*',
        {
            schema: {
                description: 'Proxy POST request to a registered service',
                tags: ['Gateway'],
                params: {
                    type: 'object',
                    properties: {
                        serviceId: { type: 'string' },
                        '*': { type: 'string' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Params: ProxyParams; Body: unknown }>, reply: FastifyReply) => {
            const path = '/' + request.params['*'];
            const result = await gatewayService.proxy({
                serviceId: request.params.serviceId,
                method: 'POST',
                path,
                body: request.body,
                headers: request.headers as Record<string, string>
            });

            return reply.status(result.status).send(result.body);
        }
    );

    // Proxy PUT requests
    fastify.put<{ Params: ProxyParams; Body: unknown }>(
        '/api/:serviceId/*',
        {
            schema: {
                description: 'Proxy PUT request to a registered service',
                tags: ['Gateway']
            }
        },
        async (request: FastifyRequest<{ Params: ProxyParams; Body: unknown }>, reply: FastifyReply) => {
            const path = '/' + request.params['*'];
            const result = await gatewayService.proxy({
                serviceId: request.params.serviceId,
                method: 'PUT',
                path,
                body: request.body,
                headers: request.headers as Record<string, string>
            });

            return reply.status(result.status).send(result.body);
        }
    );

    // Proxy DELETE requests
    fastify.delete<{ Params: ProxyParams }>(
        '/api/:serviceId/*',
        {
            schema: {
                description: 'Proxy DELETE request to a registered service',
                tags: ['Gateway']
            }
        },
        async (request: FastifyRequest<{ Params: ProxyParams }>, reply: FastifyReply) => {
            const path = '/' + request.params['*'];
            const result = await gatewayService.proxy({
                serviceId: request.params.serviceId,
                method: 'DELETE',
                path,
                headers: request.headers as Record<string, string>
            });

            return reply.status(result.status).send(result.body);
        }
    );

    // Dispatch command to a service
    fastify.post<{ Params: ServiceIdParams; Body: DispatchBody }>(
        '/dispatch/:serviceId',
        {
            schema: {
                description: 'Dispatch a command to a specific service',
                tags: ['Gateway'],
                params: {
                    type: 'object',
                    properties: {
                        serviceId: { type: 'string' }
                    }
                },
                body: {
                    type: 'object',
                    required: ['command'],
                    properties: {
                        command: { type: 'string', description: 'Command name to execute' },
                        params: { type: 'object', description: 'Command parameters' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Params: ServiceIdParams; Body: DispatchBody }>, reply: FastifyReply) => {
            const { command, params } = request.body;
            const result = await gatewayService.dispatchCommand(
                request.params.serviceId,
                command,
                params
            );
            const response = ApiResponseBuilder.ok(result, 'Command dispatched successfully');
            return reply.send(response);
        }
    );

    // Broadcast to all services of a type
    fastify.post<{ Body: BroadcastBody }>(
        '/dispatch/broadcast',
        {
            schema: {
                description: 'Broadcast a message to all services of a type',
                tags: ['Gateway'],
                body: {
                    type: 'object',
                    required: ['serviceType', 'message'],
                    properties: {
                        serviceType: {
                            type: 'string',
                            enum: ['agent', 'web_app', 'mobile_app', 'api'],
                            description: 'Type of services to broadcast to'
                        },
                        message: { type: 'object', description: 'Message to broadcast' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Body: BroadcastBody }>, reply: FastifyReply) => {
            const { serviceType, message } = request.body;
            const results = await gatewayService.broadcast(serviceType, message);
            const response = ApiResponseBuilder.ok(
                Object.fromEntries(results),
                'Broadcast completed'
            );
            return reply.send(response);
        }
    );
}
