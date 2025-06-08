import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    testTimeout: 30000, // 30 seconds for integration tests
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'public/',
        '*.config.js'
      ]
    },
    include: ['test/**/*.test.js'],
    exclude: ['node_modules/**', 'dist/**']
  },
  esbuild: {
    target: 'node18'
  }
});
