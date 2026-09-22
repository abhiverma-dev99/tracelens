import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const tables = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`);

const userCols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'User'
  ORDER BY ordinal_position
`);

let migrations = [];
try {
  const result = await pool.query(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY finished_at
  `);
  migrations = result.rows;
} catch (error) {
  migrations = [{ error: error.message }];
}

const counts = await pool.query(`
  SELECT
    (SELECT count(*)::int FROM "User") AS users,
    (SELECT count(*)::int FROM "OtpVerification") AS otps,
    (SELECT count(*)::int FROM "RefreshToken") AS refresh_tokens
`);

const latestUsers = await pool.query(`
  SELECT "emailVerified", "createdAt"
  FROM "User"
  ORDER BY "createdAt" DESC
  LIMIT 5
`);

console.log(
  JSON.stringify(
    {
      tables: tables.rows.map((row) => row.table_name),
      userColumns: userCols.rows,
      migrations,
      counts: counts.rows[0],
      latestUsers: latestUsers.rows,
    },
    null,
    2,
  ),
);

await pool.end();
