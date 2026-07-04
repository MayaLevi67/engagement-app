import { config } from 'dotenv';
import { execSync } from 'node:child_process';

// Load .env.test locally; in CI, DATABASE_URL is already set and wins
// (dotenv does not override existing process.env values).
config({ path: '.env.test', quiet: true });

export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}
