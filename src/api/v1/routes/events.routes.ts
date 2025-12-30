/**
 * Events Routes - Event stream and history
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IEventService } from '../../../application/events/IEventService';
import { ApiResponseBuilder } from '../../responses/ApiResponse';

interface EventsQuery {
    limit?: number;
}

export function eventsRoutes(
    fastify: FastifyInstance,
    eventService: IEventService
): void {
    // Get recent events
    fastify.get<{ Querystring: EventsQuery }>(
        '/events',
        {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        limit: { type: 'number', default: 50, maximum: 100 }
                    }
                }
            }
        },
        async (request: FastifyRequest<{ Querystring: EventsQuery }>, reply: FastifyReply) => {
            const limit = request.query.limit || 50;
            const events = await eventService.getRecentEvents(limit);
            const response = ApiResponseBuilder.ok(events);
            return reply.send(response);
        }
    );
}
