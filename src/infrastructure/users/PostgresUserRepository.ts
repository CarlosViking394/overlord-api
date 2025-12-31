/**
 * PostgreSQL User Repository Implementation
 */

import { eq } from 'drizzle-orm';
import { getDb, schema } from '../database';

export interface UserEntity {
    id: string;
    email: string;
    name: string;
    passwordHash: string | null;
    role: 'OVERLORD' | 'ADMIN' | 'LORD';
    workspaceId: string | null;
    permissions: Record<string, unknown> | null;
    voiceId: string | null;
    createdBy: string | null;
    createdAt: Date | null;
    lastActiveAt: Date | null;
}

export interface IUserRepository {
    findById(id: string): Promise<UserEntity | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
    findByWorkspace(workspaceId: string): Promise<UserEntity[]>;
    save(user: Omit<UserEntity, 'createdAt' | 'lastActiveAt'>): Promise<UserEntity>;
    updateLastActive(id: string): Promise<void>;
    delete(id: string): Promise<boolean>;
}

export class PostgresUserRepository implements IUserRepository {
    async findById(id: string): Promise<UserEntity | null> {
        const db = getDb();
        const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, id))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        return this.mapToEntity(result[0]);
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        const db = getDb();
        const result = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        return this.mapToEntity(result[0]);
    }

    async findByWorkspace(workspaceId: string): Promise<UserEntity[]> {
        const db = getDb();
        const results = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.workspaceId, workspaceId));

        return results.map(row => this.mapToEntity(row));
    }

    async save(user: Omit<UserEntity, 'createdAt' | 'lastActiveAt'>): Promise<UserEntity> {
        const db = getDb();

        const result = await db
            .insert(schema.users)
            .values({
                id: user.id,
                email: user.email,
                name: user.name,
                passwordHash: user.passwordHash,
                role: user.role,
                workspaceId: user.workspaceId,
                permissions: user.permissions,
                voiceId: user.voiceId,
                createdBy: user.createdBy,
            })
            .onConflictDoUpdate({
                target: schema.users.id,
                set: {
                    email: user.email,
                    name: user.name,
                    passwordHash: user.passwordHash,
                    role: user.role,
                    workspaceId: user.workspaceId,
                    permissions: user.permissions,
                    voiceId: user.voiceId,
                },
            })
            .returning();

        return this.mapToEntity(result[0]);
    }

    async updateLastActive(id: string): Promise<void> {
        const db = getDb();
        await db
            .update(schema.users)
            .set({ lastActiveAt: new Date() })
            .where(eq(schema.users.id, id));
    }

    async delete(id: string): Promise<boolean> {
        const db = getDb();
        const result = await db
            .delete(schema.users)
            .where(eq(schema.users.id, id))
            .returning({ id: schema.users.id });
        return result.length > 0;
    }

    private mapToEntity(row: typeof schema.users.$inferSelect): UserEntity {
        return {
            id: row.id,
            email: row.email,
            name: row.name,
            passwordHash: row.passwordHash,
            role: row.role as 'OVERLORD' | 'ADMIN' | 'LORD',
            workspaceId: row.workspaceId,
            permissions: row.permissions as Record<string, unknown> | null,
            voiceId: row.voiceId,
            createdBy: row.createdBy,
            createdAt: row.createdAt,
            lastActiveAt: row.lastActiveAt,
        };
    }
}
