import { vi } from 'vitest';

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.TRAPNZ_WFS_TOKEN = 'test-token-1b8a944b-14fe-4c06-b4fa-01b2bc3eebad';

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Global test utilities
global.testUtils = {
  mockTrapData: {
    id: 'TEST123',
    trapCode: 'TEST123',
    name: 'Test Trap',
    projectName: 'Test Project',
    isActive: true,
    efficiency: 15.5,
    totalCatches: 10,
    totalChecks: 65,
    lastUpdate: new Date().toISOString(),
    lastCatch: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    lineId: 'test-line',
    lineName: 'Test Line',
    coordinates: [-41.3321, 174.7682]
  },

  mockAlert: {
    level: 'critical',
    type: 'Test Alert',
    message: 'Test alert message',
    count: 1,
    action: 'Test action required'
  },

  createMockTraps: (count = 5) => {
    return Array(count).fill().map((_, i) => ({
      ...global.testUtils.mockTrapData,
      id: `TEST${i + 1}`,
      trapCode: `TEST${i + 1}`,
      efficiency: 10 + (i * 5),
      isActive: i % 2 === 0,
      lastCatch: i < 2 ? new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString() : null
    }));
  }
};

// Suppress specific console outputs during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Don't log expected test errors
  if (args[0] && args[0].includes && (
    args[0].includes('TRAPNZ_WFS_TOKEN') ||
    args[0].includes('Error generating') ||
    args[0].includes('Error fetching')
  )) {
    return;
  }
  originalConsoleError(...args);
};
