/**
 * Health Routes - Health checks and monitoring
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IHealthService } from '../../../application/health/IHealthService';
import { ApiResponseBuilder } from '../../responses/ApiResponse';
import { API_VERSION, SERVICE_NAME } from '../../../domain/shared/constants';

interface ServiceIdParams {
    serviceId: string;
}

export function healthRoutes(
    fastify: FastifyInstance,
    healthService: IHealthService
): void {
    // Overlord's own health check
    fastify.get(
        '/health',
        async (_request: FastifyRequest, reply: FastifyReply) => {
            const response = ApiResponseBuilder.ok({
                service: SERVICE_NAME,
                version: API_VERSION,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
            return reply.send(response);
        }
    );

    // Get aggregated health of all services
    fastify.get(
        '/health/all',
        async (_request: FastifyRequest, reply: FastifyReply) => {
            const health = await healthService.getAggregatedHealth();
            const response = ApiResponseBuilder.ok(health);
            return reply.send(response);
        }
    );

    // Check health of all services (active check)
    fastify.post(
        '/health/check',
        async (_request: FastifyRequest, reply: FastifyReply) => {
            const health = await healthService.checkAllServices();
            const response = ApiResponseBuilder.ok(health);
            return reply.send(response);
        }
    );

    // Check health of a specific service
    fastify.post<{ Params: ServiceIdParams }>(
        '/health/check/:serviceId',
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
            const health = await healthService.checkServiceHealth(request.params.serviceId);
            const response = ApiResponseBuilder.ok(health);
            return reply.send(response);
        }
    );

    // Get cached health status of a service
    fastify.get<{ Params: ServiceIdParams }>(
        '/health/:serviceId',
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
            const health = await healthService.getServiceHealth(request.params.serviceId);
            if (!health) {
                const response = ApiResponseBuilder.notFound('Health status not found');
                return reply.status(404).send(response);
            }
            const response = ApiResponseBuilder.ok(health);
            return reply.send(response);
        }
    );
}
