/**
 * Gateway Service Interface
 * For proxying requests to registered services
 */

export interface ProxyRequest {
    serviceId: string;
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
    query?: Record<string, string>;
    timeout?: number;
}

export interface ProxyResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
    responseTimeMs: number;
}

export interface IGatewayService {
    /**
     * Proxy a request to a registered service
     */
    proxy(request: ProxyRequest): Promise<ProxyResponse>;

    /**
     * Dispatch a command to a service
     */
    dispatchCommand(
        serviceId: string,
        command: string,
        params?: Record<string, unknown>
    ): Promise<unknown>;

    /**
     * Broadcast a message to all services of a type
     */
    broadcast(
        serviceType: string,
        message: Record<string, unknown>
    ): Promise<Map<string, unknown>>;
}
