module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  
  // TypeScript transformation
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  
  // Project-specific configurations for different test types
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      testTimeout: 30000,
    },
    {
      displayName: 'acceptance',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/acceptance/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      testTimeout: 60000,
      slowTestThreshold: 10000,
    }
  ]
} 