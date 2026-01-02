/**
 * Integrations Hub Exports
 *
 * Central module for all third-party integrations.
 * Charlie uses these integrations to transform business ideas into reality.
 */

// ==================
// Domain Types
// ==================

export * from '../../domain/integrations/types';

// ==================
// Base Interfaces
// ==================

export * from './IIntegration';

// ==================
// Provider Interfaces
// ==================

// Version Control
export * from './github/IGitHubIntegration';

// Hosting
export * from './vercel/IVercelIntegration';

// Domains
export * from './domains/IDomainsIntegration';

// ==================
// Hub & Vault
// ==================

export * from './IntegrationsHub';
export * from './CredentialsVault';

// ==================
// Quick Access
// ==================

import { getIntegrationsHub, IntegrationsHub } from './IntegrationsHub';
import { getCredentialsVault, CredentialsVault } from './CredentialsVault';

/**
 * Get the singleton IntegrationsHub instance
 */
export { getIntegrationsHub };

/**
 * Get the singleton CredentialsVault instance
 */
export { getCredentialsVault };

/**
 * Initialize the integrations system
 * Call this during application startup
 */
export function initializeIntegrations(): {
    hub: IntegrationsHub;
    vault: CredentialsVault;
} {
    const hub = getIntegrationsHub();
    const vault = getCredentialsVault();

    // TODO: Register integration implementations here
    // hub.registerIntegration(new GitHubIntegration());
    // hub.registerIntegration(new VercelIntegration());
    // hub.registerIntegration(new CloudflareIntegration());

    return { hub, vault };
}
