/**
 * Jest setup file for global test configuration
 */

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
}

// Set test timeout
jest.setTimeout(30000)

// Setup environment variables for tests
process.env.NODE_ENV = 'test'
process.env.FEEDGEN_HOSTNAME = 'test.example.com'
process.env.FEEDGEN_SERVICE_DID = 'did:web:test.example.com'
process.env.FEEDGEN_PUBLISHER_DID = 'did:example:test'
process.env.FEEDGEN_SQLITE_LOCATION = ':memory:'
process.env.FEEDGEN_SUBSCRIPTION_ENDPOINT = 'ws://localhost:8080'

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidAtUri(): R
      toBeValidDid(): R
    }
  }
}

// Export to make this a module
export {}

// Custom Jest matchers
expect.extend({
  toBeValidAtUri(received: string) {
    const atUriRegex = /^at:\/\/[a-zA-Z0-9:._-]+\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/
    const pass = atUriRegex.test(received)
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid AT-URI`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid AT-URI`,
        pass: false,
      }
    }
  },

  toBeValidDid(received: string) {
    const didRegex = /^did:(web|plc):[a-zA-Z0-9._:-]+$/
    const pass = didRegex.test(received)
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid DID`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid DID`,
        pass: false,
      }
    }
  },
})