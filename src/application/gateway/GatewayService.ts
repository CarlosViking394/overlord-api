/**
 * Gateway Service Implementation
 */

import { IRegistryRepository } from '../registry/IRegistryRepository';
import { IGatewayService, ProxyRequest, ProxyResponse } from './IGatewayService';
import { DomainError } from '../../domain/shared/errors';
import { throwIfNull } from '../../domain/shared/guards';
import { ServiceType } from '../../domain/shared/types';
import { COMMAND_TIMEOUT_MS } from '../../domain/shared/constants';

export class GatewayService implements IGatewayService {
    constructor(
        private readonly registryRepository: IRegistryRepository
    ) {}

    async proxy(request: ProxyRequest): Promise<ProxyResponse> {
        const service = await this.registryRepository.findById(request.serviceId);
        throwIfNull(service, request.serviceId);

        if (!service!.isAvailable()) {
            throw DomainError.serviceUnavailable(request.serviceId);
        }

        const url = new URL(request.path, service!.baseUrl);

        // Add query parameters
        if (request.query) {
            Object.entries(request.query).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }

        const startTime = Date.now();
        const timeout = request.timeout || COMMAND_TIMEOUT_MS;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const fetchOptions: RequestInit = {
                method: request.method,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-By': 'overlord-api',
                    ...request.headers
                }
            };

            if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
                fetchOptions.body = JSON.stringify(request.body);
            }

            const response = await fetch(url.toString(), fetchOptions);
            clearTimeout(timeoutId);

            const responseTimeMs = Date.now() - startTime;

            // Parse response headers
            const headers: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });

            // Parse response body
            let body: unknown;
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                body = await response.json();
            } else {
                body = await response.text();
            }

            // Touch the service to update lastSeenAt
            service!.touch();
            await this.registryRepository.save(service!);

            return {
                status: response.status,
                headers,
                body,
                responseTimeMs
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw DomainError.gatewayTimeout(request.serviceId);
            }
            throw error;
        }
    }

    async dispatchCommand(
        serviceId: string,
        command: string,
        params?: Record<string, unknown>
    ): Promise<unknown> {
        const response = await this.proxy({
            serviceId,
            method: 'POST',
            path: `/commands/${command}`,
            body: params
        });

        if (response.status >= 400) {
            throw new DomainError(
                'COMMAND_DISPATCH_FAILED' as any,
                `Command '${command}' failed with status ${response.status}`,
                response.status
            );
        }

        return response.body;
    }

    async broadcast(
        serviceType: string,
        message: Record<string, unknown>
    ): Promise<Map<string, unknown>> {
        const services = await this.registryRepository.findByType(
            serviceType as ServiceType
        );

        const results = new Map<string, unknown>();

        await Promise.all(
            services
                .filter(s => s.isAvailable())
                .map(async (service) => {
                    try {
                        const response = await this.proxy({
                            serviceId: service.id,
                            method: 'POST',
                            path: '/broadcast',
                            body: message
                        });
                        results.set(service.id, response.body);
                    } catch (error) {
                        results.set(service.id, {
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                })
        );

        return results;
    }
}
