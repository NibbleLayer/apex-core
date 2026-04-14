import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    include: ['test/**/*.test.ts'],
    exclude: ['test/unit/**/*.test.ts'],
  },
});
