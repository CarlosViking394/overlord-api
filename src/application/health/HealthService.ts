/**
 * Health Service Implementation
 */

import { HealthCheckResult, ServiceStatus } from '../../domain/shared/types';
import { IRegistryRepository } from '../registry/IRegistryRepository';
import { IHealthService, AggregatedHealth, ServiceHealthDetail } from './IHealthService';
import { HEALTH_CHECK_TIMEOUT_MS } from '../../domain/shared/constants';

export class HealthService implements IHealthService {
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(
        private readonly registryRepository: IRegistryRepository
    ) {}

    async checkServiceHealth(serviceId: string): Promise<HealthCheckResult> {
        const service = await this.registryRepository.findById(serviceId);
        if (!service) {
            return {
                status: ServiceStatus.UNKNOWN,
                timestamp: new Date(),
                responseTimeMs: 0,
                details: { error: 'Service not found' }
            };
        }

        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

            const response = await fetch(service.getFullHealthUrl(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });

            clearTimeout(timeoutId);
            const responseTimeMs = Date.now() - startTime;

            let status: ServiceStatus;
            let details: Record<string, unknown> = {};

            if (response.ok) {
                status = ServiceStatus.HEALTHY;
                try {
                    details = await response.json();
                } catch {
                    // Response might not be JSON
                }
            } else if (response.status >= 500) {
                status = ServiceStatus.UNHEALTHY;
                details = { httpStatus: response.status };
            } else {
                status = ServiceStatus.DEGRADED;
                details = { httpStatus: response.status };
            }

            const result: HealthCheckResult = {
                status,
                timestamp: new Date(),
                responseTimeMs,
                details
            };

            // Update service health status
            service.updateHealthStatus(result);
            await this.registryRepository.save(service);

            return result;

        } catch (error) {
            const responseTimeMs = Date.now() - startTime;
            const result: HealthCheckResult = {
                status: ServiceStatus.UNHEALTHY,
                timestamp: new Date(),
                responseTimeMs,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };

            service.updateHealthStatus(result);
            await this.registryRepository.save(service);

            return result;
        }
    }

    async checkAllServices(): Promise<AggregatedHealth> {
        const services = await this.registryRepository.findAll();
        const details: ServiceHealthDetail[] = [];

        let healthy = 0;
        let unhealthy = 0;
        let degraded = 0;
        let unknown = 0;

        for (const service of services) {
            const healthResult = await this.checkServiceHealth(service.id);

            switch (healthResult.status) {
                case ServiceStatus.HEALTHY:
                    healthy++;
                    break;
                case ServiceStatus.UNHEALTHY:
                    unhealthy++;
                    break;
                case ServiceStatus.DEGRADED:
                    degraded++;
                    break;
                default:
                    unknown++;
            }

            details.push({
                serviceId: service.id,
                serviceName: service.name,
                status: healthResult.status,
                lastCheck: healthResult.timestamp,
                responseTimeMs: healthResult.responseTimeMs,
                error: healthResult.details?.error as string | undefined
            });
        }

        // Determine overall status
        let overallStatus: ServiceStatus;
        if (unhealthy > 0) {
            overallStatus = services.length === unhealthy
                ? ServiceStatus.UNHEALTHY
                : ServiceStatus.DEGRADED;
        } else if (degraded > 0) {
            overallStatus = ServiceStatus.DEGRADED;
        } else if (healthy > 0) {
            overallStatus = ServiceStatus.HEALTHY;
        } else {
            overallStatus = ServiceStatus.UNKNOWN;
        }

        return {
            status: overallStatus,
            timestamp: new Date(),
            services: {
                total: services.length,
                healthy,
                unhealthy,
                degraded,
                unknown
            },
            details
        };
    }

    async getServiceHealth(serviceId: string): Promise<HealthCheckResult | null> {
        const service = await this.registryRepository.findById(serviceId);
        return service?.lastHealthCheck || null;
    }

    async getAggregatedHealth(): Promise<AggregatedHealth> {
        const services = await this.registryRepository.findAll();
        const details: ServiceHealthDetail[] = [];

        let healthy = 0;
        let unhealthy = 0;
        let degraded = 0;
        let unknown = 0;

        for (const service of services) {
            switch (service.status) {
                case ServiceStatus.HEALTHY:
                    healthy++;
                    break;
                case ServiceStatus.UNHEALTHY:
                    unhealthy++;
                    break;
                case ServiceStatus.DEGRADED:
                    degraded++;
                    break;
                default:
                    unknown++;
            }

            details.push({
                serviceId: service.id,
                serviceName: service.name,
                status: service.status,
                lastCheck: service.lastHealthCheck?.timestamp,
                responseTimeMs: service.lastHealthCheck?.responseTimeMs
            });
        }

        let overallStatus: ServiceStatus;
        if (unhealthy > 0) {
            overallStatus = services.length === unhealthy
                ? ServiceStatus.UNHEALTHY
                : ServiceStatus.DEGRADED;
        } else if (degraded > 0) {
            overallStatus = ServiceStatus.DEGRADED;
        } else if (healthy > 0) {
            overallStatus = ServiceStatus.HEALTHY;
        } else {
            overallStatus = ServiceStatus.UNKNOWN;
        }

        return {
            status: overallStatus,
            timestamp: new Date(),
            services: {
                total: services.length,
                healthy,
                unhealthy,
                degraded,
                unknown
            },
            details
        };
    }

    startHealthChecks(intervalMs: number): void {
        if (this.healthCheckInterval) {
            this.stopHealthChecks();
        }

        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.checkAllServices();
            } catch (error) {
                console.error('Health check cycle failed:', error);
            }
        }, intervalMs);

        console.log(`Health checks started with interval: ${intervalMs}ms`);
    }

    stopHealthChecks(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
            console.log('Health checks stopped');
        }
    }
}
