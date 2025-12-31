/**
 * Database Seed Script
 * Populates the database with development data
 *
 * Usage: npm run db:seed
 */

import { config } from 'dotenv';
import bcrypt from 'bcrypt';
import { getDb, closeDb, testConnection, schema } from '../src/infrastructure/database';

config();

const SEED_PASSWORD = 'charlie123';
const SALT_ROUNDS = 10;

async function seed() {
    console.log('🌱 Starting database seed...\n');

    // Test connection
    const connected = await testConnection();
    if (!connected) {
        console.error('❌ Failed to connect to database');
        process.exit(1);
    }
    console.log('✅ Database connected\n');

    const db = getDb();

    try {
        // Hash password
        const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
        console.log('🔐 Password hash generated\n');

        // =============================================================================
        // SEED WORKSPACES
        // =============================================================================
        console.log('📁 Seeding workspaces...');

        await db.insert(schema.workspaces).values({
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            name: 'Client Alpha',
            slug: 'client-alpha',
            ownerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            settings: {
                maxLords: 5,
                maxExperts: 3,
                maxApps: 2,
                features: ['voice-input', 'code-modification'],
            },
        }).onConflictDoNothing();

        console.log('  ✓ Workspace: Client Alpha\n');

        // =============================================================================
        // SEED USERS
        // =============================================================================
        console.log('👥 Seeding users...');

        // OVERLORD (Carlos)
        await db.insert(schema.users).values({
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
            email: 'carlos@agentcharlie.dev',
            name: 'Carlos',
            passwordHash,
            role: 'OVERLORD',
            workspaceId: null,
            voiceId: 'elevenlabs-carlos-voice-id',
            permissions: null,
        }).onConflictDoNothing();
        console.log('  ✓ OVERLORD: carlos@agentcharlie.dev');

        // ADMIN (Workspace Owner)
        await db.insert(schema.users).values({
            id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            email: 'admin@clientalpha.com',
            name: 'Alex Admin',
            passwordHash,
            role: 'ADMIN',
            workspaceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            voiceId: 'elevenlabs-professional-voice',
            createdBy: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
            permissions: null,
        }).onConflictDoNothing();
        console.log('  ✓ ADMIN: admin@clientalpha.com');

        // LORD (Employee)
        await db.insert(schema.users).values({
            id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            email: 'lord@clientalpha.com',
            name: 'Luna Lord',
            passwordHash,
            role: 'LORD',
            workspaceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            voiceId: 'elevenlabs-friendly-voice',
            createdBy: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            permissions: {
                apps: [
                    {
                        appId: 'overlord-ui',
                        canRead: true,
                        canModify: true,
                        canDeployStaging: true,
                        canDeployProduction: false,
                    },
                ],
                experts: {
                    canCreate: true,
                    canUseIds: ['*'],
                    maxExperts: 2,
                },
                actions: {
                    canModifyCode: true,
                    canCreatePRs: true,
                    canMergeToDevelop: true,
                    canMergeToMain: false,
                    requiresApproval: false,
                },
            },
        }).onConflictDoNothing();
        console.log('  ✓ LORD: lord@clientalpha.com\n');

        // =============================================================================
        // SEED SERVICES
        // =============================================================================
        console.log('🔌 Seeding services...');

        await db.insert(schema.services).values([
            {
                id: 'overlord-api',
                name: 'Overlord API',
                type: 'api',
                baseUrl: 'http://localhost:3000',
                healthEndpoint: '/health',
                capabilities: [
                    { name: 'service-registry', version: '1.0.0' },
                    { name: 'gateway', version: '1.0.0' },
                    { name: 'event-bus', version: '1.0.0' },
                ],
                version: '1.0.0',
                status: 'healthy',
            },
            {
                id: 'overlord-ui',
                name: 'Overlord Mobile App',
                type: 'mobile_app',
                baseUrl: 'http://localhost:8081',
                healthEndpoint: '/health',
                capabilities: [
                    { name: 'voice-input', version: '1.0.0' },
                    { name: 'offline-sync', version: '1.0.0' },
                ],
                version: '1.0.0',
                status: 'starting',
            },
            {
                id: 'payment-agent',
                name: 'Payment Agent',
                type: 'agent',
                baseUrl: 'http://localhost:3010',
                healthEndpoint: '/health',
                capabilities: [
                    { name: 'process-payment', version: '1.0.0' },
                    { name: 'refund', version: '1.0.0' },
                    { name: 'subscription', version: '1.0.0' },
                ],
                version: '1.0.0',
                status: 'starting',
            },
        ]).onConflictDoNothing();

        console.log('  ✓ Service: overlord-api');
        console.log('  ✓ Service: overlord-ui');
        console.log('  ✓ Service: payment-agent\n');

        // =============================================================================
        // SUMMARY
        // =============================================================================
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('                    🎉 SEED COMPLETE!                          ');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        console.log('  Test Users (password: charlie123)');
        console.log('  ─────────────────────────────────────────');
        console.log('  OVERLORD │ carlos@agentcharlie.dev');
        console.log('  ADMIN    │ admin@clientalpha.com');
        console.log('  LORD     │ lord@clientalpha.com');
        console.log('');
        console.log('  Services Registered');
        console.log('  ─────────────────────────────────────────');
        console.log('  API        │ http://localhost:3000');
        console.log('  Mobile App │ http://localhost:8081');
        console.log('  Agent      │ http://localhost:3010');
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    } finally {
        await closeDb();
    }
}

seed();
