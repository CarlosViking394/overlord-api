/**
 * Overlord API - Main Entry Point
 *
 * The Overlord API is the control plane for all Agent Charlie services.
 * It provides service registration, health monitoring, command dispatch,
 * and gateway functionality for agents, web apps, and mobile apps.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';

// Infrastructure
import { getConfig } from './infrastructure/config';
import { InMemoryRegistryRepository } from './infrastructure/registry/InMemoryRegistryRepository';

// Application Services
import { RegistryService } from './application/registry/RegistryService';
import { HealthService } from './application/health/HealthService';
import { EventService } from './application/events/EventService';
import { GatewayService } from './application/gateway/GatewayService';

// API
import { errorHandler } from './api/middleware/errorHandler';
import { registryRoutes } from './api/v1/routes/registry.routes';
import { healthRoutes } from './api/v1/routes/health.routes';
import { gatewayRoutes } from './api/v1/routes/gateway.routes';
import { eventsRoutes } from './api/v1/routes/events.routes';

// Constants
import { API_VERSION, SERVICE_NAME } from './domain/shared/constants';

async function bootstrap() {
    const config = getConfig();

    // Initialize Fastify
    const fastify = Fastify({
        logger: {
            level: config.server.environment === 'production' ? 'info' : 'debug'
        }
    });

    // Register CORS
    await fastify.register(cors, {
        origin: true,
        credentials: true
    });

    // Set error handler
    fastify.setErrorHandler(errorHandler);

    // Initialize repositories (Infrastructure layer)
    const registryRepository = new InMemoryRegistryRepository();

    // Initialize services (Application layer)
    const eventService = new EventService();
    const healthService = new HealthService(registryRepository);
    const registryService = new RegistryService(
        registryRepository,
        healthService,
        eventService
    );
    const gatewayService = new GatewayService(registryRepository);

    // Register routes (API layer)
    registryRoutes(fastify, registryService);
    healthRoutes(fastify, healthService);
    gatewayRoutes(fastify, gatewayService);
    eventsRoutes(fastify, eventService);

    // Root endpoint
    fastify.get('/', async () => {
        return {
            service: SERVICE_NAME,
            version: API_VERSION,
            description: 'Overlord API - Control Plane for Agent Charlie Services',
            endpoints: {
                registry: '/registry/services',
                health: '/health',
                gateway: '/api/:serviceId/*',
                dispatch: '/dispatch/:serviceId',
                events: '/events'
            },
            documentation: '/docs'
        };
    });

    // Start health checks
    healthService.startHealthChecks(config.health.checkIntervalMs);

    // Graceful shutdown
    const shutdown = async () => {
        console.log('Shutting down Overlord API...');
        healthService.stopHealthChecks();
        await fastify.close();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start server
    try {
        await fastify.listen({
            port: config.server.port,
            host: config.server.host
        });

        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     OVERLORD API v${API_VERSION}                       ║
╠══════════════════════════════════════════════════════════════╣
║  Control Plane for Agent Charlie Services                    ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at: http://${config.server.host}:${config.server.port}                    ║
║  Environment: ${config.server.environment.padEnd(46)}║
║  Health checks: Every ${(config.health.checkIntervalMs / 1000).toString().padEnd(4)}seconds                        ║
╚══════════════════════════════════════════════════════════════╝
        `);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

bootstrap();
