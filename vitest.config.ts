import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
    },
    globals: true,
    coverage: { reporter: ['text', 'html'] },
  },
});
