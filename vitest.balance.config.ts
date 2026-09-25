// SPDX-License-Identifier: GPL-3.0-only
// The slow combat balance tests (slice 2 spec §10.4): npm run test:balance.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/balance/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
