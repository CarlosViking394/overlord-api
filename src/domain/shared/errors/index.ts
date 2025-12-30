/**
 * Domain-specific error handling following BackEndMate patterns
 */

export enum ErrorCode {
    // General
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    NOT_FOUND = 'NOT_FOUND',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',

    // Registry
    SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
    SERVICE_ALREADY_EXISTS = 'SERVICE_ALREADY_EXISTS',
    SERVICE_REGISTRATION_FAILED = 'SERVICE_REGISTRATION_FAILED',

    // Health
    HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
    SERVICE_UNHEALTHY = 'SERVICE_UNHEALTHY',

    // Gateway
    GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    PROXY_ERROR = 'PROXY_ERROR',

    // Orchestrator
    WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
    WORKFLOW_EXECUTION_FAILED = 'WORKFLOW_EXECUTION_FAILED',
    COMMAND_DISPATCH_FAILED = 'COMMAND_DISPATCH_FAILED',
    COMMAND_TIMEOUT = 'COMMAND_TIMEOUT'
}

export class DomainError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly details?: Record<string, unknown>;

    constructor(
        code: ErrorCode,
        message: string,
        statusCode: number = 500,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'DomainError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;

        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
    }

    static notFound(resource: string, identifier?: string): DomainError {
        return new DomainError(
            ErrorCode.NOT_FOUND,
            `${resource}${identifier ? ` with identifier '${identifier}'` : ''} not found`,
            404
        );
    }

    static serviceNotFound(serviceId: string): DomainError {
        return new DomainError(
            ErrorCode.SERVICE_NOT_FOUND,
            `Service '${serviceId}' not found in registry`,
            404
        );
    }

    static serviceUnavailable(serviceId: string): DomainError {
        return new DomainError(
            ErrorCode.SERVICE_UNAVAILABLE,
            `Service '${serviceId}' is currently unavailable`,
            503
        );
    }

    static validationError(message: string, details?: Record<string, unknown>): DomainError {
        return new DomainError(
            ErrorCode.VALIDATION_ERROR,
            message,
            400,
            details
        );
    }

    static unauthorized(message: string = 'Unauthorized access'): DomainError {
        return new DomainError(
            ErrorCode.UNAUTHORIZED,
            message,
            401
        );
    }

    static gatewayTimeout(serviceId: string): DomainError {
        return new DomainError(
            ErrorCode.GATEWAY_TIMEOUT,
            `Request to service '${serviceId}' timed out`,
            504
        );
    }
}
