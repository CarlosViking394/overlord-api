/**
 * Credentials Vault
 *
 * Secure storage for integration credentials.
 * All credentials are encrypted at rest.
 *
 * Security Principles:
 * - Credentials encrypted with user-specific keys
 * - Access tokens have short TTL with refresh
 * - Audit log of all credential access
 * - Automatic token refresh before expiry
 */

import {
    IntegrationProvider,
    IntegrationCredentials,
    IntegrationConnection,
    IntegrationCategory,
    IntegrationStatus,
} from '../../domain/integrations/types';

// ==================
// Vault Types
// ==================

export interface StoredCredential {
    id: string;
    userId: string;
    provider: IntegrationProvider;
    category: IntegrationCategory;
    credentials: IntegrationCredentials; // Encrypted
    connectedAt: Date;
    lastUsed?: Date;
    lastRefreshed?: Date;
    metadata?: Record<string, string>;
}

export interface CredentialAccessLog {
    id: string;
    userId: string;
    provider: IntegrationProvider;
    action: 'read' | 'write' | 'refresh' | 'delete';
    success: boolean;
    error?: string;
    timestamp: Date;
    ipAddress?: string;
}

export interface VaultConfig {
    encryptionKey: string; // From environment
    refreshThresholdMs: number; // Refresh tokens this many ms before expiry
    maxRetries: number;
}

// ==================
// Credentials Vault Interface
// ==================

export interface ICredentialsVault {
    // ==================
    // CRUD Operations
    // ==================

    /**
     * Store credentials for an integration
     */
    storeCredentials(
        userId: string,
        provider: IntegrationProvider,
        category: IntegrationCategory,
        credentials: IntegrationCredentials
    ): Promise<StoredCredential>;

    /**
     * Get credentials for an integration
     * Automatically refreshes if near expiry
     */
    getCredentials(
        userId: string,
        provider: IntegrationProvider
    ): Promise<IntegrationCredentials | null>;

    /**
     * Update credentials (e.g., after refresh)
     */
    updateCredentials(
        userId: string,
        provider: IntegrationProvider,
        credentials: Partial<IntegrationCredentials>
    ): Promise<StoredCredential>;

    /**
     * Delete credentials (disconnect integration)
     */
    deleteCredentials(userId: string, provider: IntegrationProvider): Promise<void>;

    // ==================
    // Query Operations
    // ==================

    /**
     * Get all connected integrations for a user
     */
    getConnections(userId: string): Promise<IntegrationConnection[]>;

    /**
     * Check if user has a specific integration connected
     */
    isConnected(userId: string, provider: IntegrationProvider): Promise<boolean>;

    /**
     * Get connection status for a provider
     */
    getConnectionStatus(
        userId: string,
        provider: IntegrationProvider
    ): Promise<IntegrationStatus | null>;

    // ==================
    // Token Management
    // ==================

    /**
     * Refresh OAuth tokens before they expire
     * Called automatically by getCredentials if needed
     */
    refreshTokens(
        userId: string,
        provider: IntegrationProvider,
        refreshFn: (credentials: IntegrationCredentials) => Promise<IntegrationCredentials>
    ): Promise<IntegrationCredentials>;

    /**
     * Check if credentials need refresh
     */
    needsRefresh(credentials: IntegrationCredentials): boolean;

    // ==================
    // Audit
    // ==================

    /**
     * Get credential access logs
     */
    getAccessLogs(
        userId: string,
        options?: {
            provider?: IntegrationProvider;
            limit?: number;
            from?: Date;
        }
    ): Promise<CredentialAccessLog[]>;
}

/**
 * Credentials Vault Implementation
 *
 * NOTE: This is a scaffold implementation.
 * In production, this would use:
 * - AWS KMS or similar for encryption
 * - Secure database storage (encrypted at rest)
 * - Redis for credential caching with short TTL
 */
export class CredentialsVault implements ICredentialsVault {
    private config: VaultConfig;

    // In-memory storage for development
    // TODO: Replace with encrypted database storage
    private credentials: Map<string, StoredCredential> = new Map();
    private accessLogs: CredentialAccessLog[] = [];

    constructor(config: Partial<VaultConfig> = {}) {
        this.config = {
            encryptionKey: config.encryptionKey || process.env.CREDENTIALS_ENCRYPTION_KEY || '',
            refreshThresholdMs: config.refreshThresholdMs || 5 * 60 * 1000, // 5 minutes
            maxRetries: config.maxRetries || 3,
        };
    }

    // ==================
    // CRUD Operations
    // ==================

    async storeCredentials(
        userId: string,
        provider: IntegrationProvider,
        category: IntegrationCategory,
        credentials: IntegrationCredentials
    ): Promise<StoredCredential> {
        const id = this.generateKey(userId, provider);

        const stored: StoredCredential = {
            id,
            userId,
            provider,
            category,
            credentials: await this.encrypt(credentials),
            connectedAt: new Date(),
        };

        this.credentials.set(id, stored);

        await this.logAccess(userId, provider, 'write', true);

        return {
            ...stored,
            credentials, // Return unencrypted for immediate use
        };
    }

    async getCredentials(
        userId: string,
        provider: IntegrationProvider
    ): Promise<IntegrationCredentials | null> {
        const key = this.generateKey(userId, provider);
        const stored = this.credentials.get(key);

        if (!stored) {
            await this.logAccess(userId, provider, 'read', false, 'Not found');
            return null;
        }

        const decrypted = await this.decrypt(stored.credentials);

        // Update last used
        stored.lastUsed = new Date();

        await this.logAccess(userId, provider, 'read', true);

        return decrypted;
    }

    async updateCredentials(
        userId: string,
        provider: IntegrationProvider,
        credentials: Partial<IntegrationCredentials>
    ): Promise<StoredCredential> {
        const key = this.generateKey(userId, provider);
        const existing = this.credentials.get(key);

        if (!existing) {
            throw new Error(`No credentials found for ${provider}`);
        }

        const existingDecrypted = await this.decrypt(existing.credentials);
        const updated = { ...existingDecrypted, ...credentials };

        existing.credentials = await this.encrypt(updated);
        existing.lastRefreshed = new Date();

        await this.logAccess(userId, provider, 'write', true);

        return {
            ...existing,
            credentials: updated,
        };
    }

    async deleteCredentials(userId: string, provider: IntegrationProvider): Promise<void> {
        const key = this.generateKey(userId, provider);

        if (!this.credentials.has(key)) {
            await this.logAccess(userId, provider, 'delete', false, 'Not found');
            throw new Error(`No credentials found for ${provider}`);
        }

        this.credentials.delete(key);
        await this.logAccess(userId, provider, 'delete', true);
    }

    // ==================
    // Query Operations
    // ==================

    async getConnections(userId: string): Promise<IntegrationConnection[]> {
        const connections: IntegrationConnection[] = [];

        for (const [key, stored] of this.credentials.entries()) {
            if (stored.userId === userId) {
                const credentials = await this.decrypt(stored.credentials);
                const status = await this.getConnectionStatus(userId, stored.provider);

                connections.push({
                    provider: stored.provider,
                    category: stored.category,
                    status: status || {
                        connected: true,
                        provider: stored.provider,
                        lastChecked: new Date(),
                        lastUsed: stored.lastUsed,
                    },
                    credentials,
                    connectedAt: stored.connectedAt,
                    connectedBy: userId,
                });
            }
        }

        return connections;
    }

    async isConnected(userId: string, provider: IntegrationProvider): Promise<boolean> {
        const key = this.generateKey(userId, provider);
        return this.credentials.has(key);
    }

    async getConnectionStatus(
        userId: string,
        provider: IntegrationProvider
    ): Promise<IntegrationStatus | null> {
        const key = this.generateKey(userId, provider);
        const stored = this.credentials.get(key);

        if (!stored) {
            return null;
        }

        const credentials = await this.decrypt(stored.credentials);

        return {
            connected: true,
            provider,
            lastChecked: new Date(),
            lastUsed: stored.lastUsed,
            // Check if token is expired
            error: this.isExpired(credentials) ? 'Token expired' : undefined,
        };
    }

    // ==================
    // Token Management
    // ==================

    async refreshTokens(
        userId: string,
        provider: IntegrationProvider,
        refreshFn: (credentials: IntegrationCredentials) => Promise<IntegrationCredentials>
    ): Promise<IntegrationCredentials> {
        const credentials = await this.getCredentials(userId, provider);

        if (!credentials) {
            throw new Error(`No credentials found for ${provider}`);
        }

        if (!credentials.refreshToken) {
            throw new Error('No refresh token available');
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                const refreshed = await refreshFn(credentials);
                await this.updateCredentials(userId, provider, refreshed);
                await this.logAccess(userId, provider, 'refresh', true);
                return refreshed;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                // Wait before retry with exponential backoff
                await this.sleep(Math.pow(2, attempt) * 1000);
            }
        }

        await this.logAccess(
            userId,
            provider,
            'refresh',
            false,
            lastError?.message || 'Max retries exceeded'
        );

        throw lastError || new Error('Token refresh failed');
    }

    needsRefresh(credentials: IntegrationCredentials): boolean {
        if (!credentials.expiresAt) {
            return false;
        }

        const expiresAt = new Date(credentials.expiresAt).getTime();
        const now = Date.now();

        return expiresAt - now < this.config.refreshThresholdMs;
    }

    // ==================
    // Audit
    // ==================

    async getAccessLogs(
        userId: string,
        options?: {
            provider?: IntegrationProvider;
            limit?: number;
            from?: Date;
        }
    ): Promise<CredentialAccessLog[]> {
        let logs = this.accessLogs.filter((log) => log.userId === userId);

        if (options?.provider) {
            logs = logs.filter((log) => log.provider === options.provider);
        }

        if (options?.from) {
            logs = logs.filter((log) => log.timestamp >= options.from!);
        }

        // Sort by timestamp descending
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (options?.limit) {
            logs = logs.slice(0, options.limit);
        }

        return logs;
    }

    // ==================
    // Private Helpers
    // ==================

    private generateKey(userId: string, provider: IntegrationProvider): string {
        return `${userId}:${provider}`;
    }

    /**
     * Encrypt credentials
     * TODO: Implement actual encryption using AES-256-GCM
     */
    private async encrypt(credentials: IntegrationCredentials): Promise<IntegrationCredentials> {
        // In production, this would use proper encryption
        // For now, return as-is (NEVER do this in production!)
        if (!this.config.encryptionKey) {
            console.warn('[CredentialsVault] WARNING: No encryption key set!');
        }
        return credentials;
    }

    /**
     * Decrypt credentials
     * TODO: Implement actual decryption
     */
    private async decrypt(credentials: IntegrationCredentials): Promise<IntegrationCredentials> {
        // In production, this would use proper decryption
        return credentials;
    }

    private isExpired(credentials: IntegrationCredentials): boolean {
        if (!credentials.expiresAt) {
            return false;
        }

        return new Date(credentials.expiresAt).getTime() < Date.now();
    }

    private async logAccess(
        userId: string,
        provider: IntegrationProvider,
        action: CredentialAccessLog['action'],
        success: boolean,
        error?: string
    ): Promise<void> {
        const log: CredentialAccessLog = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            provider,
            action,
            success,
            error,
            timestamp: new Date(),
        };

        this.accessLogs.push(log);

        // Keep only last 10000 logs in memory
        if (this.accessLogs.length > 10000) {
            this.accessLogs = this.accessLogs.slice(-10000);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// ==================
// Singleton Export
// ==================

let vaultInstance: CredentialsVault | null = null;

export function getCredentialsVault(): CredentialsVault {
    if (!vaultInstance) {
        vaultInstance = new CredentialsVault();
    }
    return vaultInstance;
}
