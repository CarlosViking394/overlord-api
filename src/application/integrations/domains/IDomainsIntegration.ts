/**
 * Domain Provider Integration Interface
 *
 * Enables Charlie to:
 * - Check domain availability
 * - Register domains (with user purchase approval)
 * - Configure DNS records
 * - Manage domain settings
 * - Transfer domains
 */

import { IIntegration } from '../IIntegration';
import { ActionResult, IntegrationProvider } from '../../../domain/integrations/types';

// ==================
// Domain Types
// ==================

export interface DomainAvailability {
    domain: string;
    available: boolean;
    premium: boolean;
    price?: {
        registration: number;
        renewal: number;
        currency: string;
    };
    suggestions?: DomainSuggestion[];
}

export interface DomainSuggestion {
    domain: string;
    available: boolean;
    price?: {
        registration: number;
        renewal: number;
        currency: string;
    };
}

export interface Domain {
    id: string;
    name: string;
    status: 'active' | 'pending' | 'expired' | 'transferring';
    expiresAt: Date;
    autoRenew: boolean;
    locked: boolean;
    registrar: string;
    createdAt: Date;
    nameservers: string[];
}

export interface DnsRecord {
    id: string;
    type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA';
    name: string; // @ for root, or subdomain
    content: string;
    ttl: number; // Time to live in seconds
    priority?: number; // For MX and SRV records
    proxied?: boolean; // For Cloudflare
}

export interface WhoisInfo {
    registrant?: {
        name?: string;
        organization?: string;
        email?: string;
        country?: string;
    };
    createdDate?: Date;
    expirationDate?: Date;
    updatedDate?: Date;
    nameservers: string[];
    registrar?: string;
}

// ==================
// Request Types
// ==================

export interface RegisterDomainOptions {
    domain: string;
    years?: number; // Default: 1
    autoRenew?: boolean;
    privacyProtection?: boolean;
    registrant: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        address: {
            street: string;
            city: string;
            state: string;
            postalCode: string;
            country: string; // ISO country code
        };
    };
    nameservers?: string[]; // Custom nameservers
}

export interface CreateDnsRecordOptions {
    domain: string;
    type: DnsRecord['type'];
    name: string;
    content: string;
    ttl?: number;
    priority?: number;
    proxied?: boolean;
}

export interface UpdateDnsRecordOptions extends CreateDnsRecordOptions {
    recordId: string;
}

// ==================
// Common DNS Templates
// ==================

export interface DnsTemplate {
    name: string;
    description: string;
    records: Omit<CreateDnsRecordOptions, 'domain'>[];
}

export const DNS_TEMPLATES = {
    vercel: {
        name: 'Vercel Hosting',
        description: 'Configure domain for Vercel deployment',
        records: [
            { type: 'A' as const, name: '@', content: '76.76.21.21', ttl: 3600 },
            { type: 'CNAME' as const, name: 'www', content: 'cname.vercel-dns.com', ttl: 3600 },
        ],
    },
    netlify: {
        name: 'Netlify Hosting',
        description: 'Configure domain for Netlify deployment',
        records: [
            { type: 'A' as const, name: '@', content: '75.2.60.5', ttl: 3600 },
            { type: 'CNAME' as const, name: 'www', content: '[site].netlify.app', ttl: 3600 },
        ],
    },
    googleWorkspace: {
        name: 'Google Workspace Email',
        description: 'Configure MX records for Google Workspace',
        records: [
            { type: 'MX' as const, name: '@', content: 'aspmx.l.google.com', priority: 1, ttl: 3600 },
            { type: 'MX' as const, name: '@', content: 'alt1.aspmx.l.google.com', priority: 5, ttl: 3600 },
            { type: 'MX' as const, name: '@', content: 'alt2.aspmx.l.google.com', priority: 5, ttl: 3600 },
        ],
    },
} as const;

// ==================
// Domain Provider Integration Interface
// ==================

export interface IDomainsIntegration extends IIntegration {
    /**
     * Domain provider type
     */
    readonly domainProvider: 'cloudflare' | 'godaddy' | 'namecheap';

    // ==================
    // Domain Search
    // ==================

    /**
     * Check if a domain is available for registration
     */
    checkAvailability(userId: string, domain: string): Promise<ActionResult<DomainAvailability>>;

    /**
     * Check availability of multiple domains
     */
    bulkCheckAvailability(userId: string, domains: string[]): Promise<ActionResult<DomainAvailability[]>>;

    /**
     * Get domain suggestions based on keywords
     */
    getSuggestions(userId: string, keywords: string[], tlds?: string[]): Promise<ActionResult<DomainSuggestion[]>>;

    /**
     * Get WHOIS information for a domain
     */
    getWhois(userId: string, domain: string): Promise<ActionResult<WhoisInfo>>;

    // ==================
    // Domain Management
    // ==================

    /**
     * List user's domains
     */
    listDomains(userId: string): Promise<ActionResult<Domain[]>>;

    /**
     * Get domain details
     */
    getDomain(userId: string, domain: string): Promise<ActionResult<Domain>>;

    /**
     * Register a new domain
     * ACTION LEVEL: purchase (requires confirmation with price)
     */
    registerDomain(userId: string, options: RegisterDomainOptions): Promise<ActionResult<Domain>>;

    /**
     * Renew domain registration
     * ACTION LEVEL: purchase (requires confirmation with price)
     */
    renewDomain(userId: string, domain: string, years?: number): Promise<ActionResult<Domain>>;

    /**
     * Update auto-renew setting
     * ACTION LEVEL: modify
     */
    setAutoRenew(userId: string, domain: string, autoRenew: boolean): Promise<ActionResult<Domain>>;

    /**
     * Lock/unlock domain for transfer
     * ACTION LEVEL: modify
     */
    setDomainLock(userId: string, domain: string, locked: boolean): Promise<ActionResult<Domain>>;

    /**
     * Update nameservers
     * ACTION LEVEL: modify
     */
    updateNameservers(userId: string, domain: string, nameservers: string[]): Promise<ActionResult<Domain>>;

    // ==================
    // DNS Management
    // ==================

    /**
     * List DNS records for a domain
     */
    listDnsRecords(userId: string, domain: string): Promise<ActionResult<DnsRecord[]>>;

    /**
     * Get a specific DNS record
     */
    getDnsRecord(userId: string, domain: string, recordId: string): Promise<ActionResult<DnsRecord>>;

    /**
     * Create a DNS record
     * ACTION LEVEL: create
     */
    createDnsRecord(userId: string, options: CreateDnsRecordOptions): Promise<ActionResult<DnsRecord>>;

    /**
     * Update a DNS record
     * ACTION LEVEL: modify
     */
    updateDnsRecord(userId: string, options: UpdateDnsRecordOptions): Promise<ActionResult<DnsRecord>>;

    /**
     * Delete a DNS record
     * ACTION LEVEL: delete
     */
    deleteDnsRecord(userId: string, domain: string, recordId: string): Promise<ActionResult<void>>;

    /**
     * Apply a DNS template
     * ACTION LEVEL: modify
     */
    applyDnsTemplate(userId: string, domain: string, template: DnsTemplate): Promise<ActionResult<DnsRecord[]>>;

    // ==================
    // Domain Transfer
    // ==================

    /**
     * Initiate domain transfer in
     * ACTION LEVEL: purchase (requires confirmation)
     */
    initiateTransferIn(userId: string, domain: string, authCode: string): Promise<ActionResult<{ transferId: string; status: string }>>;

    /**
     * Get transfer auth code for transfer out
     * ACTION LEVEL: read
     */
    getTransferAuthCode(userId: string, domain: string): Promise<ActionResult<{ authCode: string }>>;

    /**
     * Check transfer status
     */
    getTransferStatus(userId: string, transferId: string): Promise<ActionResult<{ status: string; message?: string }>>;
}

/**
 * Cloudflare-specific interface extensions
 */
export interface ICloudflareIntegration extends IDomainsIntegration {
    readonly domainProvider: 'cloudflare';

    /**
     * Enable/disable Cloudflare proxy for a record
     */
    setProxyStatus(userId: string, domain: string, recordId: string, proxied: boolean): Promise<ActionResult<DnsRecord>>;

    /**
     * Purge Cloudflare cache for a domain
     */
    purgeCache(userId: string, domain: string, purgeEverything?: boolean): Promise<ActionResult<void>>;

    /**
     * Get SSL/TLS settings
     */
    getSslSettings(userId: string, domain: string): Promise<ActionResult<{
        mode: 'off' | 'flexible' | 'full' | 'strict';
        certificate?: { expiresAt: Date };
    }>>;

    /**
     * Set SSL/TLS mode
     */
    setSslMode(userId: string, domain: string, mode: 'off' | 'flexible' | 'full' | 'strict'): Promise<ActionResult<void>>;
}
