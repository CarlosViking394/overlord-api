/**
 * Base Integration Interface
 *
 * All third-party integrations implement this interface to ensure
 * consistent behavior across the integrations hub.
 */

import {
    IntegrationCategory,
    IntegrationProvider,
    IntegrationCredentials,
    IntegrationStatus,
    ActionResult,
} from '../../domain/integrations/types';

/**
 * OAuth Configuration for integrations that use OAuth
 */
export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    redirectUri: string;
}

/**
 * Base Integration Interface
 *
 * Every integration provider must implement these core methods.
 */
export interface IIntegration {
    /**
     * Integration identifier
     */
    readonly provider: IntegrationProvider;

    /**
     * Integration category
     */
    readonly category: IntegrationCategory;

    /**
     * Human-readable name
     */
    readonly displayName: string;

    /**
     * Required OAuth scopes or API permissions
     */
    readonly requiredScopes: string[];

    /**
     * Integration description
     */
    readonly description: string;

    /**
     * Integration icon URL
     */
    readonly iconUrl: string;

    /**
     * Documentation URL
     */
    readonly docsUrl: string;

    // ==================
    // Connection Methods
    // ==================

    /**
     * Generate OAuth URL or return setup instructions
     * @param userId - User initiating the connection
     * @param state - State parameter for OAuth flow
     * @returns OAuth URL to redirect user, or setup instructions
     */
    getAuthUrl(userId: string, state: string): Promise<string>;

    /**
     * Handle OAuth callback and exchange code for tokens
     * @param userId - User completing the connection
     * @param code - Authorization code from OAuth callback
     * @param state - State parameter to verify
     * @returns Credentials to store
     */
    handleCallback(userId: string, code: string, state: string): Promise<IntegrationCredentials>;

    /**
     * Disconnect integration for a user
     * @param userId - User disconnecting
     */
    disconnect(userId: string): Promise<void>;

    /**
     * Check current connection status
     * @param userId - User to check
     * @returns Current status including rate limits
     */
    getStatus(userId: string): Promise<IntegrationStatus>;

    /**
     * Refresh expired credentials
     * @param userId - User whose credentials to refresh
     * @param credentials - Current credentials
     * @returns New credentials
     */
    refreshCredentials(userId: string, credentials: IntegrationCredentials): Promise<IntegrationCredentials>;

    /**
     * Validate credentials are still valid
     * @param credentials - Credentials to validate
     * @returns True if valid
     */
    validateCredentials(credentials: IntegrationCredentials): Promise<boolean>;

    // ==================
    // Health Check
    // ==================

    /**
     * Test connection to the integration
     * @param credentials - Credentials to test
     * @returns Action result with connection status
     */
    testConnection(credentials: IntegrationCredentials): Promise<ActionResult<{ connected: boolean }>>;
}

/**
 * Integration with API Key authentication
 */
export interface IApiKeyIntegration extends IIntegration {
    /**
     * Validate and store API key
     * @param userId - User adding API key
     * @param apiKey - API key to validate
     * @returns Credentials if valid
     */
    validateApiKey(userId: string, apiKey: string): Promise<IntegrationCredentials>;
}

/**
 * Integration metadata for registry
 */
export interface IntegrationMetadata {
    provider: IntegrationProvider;
    category: IntegrationCategory;
    displayName: string;
    description: string;
    iconUrl: string;
    docsUrl: string;
    authType: 'oauth' | 'api_key' | 'both';
    requiredScopes: string[];
    features: string[];
    pricing?: {
        hasFreeTeir: boolean;
        startingPrice?: number;
        pricingUrl: string;
    };
}
