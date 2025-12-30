/**
 * Registry Routes - Service registration and discovery
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IRegistryService } from '../../../application/registry/RegistryService';
import { ApiResponseBuilder } from '../../responses/ApiResponse';
import { ServiceType } from '../../../domain/shared/types';

interface RegisterServiceBody {
    name: string;
    type: ServiceType;
    baseUrl: string;
    healthEndpoint?: string;
    capabilities?: { name: string; version: string; description?: string }[];
    metadata?: Record<string, unknown>;
    version?: string;
}

interface ServiceIdParams {
    serviceId: string;
}

interface ServiceTypeQuery {
    type?: ServiceType;
}

export function registryRoutes(
    fastify: FastifyInstance,
    registryService: IRegistryService
): void {
    // Register a new service
    fastify.post<{ Body: RegisterServiceBody }>(
        '/registry/services',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['name', 'type', 'baseUrl'],
                    properties: {
                        name: { type: 'string', description: 'Service name' },
                        type: {
                            type: 'string',
                            enum: ['agent', 'web_app', 'mobile_app', 'api'],
                            description: 'Service type'
                        },
                        baseUrl: { type: 'string', format: 'uri', description: 'Base URL of the service' },
                        healthEndpoint: { type: 'string', description: 'Health check endpoint path' },
                        capabilities: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    version: { type: 'string' },
                                    description: { type: 'string' }
                                }
                            }
                        },
                        metadata: { type: 'object' },
                        version: { type: 'string' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Body: RegisterServiceBody }>, reply: FastifyReply) => {
            const service = await registryService.registerService(request.body);
            const response = ApiResponseBuilder.created(service, 'Service registered successfully');
            return reply.status(201).send(response);
        }
    );

    // Get all services
    fastify.get<{ Querystring: ServiceTypeQuery }>(
        '/registry/services',
        {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['agent', 'web_app', 'mobile_app', 'api'],
                            description: 'Filter by service type'
                        }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Querystring: ServiceTypeQuery }>, reply: FastifyReply) => {
            const { type } = request.query;
            const services = type
                ? await registryService.getServicesByType(type)
                : await registryService.getAllServices();
            const response = ApiResponseBuilder.ok(services);
            return reply.send(response);
        }
    );

    // Get a specific service
    fastify.get<{ Params: ServiceIdParams }>(
        '/registry/services/:serviceId',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        serviceId: { type: 'string' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Params: ServiceIdParams }>, reply: FastifyReply) => {
            const service = await registryService.getService(request.params.serviceId);
            const response = ApiResponseBuilder.ok(service);
            return reply.send(response);
        }
    );

    // Deregister a service
    fastify.delete<{ Params: ServiceIdParams }>(
        '/registry/services/:serviceId',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        serviceId: { type: 'string' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Params: ServiceIdParams }>, reply: FastifyReply) => {
            await registryService.deregisterService(request.params.serviceId);
            const response = ApiResponseBuilder.ok(null, 'Service deregistered successfully');
            return reply.send(response);
        }
    );

    // Heartbeat endpoint
    fastify.post<{ Params: ServiceIdParams }>(
        '/registry/services/:serviceId/heartbeat',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        serviceId: { type: 'string' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Params: ServiceIdParams }>, reply: FastifyReply) => {
            await registryService.heartbeat(request.params.serviceId);
            const response = ApiResponseBuilder.ok(null, 'Heartbeat received');
            return reply.send(response);
        }
    );

    // Find services by capability
    fastify.get<{ Params: { capability: string } }>(
        '/registry/services/capability/:capability',
        {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        capability: { type: 'string' }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Params: { capability: string } }>, reply: FastifyReply) => {
            const services = await registryService.findServicesByCapability(
                request.params.capability
            );
            const response = ApiResponseBuilder.ok(services);
            return reply.send(response);
        }
    );
}
