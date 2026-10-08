import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit corre fuera de Next: hay que cargar .env.local a mano
config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
