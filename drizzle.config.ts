import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config();

export default defineConfig({
    schema: './src/infrastructure/database/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'overlord_db',
        user: process.env.DB_USER || 'overlord',
        password: process.env.DB_PASSWORD || 'overlord_dev_password',
    },
    verbose: true,
    strict: true,
});
