/**
 * In-Memory Registry Repository
 * Can be replaced with Redis or database implementation later
 */

import { Service, ServiceSnapshot } from '../../domain/registry/Service';
import { ServiceType, ServiceStatus } from '../../domain/shared/types';
import { IRegistryRepository } from '../../application/registry/IRegistryRepository';

export class InMemoryRegistryRepository implements IRegistryRepository {
    private services: Map<string, Service> = new Map();

    async save(service: Service): Promise<void> {
        this.services.set(service.id, service);
    }

    async findById(id: string): Promise<Service | null> {
        return this.services.get(id) || null;
    }

    async findByName(name: string): Promise<Service | null> {
        for (const service of this.services.values()) {
            if (service.name === name) {
                return service;
            }
        }
        return null;
    }

    async findAll(): Promise<Service[]> {
        return Array.from(this.services.values());
    }

    async findByType(type: ServiceType): Promise<Service[]> {
        return Array.from(this.services.values()).filter(
            service => service.type === type
        );
    }

    async findByStatus(status: ServiceStatus): Promise<Service[]> {
        return Array.from(this.services.values()).filter(
            service => service.status === status
        );
    }

    async delete(id: string): Promise<boolean> {
        return this.services.delete(id);
    }

    async exists(id: string): Promise<boolean> {
        return this.services.has(id);
    }

    async count(): Promise<number> {
        return this.services.size;
    }

    async findByCapability(capabilityName: string): Promise<Service[]> {
        return Array.from(this.services.values()).filter(
            service => service.hasCapability(capabilityName)
        );
    }

    async getAllSnapshots(): Promise<ServiceSnapshot[]> {
        return Array.from(this.services.values()).map(s => s.toSnapshot());
    }

    // Utility method for testing/debugging
    clear(): void {
        this.services.clear();
    }
}
