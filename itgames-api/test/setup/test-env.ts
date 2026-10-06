import { join } from 'path';
import { tmpdir } from 'os';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://itgames_user:itgames_password@localhost:5433/itgames_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DIRECT_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'test-secret-only-for-e2e';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.UPLOADS_DIR = join(tmpdir(), 'itgames-test-uploads');
