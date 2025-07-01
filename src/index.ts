import dotenv from 'dotenv'
import FeedGenerator from './server'
import { createDatabaseConfigFromEnv, validateDatabaseConfig } from './db'

/**
 * Main application entry point
 * Initializes the feed generator server with configuration from environment variables
 */
const run = async (): Promise<void> => {
  try {
    // Load environment variables
    dotenv.config()
    
    // Create database configuration from environment
    const databaseConfig = createDatabaseConfigFromEnv()
    validateDatabaseConfig(databaseConfig)
    
    // Extract configuration from environment with defaults
    const hostname = maybeStr(process.env.FEEDGEN_HOSTNAME) ?? 'example.com'
    const serviceDid = maybeStr(process.env.FEEDGEN_SERVICE_DID) ?? `did:web:${hostname}`
    
    // Create and configure the feed generator server
    const server = FeedGenerator.create({
      port: maybeInt(process.env.FEEDGEN_PORT) ?? 3000,
      listenhost: maybeStr(process.env.FEEDGEN_LISTENHOST) ?? 'localhost',
      database: databaseConfig,
      // Backward compatibility - use SQLite location if new config not available
      sqliteLocation: maybeStr(process.env.FEEDGEN_SQLITE_LOCATION) ?? databaseConfig.sqlite?.location ?? ':memory:',
      subscriptionEndpoint: maybeStr(process.env.FEEDGEN_SUBSCRIPTION_ENDPOINT) ?? 'wss://bsky.network',
      publisherDid: maybeStr(process.env.FEEDGEN_PUBLISHER_DID) ?? 'did:example:alice',
      subscriptionReconnectDelay: maybeInt(process.env.FEEDGEN_SUBSCRIPTION_RECONNECT_DELAY) ?? 3000,
      hostname,
      serviceDid,
    })
    
    // Start the server
    await server.start()
    
    console.log(
      `🤖 Feed generator running at http://${server.cfg.listenhost}:${server.cfg.port}`
    )
    console.log(`📡 Service DID: ${server.cfg.serviceDid}`)
    console.log(`🏠 Hostname: ${server.cfg.hostname}`)
    console.log(`💾 Database: ${databaseConfig.type}`)
    
  } catch (error) {
    console.error('❌ Failed to start feed generator:', error)
    process.exit(1)
  }
}

/**
 * Safely extracts a string value from environment variable
 * @param val - Environment variable value
 * @returns String value or undefined
 */
const maybeStr = (val?: string): string | undefined => {
  if (!val) return undefined
  return val
}

/**
 * Safely extracts an integer value from environment variable
 * @param val - Environment variable value
 * @returns Integer value or undefined
 */
const maybeInt = (val?: string): number | undefined => {
  if (!val) return undefined
  const int = parseInt(val, 10)
  if (isNaN(int)) return undefined
  return int
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the application
run().catch((error) => {
  console.error('❌ Application startup failed:', error)
  process.exit(1)
})