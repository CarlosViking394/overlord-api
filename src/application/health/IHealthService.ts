/**
 * Health Service Interface
 */

import { HealthCheckResult, ServiceStatus } from '../../domain/shared/types';

export interface AggregatedHealth {
    status: ServiceStatus;
    timestamp: Date;
    services: {
        total: number;
        healthy: number;
        unhealthy: number;
        degraded: number;
        unknown: number;
    };
    details: ServiceHealthDetail[];
}

export interface ServiceHealthDetail {
    serviceId: string;
    serviceName: string;
    status: ServiceStatus;
    lastCheck?: Date;
    responseTimeMs?: number;
    error?: string;
}

export interface IHealthService {
    /**
     * Check health of a specific service
     */
    checkServiceHealth(serviceId: string): Promise<HealthCheckResult>;

    /**
     * Check health of all registered services
     */
    checkAllServices(): Promise<AggregatedHealth>;

    /**
     * Get the last known health status of a service
     */
    getServiceHealth(serviceId: string): Promise<HealthCheckResult | null>;

    /**
     * Get aggregated health status
     */
    getAggregatedHealth(): Promise<AggregatedHealth>;

    /**
     * Start periodic health checks
     */
    startHealthChecks(intervalMs: number): void;

    /**
     * Stop periodic health checks
     */
    stopHealthChecks(): void;
}
