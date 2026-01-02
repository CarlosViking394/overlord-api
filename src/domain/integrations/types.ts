/**
 * Integration Domain Types
 *
 * VISION: Charlie Business Pipeline
 * ================================
 * This integration system enables Charlie to transform business ideas into reality:
 *
 * 1. User shares business idea (e.g., "online jewelry store")
 * 2. Charlie creates action plan with required integrations
 * 3. With user approval, Charlie executes:
 *    - Creates GitHub repository with appropriate template
 *    - Configures Vercel project for deployment
 *    - Helps register/connect domain
 *    - Sets up payment processing (Stripe)
 *    - Deploys initial storefront
 * 4. User manages and iterates through Charlie dashboard
 *
 * All destructive/paid actions require explicit user approval.
 */

/**
 * Integration Categories
 */
export type IntegrationCategory =
    | 'version_control'  // GitHub, GitLab, Bitbucket
    | 'hosting'          // Vercel, Netlify, AWS
    | 'domains'          // Cloudflare, GoDaddy, Namecheap
    | 'payments'         // Stripe, PayPal, Square
    | 'ecommerce'        // Shopify, Medusa, WooCommerce
    | 'email'            // Resend, SendGrid, Mailgun
    | 'storage'          // S3, Cloudinary, Supabase
    | 'analytics';       // Google Analytics, Mixpanel

/**
 * Supported Integration Providers
 */
export type IntegrationProvider =
    // Version Control
    | 'github'
    | 'gitlab'
    | 'bitbucket'
    // Hosting
    | 'vercel'
    | 'netlify'
    | 'aws'
    // Domains
    | 'cloudflare'
    | 'godaddy'
    | 'namecheap'
    // Payments
    | 'stripe'
    | 'paypal'
    // E-commerce
    | 'shopify'
    | 'medusa'
    // Email
    | 'resend'
    | 'sendgrid'
    // Storage
    | 's3'
    | 'cloudinary'
    | 'supabase'
    // Analytics
    | 'google_analytics'
    | 'mixpanel';

/**
 * Credential Types
 */
export type CredentialType = 'oauth' | 'api_key' | 'basic_auth';

/**
 * Integration Credentials (stored encrypted)
 */
export interface IntegrationCredentials {
    type: CredentialType;
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    apiSecret?: string;
    expiresAt?: Date;
    scopes?: string[];
    metadata?: Record<string, string>; // Provider-specific data (teamId, accountId, etc.)
}

/**
 * Integration Connection Status
 */
export interface IntegrationStatus {
    connected: boolean;
    provider: IntegrationProvider;
    lastChecked: Date;
    lastUsed?: Date;
    error?: string;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
}

/**
 * Action Approval Levels
 */
export type ActionLevel = 'read' | 'create' | 'modify' | 'delete' | 'purchase';

/**
 * Action requiring user approval
 */
export interface PendingAction {
    id: string;
    userId: string;
    integration: IntegrationProvider;
    actionType: ActionLevel;
    action: string;
    description: string;
    impact: string;
    params: Record<string, unknown>;
    cost?: {
        amount: number;
        currency: string;
        recurring?: boolean;
        interval?: 'monthly' | 'yearly';
    };
    requiresConfirmation: boolean;
    confirmationMessage?: string;
    createdAt: Date;
    expiresAt: Date;
    status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
    executedAt?: Date;
    result?: unknown;
    error?: string;
}

/**
 * Integration Action Result
 */
export interface ActionResult<T = unknown> {
    success: boolean;
    action: string;
    data?: T;
    error?: string;
    duration: number; // milliseconds
}

/**
 * Business Template Categories
 */
export type TemplateCategory = 'ecommerce' | 'saas' | 'portfolio' | 'blog' | 'landing' | 'api';

/**
 * Business Template Definition
 */
export interface BusinessTemplate {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    requiredIntegrations: IntegrationProvider[];
    optionalIntegrations: IntegrationProvider[];
    actions: TemplateAction[];
    estimatedSetupTime: string;
    estimatedMonthlyCost: {
        min: number;
        max: number;
        currency: string;
    };
    previewUrl?: string;
    githubTemplate?: string;
}

/**
 * Template Action Step
 */
export interface TemplateAction {
    step: number;
    action: string; // e.g., 'github.createRepo', 'vercel.deploy'
    description: string;
    params: Record<string, unknown>;
    requiresUserInput?: string[]; // List of params that need user input
    optional?: boolean;
}

/**
 * User's Connected Integrations
 */
export interface UserIntegrations {
    userId: string;
    connections: IntegrationConnection[];
    updatedAt: Date;
}

/**
 * Single Integration Connection
 */
export interface IntegrationConnection {
    provider: IntegrationProvider;
    category: IntegrationCategory;
    status: IntegrationStatus;
    credentials: IntegrationCredentials; // Encrypted at rest
    connectedAt: Date;
    connectedBy: string; // User who connected
}

/**
 * Integration Event for Audit Log
 */
export interface IntegrationEvent {
    id: string;
    userId: string;
    integration: IntegrationProvider;
    action: string;
    actionLevel: ActionLevel;
    status: 'started' | 'success' | 'failed';
    params: Record<string, unknown>;
    result?: unknown;
    error?: string;
    duration?: number;
    timestamp: Date;
    approvalId?: string; // Link to PendingAction if approval was required
}
