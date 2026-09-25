// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The balance tests are slow; they run with npm run test:balance (slice 2 spec §10.4).
    exclude: ['tests/balance/**'],
    environment: 'node',
  },
});
