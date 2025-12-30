/**
 * Service Entity - Domain model for registered services
 * Following BackEndMate's rich domain entity pattern with constructor validation
 */

import { Guard } from '../shared/guards';
import {
    ServiceType,
    ServiceStatus,
    ServiceCapability,
    HealthCheckResult
} from '../shared/types';

export interface ServiceProps {
    id: string;
    name: string;
    type: ServiceType;
    baseUrl: string;
    healthEndpoint?: string;
    capabilities?: ServiceCapability[];
    metadata?: Record<string, unknown>;
    version?: string;
}

export class Service {
    public readonly id: string;
    public readonly name: string;
    public readonly type: ServiceType;
    public readonly baseUrl: string;
    public readonly healthEndpoint: string;
    public readonly capabilities: ServiceCapability[];
    public readonly metadata: Record<string, unknown>;
    public readonly version: string;
    public readonly registeredAt: Date;

    private _status: ServiceStatus;
    private _lastHealthCheck?: HealthCheckResult;
    private _lastSeenAt: Date;

    constructor(props: ServiceProps) {
        // Guard clause validation (BackEndMate pattern)
        Guard.stringNotEmpty(props.id, 'id');
        Guard.stringNotEmpty(props.name, 'name');
        Guard.notNull(props.type, 'type');
        Guard.validUrl(props.baseUrl, 'baseUrl');

        this.id = props.id;
        this.name = props.name;
        this.type = props.type;
        this.baseUrl = props.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.healthEndpoint = props.healthEndpoint || '/health';
        this.capabilities = props.capabilities || [];
        this.metadata = props.metadata || {};
        this.version = props.version || '1.0.0';
        this.registeredAt = new Date();

        this._status = ServiceStatus.STARTING;
        this._lastSeenAt = new Date();
    }

    // Getters for mutable state
    get status(): ServiceStatus {
        return this._status;
    }

    get lastHealthCheck(): HealthCheckResult | undefined {
        return this._lastHealthCheck;
    }

    get lastSeenAt(): Date {
        return this._lastSeenAt;
    }

    // Domain behavior methods
    public updateHealthStatus(result: HealthCheckResult): void {
        this._lastHealthCheck = result;
        this._status = result.status;
        this._lastSeenAt = new Date();
    }

    public markAsHealthy(): void {
        this._status = ServiceStatus.HEALTHY;
        this._lastSeenAt = new Date();
    }

    public markAsUnhealthy(): void {
        this._status = ServiceStatus.UNHEALTHY;
    }

    public markAsDegraded(): void {
        this._status = ServiceStatus.DEGRADED;
    }

    public touch(): void {
        this._lastSeenAt = new Date();
    }

    public getFullHealthUrl(): string {
        return `${this.baseUrl}${this.healthEndpoint}`;
    }

    public hasCapability(capabilityName: string): boolean {
        return this.capabilities.some(c => c.name === capabilityName);
    }

    public isStale(ttlMs: number): boolean {
        const now = new Date().getTime();
        return (now - this._lastSeenAt.getTime()) > ttlMs;
    }

    public isAvailable(): boolean {
        return this._status === ServiceStatus.HEALTHY ||
               this._status === ServiceStatus.DEGRADED;
    }

    /**
     * Creates a snapshot for serialization
     */
    public toSnapshot(): ServiceSnapshot {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            baseUrl: this.baseUrl,
            healthEndpoint: this.healthEndpoint,
            capabilities: this.capabilities,
            metadata: this.metadata,
            version: this.version,
            status: this._status,
            registeredAt: this.registeredAt,
            lastSeenAt: this._lastSeenAt,
            lastHealthCheck: this._lastHealthCheck
        };
    }
}

export interface ServiceSnapshot {
    id: string;
    name: string;
    type: ServiceType;
    baseUrl: string;
    healthEndpoint: string;
    capabilities: ServiceCapability[];
    metadata: Record<string, unknown>;
    version: string;
    status: ServiceStatus;
    registeredAt: Date;
    lastSeenAt: Date;
    lastHealthCheck?: HealthCheckResult;
}
