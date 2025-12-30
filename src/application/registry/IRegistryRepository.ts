/**
 * Registry Repository Interface
 * Following BackEndMate's interface-based repository pattern
 */

import { Service, ServiceSnapshot } from '../../domain/registry/Service';
import { ServiceType, ServiceStatus } from '../../domain/shared/types';

export interface IRegistryRepository {
    /**
     * Save or update a service in the registry
     */
    save(service: Service): Promise<void>;

    /**
     * Find a service by ID
     */
    findById(id: string): Promise<Service | null>;

    /**
     * Find a service by name
     */
    findByName(name: string): Promise<Service | null>;

    /**
     * Get all registered services
     */
    findAll(): Promise<Service[]>;

    /**
     * Get services filtered by type
     */
    findByType(type: ServiceType): Promise<Service[]>;

    /**
     * Get services filtered by status
     */
    findByStatus(status: ServiceStatus): Promise<Service[]>;

    /**
     * Remove a service from the registry
     */
    delete(id: string): Promise<boolean>;

    /**
     * Check if a service exists
     */
    exists(id: string): Promise<boolean>;

    /**
     * Get count of registered services
     */
    count(): Promise<number>;

    /**
     * Find services with specific capability
     */
    findByCapability(capabilityName: string): Promise<Service[]>;

    /**
     * Get all service snapshots (for serialization)
     */
    getAllSnapshots(): Promise<ServiceSnapshot[]>;
}
