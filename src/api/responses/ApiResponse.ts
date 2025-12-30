/**
 * API Response Wrapper
 * Following BackEndMate's AcrrmResponse pattern for consistent responses
 */

export interface ApiResponse<T> {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
    errors?: string[];
    timestamp: string;
    requestId?: string;
}

export class ApiResponseBuilder {
    /**
     * Create a successful response
     */
    static ok<T>(data: T, message: string = 'Success'): ApiResponse<T> {
        return {
            success: true,
            statusCode: 200,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a created response (201)
     */
    static created<T>(data: T, message: string = 'Resource created'): ApiResponse<T> {
        return {
            success: true,
            statusCode: 201,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a no content response (204)
     */
    static noContent(message: string = 'No content'): ApiResponse<null> {
        return {
            success: true,
            statusCode: 204,
            message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a bad request response (400)
     */
    static badRequest(message: string, errors?: string[]): ApiResponse<null> {
        return {
            success: false,
            statusCode: 400,
            message,
            errors,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create an unauthorized response (401)
     */
    static unauthorized(message: string = 'Unauthorized'): ApiResponse<null> {
        return {
            success: false,
            statusCode: 401,
            message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a forbidden response (403)
     */
    static forbidden(message: string = 'Forbidden'): ApiResponse<null> {
        return {
            success: false,
            statusCode: 403,
            message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a not found response (404)
     */
    static notFound(message: string = 'Resource not found'): ApiResponse<null> {
        return {
            success: false,
            statusCode: 404,
            message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create an internal server error response (500)
     */
    static internalError(
        message: string = 'Internal server error',
        errors?: string[]
    ): ApiResponse<null> {
        return {
            success: false,
            statusCode: 500,
            message,
            errors,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a service unavailable response (503)
     */
    static serviceUnavailable(message: string = 'Service unavailable'): ApiResponse<null> {
        return {
            success: false,
            statusCode: 503,
            message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a gateway timeout response (504)
     */
    static gatewayTimeout(message: string = 'Gateway timeout'): ApiResponse<null> {
        return {
            success: false,
            statusCode: 504,
            message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a response from error
     */
    static fromError(error: unknown): ApiResponse<null> {
        if (error instanceof Error) {
            const anyError = error as any;
            return {
                success: false,
                statusCode: anyError.statusCode || 500,
                message: error.message,
                errors: anyError.details ? [JSON.stringify(anyError.details)] : undefined,
                timestamp: new Date().toISOString()
            };
        }
        return ApiResponseBuilder.internalError('An unexpected error occurred');
    }
}
