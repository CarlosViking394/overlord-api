/**
 * Global Error Handler Middleware
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ApiResponseBuilder } from '../responses/ApiResponse';
import { DomainError } from '../../domain/shared/errors';

export function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
): void {
    request.log.error(error);

    // Handle domain errors
    if (error instanceof DomainError) {
        const response = ApiResponseBuilder.fromError(error);
        reply.status(error.statusCode).send(response);
        return;
    }

    // Handle validation errors
    if (error.validation) {
        const response = ApiResponseBuilder.badRequest(
            'Validation failed',
            error.validation.map(v => `${v.instancePath}: ${v.message}`)
        );
        reply.status(400).send(response);
        return;
    }

    // Handle not found errors
    if (error.statusCode === 404) {
        const response = ApiResponseBuilder.notFound(error.message);
        reply.status(404).send(response);
        return;
    }

    // Handle other errors
    const statusCode = error.statusCode || 500;
    const response = statusCode >= 500
        ? ApiResponseBuilder.internalError(
            process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : error.message
          )
        : ApiResponseBuilder.fromError(error);

    reply.status(statusCode).send(response);
}
