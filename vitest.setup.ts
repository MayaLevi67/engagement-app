import { config } from 'dotenv';
config({ path: '.env.test', quiet: true });

import '@testing-library/jest-dom/vitest';
