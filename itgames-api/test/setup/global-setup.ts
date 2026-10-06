import { execSync } from 'child_process';
import { TEST_DATABASE_URL } from './test-env';

export default async function globalSetup() {
  if (!TEST_DATABASE_URL.includes('itgames_test')) {
    throw new Error('A URL de teste deve apontar para o banco itgames_test');
  }
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
