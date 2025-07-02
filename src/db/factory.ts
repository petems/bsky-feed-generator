import { DatabaseConfig, DatabaseType } from '../config'
import { DatabaseAdapter, FeedDatabase, DatabaseFactory } from './interfaces'
import { SQLiteAdapter } from './adapters/sqlite'

/**
 * Database factory that creates the appropriate database adapter
 * based on the provided configuration
 */
export const createDatabaseAdapter: DatabaseFactory = async (
  config: DatabaseConfig
): Promise<DatabaseAdapter & FeedDatabase> => {
  let adapter: DatabaseAdapter & FeedDatabase

  switch (config.type) {
    case 'sqlite': {
      adapter = new SQLiteAdapter(config)
      break
    }
    
    case 'postgresql': {
      // Dynamic import to avoid loading pg if not needed
      const { PostgreSQLAdapter } = await import('./adapters/postgresql')
      adapter = new PostgreSQLAdapter(config)
      break
    }
    
    case 'mongodb': {
      // Dynamic import to avoid loading mongodb if not needed
      const { MongoDBAdapter } = await import('./adapters/mongodb')
      adapter = new MongoDBAdapter(config)
      break
    }
    
    default:
      throw new Error(`Unsupported database type: ${(config as any).type}`)
  }

  // Initialize the connection and run migrations
  await adapter.connect()
  await adapter.migrate()

  return adapter
}

/**
 * Helper function to create database configuration from environment variables
 */
export const createDatabaseConfigFromEnv = (): DatabaseConfig => {
  const dbType = (process.env.DATABASE_TYPE || 'sqlite') as DatabaseType
  
  switch (dbType) {
    case 'sqlite':
      return {
        type: 'sqlite',
        sqlite: {
          location: process.env.SQLITE_LOCATION || ':memory:',
        },
      }
    
    case 'postgresql':
      return {
        type: 'postgresql',
        postgresql: {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
          database: process.env.POSTGRES_DATABASE || 'feedgen',
          username: process.env.POSTGRES_USERNAME || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
          ssl: process.env.POSTGRES_SSL === 'true',
          poolSize: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10),
        },
      }
    
    case 'mongodb':
      return {
        type: 'mongodb',
        mongodb: {
          uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
          database: process.env.MONGODB_DATABASE || 'feedgen',
          options: {
            maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
            serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '5000', 10),
            socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000', 10),
          },
        },
      }
    
    default:
      throw new Error(`Unsupported database type: ${dbType}`)
  }
}

/**
 * Validate database configuration
 */
export const validateDatabaseConfig = (config: DatabaseConfig): void => {
  switch (config.type) {
    case 'sqlite':
      if (!config.sqlite?.location) {
        throw new Error('SQLite location is required')
      }
      break
    
    case 'postgresql': {
      const pg = config.postgresql
      if (!pg?.host || !pg?.database || !pg?.username) {
        throw new Error('PostgreSQL host, database, and username are required')
      }
      break
    }
    
    case 'mongodb': {
      const mongo = config.mongodb
      if (!mongo?.uri || !mongo?.database) {
        throw new Error('MongoDB URI and database name are required')
      }
      break
    }
    
    default:
      throw new Error(`Unsupported database type: ${(config as any).type}`)
  }
}