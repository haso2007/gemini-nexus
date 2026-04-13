import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/test-dom.js'],
    include: ['./tests/**/*.test.js'],
  },
});
