/**
 * PostgreSQL Registry Repository Implementation
 * Replaces InMemoryRegistryRepository for persistent storage
 */

import { eq } from 'drizzle-orm';
import { Service } from '../../domain/registry/Service';
import { ServiceType, ServiceStatus, ServiceCapability, HealthCheckResult } from '../../domain/shared/types';
import { IRegistryRepository } from '../../application/registry/IRegistryRepository';
import { getDb, schema } from '../database';

export class PostgresRegistryRepository implements IRegistryRepository {
    async save(service: Service): Promise<void> {
        const db = getDb();
        const snapshot = service.toSnapshot();

        await db
            .insert(schema.services)
            .values({
                id: snapshot.id,
                name: snapshot.name,
                type: snapshot.type,
                baseUrl: snapshot.baseUrl,
                healthEndpoint: snapshot.healthEndpoint,
                capabilities: snapshot.capabilities as unknown as Record<string, unknown>,
                metadata: snapshot.metadata,
                version: snapshot.version,
                status: snapshot.status,
                lastHealthCheck: snapshot.lastHealthCheck as unknown as Record<string, unknown>,
                registeredAt: snapshot.registeredAt,
                lastSeenAt: snapshot.lastSeenAt,
            })
            .onConflictDoUpdate({
                target: schema.services.id,
                set: {
                    name: snapshot.name,
                    baseUrl: snapshot.baseUrl,
                    healthEndpoint: snapshot.healthEndpoint,
                    capabilities: snapshot.capabilities as unknown as Record<string, unknown>,
                    metadata: snapshot.metadata,
                    version: snapshot.version,
                    status: snapshot.status,
                    lastHealthCheck: snapshot.lastHealthCheck as unknown as Record<string, unknown>,
                    lastSeenAt: snapshot.lastSeenAt,
                },
            });
    }

    async findById(id: string): Promise<Service | null> {
        const db = getDb();
        const result = await db
            .select()
            .from(schema.services)
            .where(eq(schema.services.id, id))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        return this.mapToEntity(result[0]);
    }

    async findAll(): Promise<Service[]> {
        const db = getDb();
        const results = await db.select().from(schema.services);
        return results.map(row => this.mapToEntity(row));
    }

    async findByType(type: ServiceType): Promise<Service[]> {
        const db = getDb();
        const results = await db
            .select()
            .from(schema.services)
            .where(eq(schema.services.type, type));
        return results.map(row => this.mapToEntity(row));
    }

    async findByStatus(status: ServiceStatus): Promise<Service[]> {
        const db = getDb();
        const results = await db
            .select()
            .from(schema.services)
            .where(eq(schema.services.status, status));
        return results.map(row => this.mapToEntity(row));
    }

    async findByCapability(capability: string): Promise<Service[]> {
        const db = getDb();
        // Find services with matching capability in JSONB array
        const results = await db.select().from(schema.services);

        return results
            .filter(row => {
                const caps = row.capabilities as ServiceCapability[] | null;
                return caps?.some(c => c.name === capability) ?? false;
            })
            .map(row => this.mapToEntity(row));
    }

    async delete(id: string): Promise<boolean> {
        const db = getDb();
        const result = await db
            .delete(schema.services)
            .where(eq(schema.services.id, id))
            .returning({ id: schema.services.id });
        return result.length > 0;
    }

    async exists(id: string): Promise<boolean> {
        const db = getDb();
        const result = await db
            .select({ id: schema.services.id })
            .from(schema.services)
            .where(eq(schema.services.id, id))
            .limit(1);
        return result.length > 0;
    }

    async findByName(name: string): Promise<Service | null> {
        const db = getDb();
        const result = await db
            .select()
            .from(schema.services)
            .where(eq(schema.services.name, name))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        return this.mapToEntity(result[0]);
    }

    async count(): Promise<number> {
        const db = getDb();
        const result = await db.select().from(schema.services);
        return result.length;
    }

    async getAllSnapshots(): Promise<import('../../domain/registry/Service').ServiceSnapshot[]> {
        const services = await this.findAll();
        return services.map(s => s.toSnapshot());
    }

    private mapToEntity(row: typeof schema.services.$inferSelect): Service {
        const service = new Service({
            id: row.id,
            name: row.name,
            type: row.type as ServiceType,
            baseUrl: row.baseUrl,
            healthEndpoint: row.healthEndpoint ?? '/health',
            capabilities: (row.capabilities as ServiceCapability[]) ?? [],
            metadata: (row.metadata as Record<string, unknown>) ?? {},
            version: row.version ?? '1.0.0',
        });

        // Restore health status if available
        if (row.lastHealthCheck) {
            service.updateHealthStatus(row.lastHealthCheck as HealthCheckResult);
        } else if (row.status) {
            // Set status directly based on stored value
            switch (row.status) {
                case 'healthy':
                    service.markAsHealthy();
                    break;
                case 'unhealthy':
                    service.markAsUnhealthy();
                    break;
                case 'degraded':
                    service.markAsDegraded();
                    break;
            }
        }

        return service;
    }
}
