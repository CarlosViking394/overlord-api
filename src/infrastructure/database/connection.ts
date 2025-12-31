/**
 * Database Connection Manager
 * Handles PostgreSQL connection using Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getConfig } from '../config';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
    if (!pool) {
        const config = getConfig();
        pool = new Pool({
            host: config.database.host,
            port: config.database.port,
            database: config.database.name,
            user: config.database.user,
            password: config.database.password,
            max: config.database.poolSize,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }
    return pool;
}

/**
 * Get Drizzle ORM instance
 */
export function getDb() {
    if (!db) {
        db = drizzle(getPool(), { schema });
    }
    return db;
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        db = null;
    }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
    try {
        const pool = getPool();
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        console.error('Database connection test failed:', error);
        return false;
    }
}

/**
 * Database health check
 */
export async function healthCheck(): Promise<{
    connected: boolean;
    latencyMs: number;
    poolSize: number;
    idleCount: number;
    waitingCount: number;
}> {
    const start = Date.now();
    const connected = await testConnection();
    const latencyMs = Date.now() - start;

    const p = getPool();
    return {
        connected,
        latencyMs,
        poolSize: p.totalCount,
        idleCount: p.idleCount,
        waitingCount: p.waitingCount,
    };
}

// Export schema for use in repositories
export { schema };
