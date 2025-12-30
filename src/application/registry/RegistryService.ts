/**
 * Registry Service - Application layer service for service registration
 * Following BackEndMate's service orchestration pattern
 */

import { Service, ServiceProps, ServiceSnapshot } from '../../domain/registry/Service';
import { ServiceType, ServiceStatus } from '../../domain/shared/types';
import { DomainError, ErrorCode } from '../../domain/shared/errors';
import { throwIfNull } from '../../domain/shared/guards';
import { IRegistryRepository } from './IRegistryRepository';
import { IHealthService } from '../health/IHealthService';
import { IEventService } from '../events/IEventService';
import { EventType } from '../../domain/shared/types';

export interface RegisterServiceRequest {
    name: string;
    type: ServiceType;
    baseUrl: string;
    healthEndpoint?: string;
    capabilities?: { name: string; version: string; description?: string }[];
    metadata?: Record<string, unknown>;
    version?: string;
}

export interface IRegistryService {
    registerService(request: RegisterServiceRequest): Promise<ServiceSnapshot>;
    deregisterService(serviceId: string): Promise<void>;
    getService(serviceId: string): Promise<ServiceSnapshot>;
    getAllServices(): Promise<ServiceSnapshot[]>;
    getServicesByType(type: ServiceType): Promise<ServiceSnapshot[]>;
    getHealthyServices(): Promise<ServiceSnapshot[]>;
    findServicesByCapability(capability: string): Promise<ServiceSnapshot[]>;
    heartbeat(serviceId: string): Promise<void>;
}

export class RegistryService implements IRegistryService {
    constructor(
        private readonly repository: IRegistryRepository,
        private readonly healthService: IHealthService,
        private readonly eventService: IEventService
    ) {}

    async registerService(request: RegisterServiceRequest): Promise<ServiceSnapshot> {
        // Generate service ID from name (slugified)
        const serviceId = this.generateServiceId(request.name);

        // Check if service already exists
        const existing = await this.repository.findById(serviceId);
        if (existing) {
            // Update existing service
            existing.touch();
            await this.repository.save(existing);
            return existing.toSnapshot();
        }

        // Create new service entity
        const service = new Service({
            id: serviceId,
            name: request.name,
            type: request.type,
            baseUrl: request.baseUrl,
            healthEndpoint: request.healthEndpoint,
            capabilities: request.capabilities,
            metadata: request.metadata,
            version: request.version
        });

        // Save to repository
        await this.repository.save(service);

        // Perform initial health check
        try {
            await this.healthService.checkServiceHealth(serviceId);
        } catch {
            // Log but don't fail registration
            console.warn(`Initial health check failed for service ${serviceId}`);
        }

        // Emit registration event
        await this.eventService.emit({
            type: EventType.SERVICE_REGISTERED,
            serviceId,
            timestamp: new Date(),
            data: { name: request.name, type: request.type }
        });

        return service.toSnapshot();
    }

    async deregisterService(serviceId: string): Promise<void> {
        const service = await this.repository.findById(serviceId);
        throwIfNull(service, serviceId);

        await this.repository.delete(serviceId);

        // Emit deregistration event
        await this.eventService.emit({
            type: EventType.SERVICE_DEREGISTERED,
            serviceId,
            timestamp: new Date(),
            data: { name: service!.name }
        });
    }

    async getService(serviceId: string): Promise<ServiceSnapshot> {
        const service = await this.repository.findById(serviceId);
        return throwIfNull(service, serviceId).toSnapshot();
    }

    async getAllServices(): Promise<ServiceSnapshot[]> {
        const services = await this.repository.findAll();
        return services.map(s => s.toSnapshot());
    }

    async getServicesByType(type: ServiceType): Promise<ServiceSnapshot[]> {
        const services = await this.repository.findByType(type);
        return services.map(s => s.toSnapshot());
    }

    async getHealthyServices(): Promise<ServiceSnapshot[]> {
        const services = await this.repository.findByStatus(ServiceStatus.HEALTHY);
        return services.map(s => s.toSnapshot());
    }

    async findServicesByCapability(capability: string): Promise<ServiceSnapshot[]> {
        const services = await this.repository.findByCapability(capability);
        return services.map(s => s.toSnapshot());
    }

    async heartbeat(serviceId: string): Promise<void> {
        const service = await this.repository.findById(serviceId);
        if (service) {
            service.touch();
            await this.repository.save(service);
        }
    }

    private generateServiceId(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
