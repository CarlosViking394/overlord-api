-- Overlord API Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types (enums)
CREATE TYPE user_role AS ENUM ('OVERLORD', 'ADMIN', 'LORD');
CREATE TYPE service_type AS ENUM ('agent', 'web_app', 'mobile_app', 'api');
CREATE TYPE service_status AS ENUM ('healthy', 'unhealthy', 'degraded', 'unknown', 'starting', 'stopping');
CREATE TYPE command_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'timeout');
CREATE TYPE workflow_status AS ENUM ('created', 'running', 'paused', 'completed', 'failed', 'cancelled');
CREATE TYPE event_type AS ENUM (
    'service.registered',
    'service.deregistered',
    'service.health_changed',
    'command.dispatched',
    'command.completed',
    'command.failed',
    'workflow.started',
    'workflow.completed',
    'workflow.failed'
);

-- =============================================================================
-- WORKSPACES TABLE
-- =============================================================================
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    owner_id UUID NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    role user_role NOT NULL DEFAULT 'LORD',
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    permissions JSONB, -- For Lord permissions
    voice_id VARCHAR(255), -- Eleven Labs voice ID
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_workspace ON users(workspace_id);

-- =============================================================================
-- API KEYS TABLE
-- =============================================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- =============================================================================
-- SERVICES TABLE (Service Registry)
-- =============================================================================
CREATE TABLE services (
    id VARCHAR(255) PRIMARY KEY, -- Slug-based ID
    name VARCHAR(255) NOT NULL,
    type service_type NOT NULL,
    base_url VARCHAR(512) NOT NULL,
    health_endpoint VARCHAR(255) DEFAULT '/health',
    capabilities JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    version VARCHAR(50) DEFAULT '1.0.0',
    status service_status DEFAULT 'starting',
    last_health_check JSONB,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_services_type ON services(type);
CREATE INDEX idx_services_status ON services(status);

-- =============================================================================
-- WORKFLOWS TABLE
-- =============================================================================
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status workflow_status DEFAULT 'created',
    current_step_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_workflows_status ON workflows(status);

-- =============================================================================
-- WORKFLOW STEPS TABLE
-- =============================================================================
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    service_id VARCHAR(255) REFERENCES services(id) ON DELETE SET NULL,
    command VARCHAR(255) NOT NULL,
    params JSONB DEFAULT '{}',
    depends_on VARCHAR(255)[] DEFAULT '{}',
    status command_status DEFAULT 'pending',
    result JSONB,
    step_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_status ON workflow_steps(status);

-- =============================================================================
-- COMMANDS TABLE (Command Dispatch Tracking)
-- =============================================================================
CREATE TABLE commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id VARCHAR(255) REFERENCES services(id) ON DELETE SET NULL,
    command VARCHAR(255) NOT NULL,
    params JSONB DEFAULT '{}',
    status command_status DEFAULT 'pending',
    result JSONB,
    error TEXT,
    dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_ms INTEGER DEFAULT 30000
);

CREATE INDEX idx_commands_service ON commands(service_id);
CREATE INDEX idx_commands_status ON commands(status);

-- =============================================================================
-- EVENTS TABLE (Event Log)
-- =============================================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type event_type NOT NULL,
    service_id VARCHAR(255),
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_service ON events(service_id);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);

-- =============================================================================
-- SESSIONS TABLE (For auth)
-- =============================================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to workspaces
CREATE TRIGGER workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Insert seed workspace
INSERT INTO workspaces (id, name, slug, owner_id, settings) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Client Alpha', 'client-alpha',
     'b2c3d4e5-f6a7-8901-bcde-f12345678901',
     '{"maxLords": 5, "maxExperts": 3, "maxApps": 2, "features": ["voice-input", "code-modification"]}');

-- Insert seed users (password: charlie123 - bcrypt hash)
-- Note: In production, use proper bcrypt hashing
INSERT INTO users (id, email, name, password_hash, role, workspace_id, voice_id, permissions) VALUES
    -- OVERLORD (Carlos)
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567891', 'carlos@agentcharlie.dev', 'Carlos',
     '$2b$10$dummy_hash_for_dev_replace_in_production', 'OVERLORD', NULL,
     'elevenlabs-carlos-voice-id', NULL),

    -- ADMIN (Workspace Owner)
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'admin@clientalpha.com', 'Alex Admin',
     '$2b$10$dummy_hash_for_dev_replace_in_production', 'ADMIN',
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'elevenlabs-professional-voice', NULL),

    -- LORD (Employee)
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'lord@clientalpha.com', 'Luna Lord',
     '$2b$10$dummy_hash_for_dev_replace_in_production', 'LORD',
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'elevenlabs-friendly-voice',
     '{
        "apps": [{"appId": "overlord-ui", "canRead": true, "canModify": true, "canDeployStaging": true, "canDeployProduction": false}],
        "experts": {"canCreate": true, "canUseIds": ["*"], "maxExperts": 2},
        "actions": {"canModifyCode": true, "canCreatePRs": true, "canMergeToDevelop": true, "canMergeToMain": false, "requiresApproval": false}
     }');

-- Update workspace owner reference
UPDATE workspaces SET owner_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Insert seed services
INSERT INTO services (id, name, type, base_url, health_endpoint, capabilities, version, status) VALUES
    ('overlord-api', 'Overlord API', 'api', 'http://localhost:3000', '/health',
     '[{"name": "service-registry", "version": "1.0.0"}, {"name": "gateway", "version": "1.0.0"}]',
     '1.0.0', 'healthy'),

    ('overlord-ui', 'Overlord Mobile App', 'mobile_app', 'http://localhost:8081', '/health',
     '[{"name": "voice-input", "version": "1.0.0"}, {"name": "offline-sync", "version": "1.0.0"}]',
     '1.0.0', 'starting'),

    ('payment-agent', 'Payment Agent', 'agent', 'http://localhost:3010', '/health',
     '[{"name": "process-payment", "version": "1.0.0"}, {"name": "refund", "version": "1.0.0"}]',
     '1.0.0', 'starting');

COMMENT ON TABLE users IS 'User accounts with role-based access control';
COMMENT ON TABLE workspaces IS 'Tenant isolation boundaries for Admins and Lords';
COMMENT ON TABLE services IS 'Service registry for all Agent Charlie services';
COMMENT ON TABLE workflows IS 'Orchestrated multi-step workflows';
COMMENT ON TABLE events IS 'Event log for audit and pub/sub';
