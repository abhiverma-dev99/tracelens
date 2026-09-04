// src/lib/prisma.ts
import 'dotenv/config';
import { PrismaClient } from '../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL as string
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });