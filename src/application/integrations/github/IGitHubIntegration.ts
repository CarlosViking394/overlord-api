/**
 * GitHub Integration Interface
 *
 * Enables Charlie to:
 * - Create repositories from templates
 * - Push code and manage branches
 * - Trigger GitHub Actions workflows
 * - Manage repository settings
 */

import { IIntegration } from '../IIntegration';
import { ActionResult } from '../../../domain/integrations/types';

// ==================
// GitHub Types
// ==================

export interface GitHubUser {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatarUrl: string;
    htmlUrl: string;
}

export interface GitHubRepo {
    id: number;
    name: string;
    fullName: string;
    description: string | null;
    private: boolean;
    htmlUrl: string;
    cloneUrl: string;
    defaultBranch: string;
    language: string | null;
    createdAt: Date;
    updatedAt: Date;
    pushedAt: Date | null;
}

export interface GitHubBranch {
    name: string;
    commit: {
        sha: string;
        url: string;
    };
    protected: boolean;
}

export interface GitHubWorkflow {
    id: number;
    name: string;
    path: string;
    state: 'active' | 'disabled';
}

export interface GitHubWorkflowRun {
    id: number;
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
    htmlUrl: string;
    createdAt: Date;
}

// ==================
// Request Types
// ==================

export interface CreateRepoOptions {
    name: string;
    description?: string;
    private?: boolean;
    autoInit?: boolean;
    gitignoreTemplate?: string;
    licenseTemplate?: string;
}

export interface CreateRepoFromTemplateOptions {
    templateOwner: string;
    templateRepo: string;
    name: string;
    description?: string;
    private?: boolean;
    includeAllBranches?: boolean;
}

export interface FileContent {
    path: string;
    content: string; // Base64 encoded or plain text
    encoding?: 'base64' | 'utf-8';
}

export interface CommitFilesOptions {
    owner: string;
    repo: string;
    branch: string;
    files: FileContent[];
    message: string;
    authorName?: string;
    authorEmail?: string;
}

export interface CreateBranchOptions {
    owner: string;
    repo: string;
    branchName: string;
    fromBranch?: string; // Default: default branch
}

// ==================
// GitHub Integration Interface
// ==================

export interface IGitHubIntegration extends IIntegration {
    // ==================
    // User Info
    // ==================

    /**
     * Get authenticated user info
     */
    getAuthenticatedUser(userId: string): Promise<ActionResult<GitHubUser>>;

    // ==================
    // Repositories
    // ==================

    /**
     * List user's repositories
     */
    listRepos(userId: string, options?: {
        type?: 'all' | 'owner' | 'member';
        sort?: 'created' | 'updated' | 'pushed' | 'full_name';
        per_page?: number;
        page?: number;
    }): Promise<ActionResult<GitHubRepo[]>>;

    /**
     * Get a specific repository
     */
    getRepo(userId: string, owner: string, repo: string): Promise<ActionResult<GitHubRepo>>;

    /**
     * Create a new repository
     * ACTION LEVEL: create
     */
    createRepo(userId: string, options: CreateRepoOptions): Promise<ActionResult<GitHubRepo>>;

    /**
     * Create repository from template
     * ACTION LEVEL: create
     */
    createRepoFromTemplate(userId: string, options: CreateRepoFromTemplateOptions): Promise<ActionResult<GitHubRepo>>;

    /**
     * Delete a repository
     * ACTION LEVEL: delete (requires confirmation)
     */
    deleteRepo(userId: string, owner: string, repo: string): Promise<ActionResult<void>>;

    // ==================
    // Branches
    // ==================

    /**
     * List branches in a repository
     */
    listBranches(userId: string, owner: string, repo: string): Promise<ActionResult<GitHubBranch[]>>;

    /**
     * Create a new branch
     * ACTION LEVEL: create
     */
    createBranch(userId: string, options: CreateBranchOptions): Promise<ActionResult<GitHubBranch>>;

    // ==================
    // Files & Commits
    // ==================

    /**
     * Get file contents
     */
    getFileContent(userId: string, owner: string, repo: string, path: string, ref?: string): Promise<ActionResult<string>>;

    /**
     * Commit multiple files in a single commit
     * ACTION LEVEL: modify
     */
    commitFiles(userId: string, options: CommitFilesOptions): Promise<ActionResult<{ sha: string; url: string }>>;

    // ==================
    // GitHub Actions
    // ==================

    /**
     * List workflows in a repository
     */
    listWorkflows(userId: string, owner: string, repo: string): Promise<ActionResult<GitHubWorkflow[]>>;

    /**
     * Trigger a workflow
     * ACTION LEVEL: create
     */
    triggerWorkflow(userId: string, owner: string, repo: string, workflowId: number | string, ref: string, inputs?: Record<string, string>): Promise<ActionResult<void>>;

    /**
     * Get workflow run status
     */
    getWorkflowRun(userId: string, owner: string, repo: string, runId: number): Promise<ActionResult<GitHubWorkflowRun>>;

    /**
     * List recent workflow runs
     */
    listWorkflowRuns(userId: string, owner: string, repo: string, workflowId?: number): Promise<ActionResult<GitHubWorkflowRun[]>>;

    // ==================
    // Repository Settings
    // ==================

    /**
     * Update repository settings
     * ACTION LEVEL: modify
     */
    updateRepoSettings(userId: string, owner: string, repo: string, settings: {
        description?: string;
        homepage?: string;
        private?: boolean;
        hasIssues?: boolean;
        hasProjects?: boolean;
        hasWiki?: boolean;
    }): Promise<ActionResult<GitHubRepo>>;

    /**
     * Add repository secret for GitHub Actions
     * ACTION LEVEL: modify
     */
    addRepoSecret(userId: string, owner: string, repo: string, secretName: string, secretValue: string): Promise<ActionResult<void>>;
}
