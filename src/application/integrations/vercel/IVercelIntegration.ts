/**
 * Vercel Integration Interface
 *
 * Enables Charlie to:
 * - Create and manage projects
 * - Deploy from GitHub repos
 * - Configure custom domains
 * - Manage environment variables
 * - Monitor deployments
 */

import { IIntegration } from '../IIntegration';
import { ActionResult } from '../../../domain/integrations/types';

// ==================
// Vercel Types
// ==================

export interface VercelUser {
    id: string;
    email: string;
    name: string | null;
    username: string;
    avatar: string | null;
}

export interface VercelTeam {
    id: string;
    slug: string;
    name: string;
    avatar: string | null;
}

export interface VercelProject {
    id: string;
    name: string;
    framework: string | null;
    devCommand: string | null;
    buildCommand: string | null;
    outputDirectory: string | null;
    rootDirectory: string | null;
    nodeVersion: string;
    createdAt: Date;
    updatedAt: Date;
    link?: {
        type: 'github' | 'gitlab' | 'bitbucket';
        org: string;
        repo: string;
        productionBranch: string;
    };
    latestDeployments?: VercelDeployment[];
}

export interface VercelDeployment {
    id: string;
    name: string;
    url: string;
    state: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
    readyState: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
    createdAt: Date;
    buildingAt?: Date;
    ready?: Date;
    source: 'git' | 'cli' | 'api';
    meta?: {
        githubCommitSha?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
    };
}

export interface VercelDomain {
    name: string;
    projectId: string;
    redirect?: string;
    redirectStatusCode?: 301 | 302 | 307 | 308;
    gitBranch?: string;
    verified: boolean;
    createdAt: Date;
}

export interface VercelEnvVar {
    id: string;
    key: string;
    value: string;
    type: 'plain' | 'encrypted' | 'secret';
    target: ('production' | 'preview' | 'development')[];
    gitBranch?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ==================
// Request Types
// ==================

export interface CreateProjectOptions {
    name: string;
    framework?: 'nextjs' | 'react' | 'vue' | 'nuxt' | 'svelte' | 'gatsby' | 'astro' | 'remix' | null;
    buildCommand?: string;
    devCommand?: string;
    outputDirectory?: string;
    rootDirectory?: string;
    nodeVersion?: '18.x' | '20.x';
    environmentVariables?: Array<{
        key: string;
        value: string;
        target: ('production' | 'preview' | 'development')[];
    }>;
}

export interface LinkGitRepoOptions {
    projectId: string;
    type: 'github' | 'gitlab' | 'bitbucket';
    org: string;
    repo: string;
    productionBranch?: string;
}

export interface CreateDeploymentOptions {
    projectId: string;
    target?: 'production' | 'preview';
    ref?: string; // Git ref to deploy
}

export interface AddDomainOptions {
    projectId: string;
    domain: string;
    redirect?: string;
    gitBranch?: string;
}

export interface SetEnvVarOptions {
    projectId: string;
    key: string;
    value: string;
    type?: 'plain' | 'encrypted' | 'secret';
    target: ('production' | 'preview' | 'development')[];
    gitBranch?: string;
}

// ==================
// Vercel Integration Interface
// ==================

export interface IVercelIntegration extends IIntegration {
    // ==================
    // User & Team
    // ==================

    /**
     * Get authenticated user info
     */
    getAuthenticatedUser(userId: string): Promise<ActionResult<VercelUser>>;

    /**
     * List teams the user belongs to
     */
    listTeams(userId: string): Promise<ActionResult<VercelTeam[]>>;

    /**
     * Set active team for subsequent operations
     */
    setActiveTeam(userId: string, teamId: string | null): Promise<ActionResult<void>>;

    // ==================
    // Projects
    // ==================

    /**
     * List all projects
     */
    listProjects(userId: string, options?: {
        limit?: number;
        from?: number;
        search?: string;
    }): Promise<ActionResult<VercelProject[]>>;

    /**
     * Get a specific project
     */
    getProject(userId: string, projectId: string): Promise<ActionResult<VercelProject>>;

    /**
     * Create a new project
     * ACTION LEVEL: create
     */
    createProject(userId: string, options: CreateProjectOptions): Promise<ActionResult<VercelProject>>;

    /**
     * Delete a project
     * ACTION LEVEL: delete (requires confirmation)
     */
    deleteProject(userId: string, projectId: string): Promise<ActionResult<void>>;

    /**
     * Link project to Git repository
     * ACTION LEVEL: modify
     */
    linkGitRepo(userId: string, options: LinkGitRepoOptions): Promise<ActionResult<VercelProject>>;

    // ==================
    // Deployments
    // ==================

    /**
     * List deployments for a project
     */
    listDeployments(userId: string, projectId: string, options?: {
        limit?: number;
        state?: VercelDeployment['state'];
    }): Promise<ActionResult<VercelDeployment[]>>;

    /**
     * Get deployment details
     */
    getDeployment(userId: string, deploymentId: string): Promise<ActionResult<VercelDeployment>>;

    /**
     * Trigger a new deployment
     * ACTION LEVEL: create
     */
    createDeployment(userId: string, options: CreateDeploymentOptions): Promise<ActionResult<VercelDeployment>>;

    /**
     * Cancel a deployment
     * ACTION LEVEL: modify
     */
    cancelDeployment(userId: string, deploymentId: string): Promise<ActionResult<void>>;

    /**
     * Promote deployment to production
     * ACTION LEVEL: modify
     */
    promoteDeployment(userId: string, deploymentId: string): Promise<ActionResult<VercelDeployment>>;

    /**
     * Rollback to a previous deployment
     * ACTION LEVEL: modify
     */
    rollbackDeployment(userId: string, projectId: string, deploymentId: string): Promise<ActionResult<VercelDeployment>>;

    // ==================
    // Domains
    // ==================

    /**
     * List domains for a project
     */
    listDomains(userId: string, projectId: string): Promise<ActionResult<VercelDomain[]>>;

    /**
     * Add domain to project
     * ACTION LEVEL: create
     */
    addDomain(userId: string, options: AddDomainOptions): Promise<ActionResult<VercelDomain>>;

    /**
     * Remove domain from project
     * ACTION LEVEL: delete
     */
    removeDomain(userId: string, projectId: string, domain: string): Promise<ActionResult<void>>;

    /**
     * Verify domain DNS configuration
     */
    verifyDomain(userId: string, projectId: string, domain: string): Promise<ActionResult<{
        verified: boolean;
        verification?: {
            type: 'TXT' | 'CNAME';
            domain: string;
            value: string;
        };
    }>>;

    // ==================
    // Environment Variables
    // ==================

    /**
     * List environment variables for a project
     */
    listEnvVars(userId: string, projectId: string): Promise<ActionResult<VercelEnvVar[]>>;

    /**
     * Get a specific environment variable
     */
    getEnvVar(userId: string, projectId: string, envId: string): Promise<ActionResult<VercelEnvVar>>;

    /**
     * Create or update environment variable
     * ACTION LEVEL: modify
     */
    setEnvVar(userId: string, options: SetEnvVarOptions): Promise<ActionResult<VercelEnvVar>>;

    /**
     * Delete environment variable
     * ACTION LEVEL: delete
     */
    deleteEnvVar(userId: string, projectId: string, envId: string): Promise<ActionResult<void>>;

    /**
     * Bulk set environment variables
     * ACTION LEVEL: modify
     */
    bulkSetEnvVars(userId: string, projectId: string, envVars: SetEnvVarOptions[]): Promise<ActionResult<VercelEnvVar[]>>;
}
