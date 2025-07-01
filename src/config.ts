import { Database } from './db'
import { DatabaseAdapter, FeedDatabase } from './db/interfaces'
import { DidResolver } from '@atproto/identity'

/**
 * Supported database backends
 */
export type DatabaseType = 'sqlite' | 'postgresql' | 'mongodb'

/**
 * Database connection configuration
 */
export type DatabaseConfig = {
  /** Database backend type */
  type: DatabaseType
  /** SQLite specific configuration */
  sqlite?: {
    /** Database file path or ':memory:' for in-memory database */
    location: string
  }
  /** PostgreSQL specific configuration */
  postgresql?: {
    /** Database host */
    host: string
    /** Database port */
    port: number
    /** Database name */
    database: string
    /** Username */
    username: string
    /** Password */
    password: string
    /** SSL configuration */
    ssl?: boolean
    /** Connection pool size */
    poolSize?: number
  }
  /** MongoDB specific configuration */
  mongodb?: {
    /** MongoDB connection URI */
    uri: string
    /** Database name */
    database: string
    /** Connection options */
    options?: {
      /** Maximum pool size */
      maxPoolSize?: number
      /** Server selection timeout in ms */
      serverSelectionTimeoutMS?: number
      /** Socket timeout in ms */
      socketTimeoutMS?: number
    }
  }
}

/**
 * Application context containing shared dependencies
 */
export type AppContext = {
  /** Database instance for data persistence */
  db: Database
  /** Database adapter for multi-database support */
  dbAdapter?: DatabaseAdapter & FeedDatabase
  /** DID resolver for identity resolution */
  didResolver: DidResolver
  /** Application configuration */
  cfg: Config
}

/**
 * Application configuration interface
 */
export type Config = {
  /** Port number for the HTTP server */
  port: number
  /** Host address to bind the server to */
  listenhost: string
  /** Public hostname for the service */
  hostname: string
  /** Database configuration */
  database: DatabaseConfig
  /** @deprecated Use database.sqlite.location instead */
  sqliteLocation?: string
  /** WebSocket endpoint for firehose subscription */
  subscriptionEndpoint: string
  /** Service DID identifier */
  serviceDid: string
  /** Publisher DID identifier */
  publisherDid: string
  /** Delay between reconnection attempts in milliseconds */
  subscriptionReconnectDelay: number
}