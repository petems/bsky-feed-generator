import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { DatabaseSchema } from './schema'
import { migrationProvider } from './migrations'

// Export new adapter system
export * from './interfaces'
export * from './factory'
export * from './adapters/sqlite'

/**
 * Database type alias for better type inference
 */
export type Database = Kysely<DatabaseSchema>

/**
 * @deprecated Use createDatabaseAdapter instead
 * Creates a new database instance with SQLite backend
 * @param location - Database file path or ':memory:' for in-memory database
 * @returns Configured Kysely database instance
 */
export const createDb = (location: string): Database => {
  try {
    const sqliteDb = new SqliteDb(location)
    
    // Configure SQLite for better performance and reliability
    sqliteDb.pragma('journal_mode = WAL')
    sqliteDb.pragma('synchronous = NORMAL')
    sqliteDb.pragma('cache_size = 10000')
    sqliteDb.pragma('temp_store = memory')
    
    return new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: sqliteDb,
      }),
    })
  } catch (error) {
    console.error(`❌ Failed to create database at ${location}:`, error)
    throw error
  }
}

/**
 * @deprecated Use adapter.migrate() instead
 * Runs all pending migrations to bring the database to the latest version
 * @param db - Database instance to migrate
 * @throws Error if migration fails
 */
export const migrateToLatest = async (db: Database): Promise<void> => {
  try {
    // Validate that we have a proper Kysely database instance
    if (!db || typeof db.selectFrom !== 'function') {
      throw new Error('Invalid database instance provided')
    }
    
    console.log('🔄 Running database migrations...')
    const migrator = new Migrator({ db, provider: migrationProvider })
    const { error, results } = await migrator.migrateToLatest()
    
    if (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
    
    if (results && results.length > 0) {
      console.log(`✅ Applied ${results.length} migration(s)`)
      results.forEach((result) => {
        console.log(`  - ${result.migrationName}: ${result.status}`)
      })
    } else {
      console.log('✅ Database is up to date')
    }
  } catch (error) {
    console.error('❌ Database migration failed:', error)
    throw error
  }
}