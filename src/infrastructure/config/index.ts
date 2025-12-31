/**
 * Configuration management
 * Following BackEndMate's typed configuration pattern
 */

import { config as dotenvConfig } from 'dotenv';

// Load .env file
dotenvConfig();

export interface ServerConfig {
    port: number;
    host: string;
    environment: 'development' | 'staging' | 'production';
}

export interface DatabaseConfig {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolSize: number;
    url: string;
}

export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
}

export interface HealthConfig {
    checkIntervalMs: number;
    timeoutMs: number;
    serviceTtlMs: number;
}

export interface AuthConfig {
    enabled: boolean;
    jwtSecret?: string;
    apiKeys?: string[];
}

export interface AppConfig {
    server: ServerConfig;
    database: DatabaseConfig;
    redis: RedisConfig;
    health: HealthConfig;
    auth: AuthConfig;
}

function getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a number`);
    }
    return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
        return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
}

export function loadConfig(): AppConfig {
    const dbHost = getEnv('DB_HOST', 'localhost');
    const dbPort = getEnvNumber('DB_PORT', 5432);
    const dbName = getEnv('DB_NAME', 'overlord_db');
    const dbUser = getEnv('DB_USER', 'overlord');
    const dbPassword = getEnv('DB_PASSWORD', 'overlord_dev_password');

    return {
        server: {
            port: getEnvNumber('PORT', 3000),
            host: getEnv('HOST', '0.0.0.0'),
            environment: getEnv('NODE_ENV', 'development') as AppConfig['server']['environment']
        },
        database: {
            host: dbHost,
            port: dbPort,
            name: dbName,
            user: dbUser,
            password: dbPassword,
            poolSize: getEnvNumber('DB_POOL_SIZE', 10),
            url: getEnv('DATABASE_URL', `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`)
        },
        redis: {
            host: getEnv('REDIS_HOST', 'localhost'),
            port: getEnvNumber('REDIS_PORT', 6379),
            password: process.env.REDIS_PASSWORD
        },
        health: {
            checkIntervalMs: getEnvNumber('HEALTH_CHECK_INTERVAL_MS', 30000),
            timeoutMs: getEnvNumber('HEALTH_CHECK_TIMEOUT_MS', 5000),
            serviceTtlMs: getEnvNumber('SERVICE_TTL_MS', 60000)
        },
        auth: {
            enabled: getEnvBoolean('AUTH_ENABLED', false),
            jwtSecret: process.env.JWT_SECRET,
            apiKeys: process.env.API_KEYS?.split(',').map(k => k.trim())
        }
    };
}

// Singleton config instance
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
    if (!configInstance) {
        configInstance = loadConfig();
    }
    return configInstance;
}
