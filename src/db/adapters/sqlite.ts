import SqliteDb from 'better-sqlite3'
import { Kysely, SqliteDialect, Migrator } from 'kysely'
import { DatabaseConfig } from '../../config'
import { DatabaseAdapter, FeedDatabase, PostRecord, SubscriptionState } from '../interfaces'
import { DatabaseSchema } from '../schema'
import { migrationProvider } from '../migrations'
import { randomUUID } from 'crypto'

/**
 * SQLite database adapter implementation
 */
export class SQLiteAdapter implements DatabaseAdapter, FeedDatabase {
  private db: Kysely<DatabaseSchema> | null = null
  private sqliteDb: SqliteDb.Database | null = null
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    try {
      if (!this.config.sqlite) {
        throw new Error('SQLite configuration is required')
      }

      const location = this.config.sqlite.location
      this.sqliteDb = new SqliteDb(location)
      
      // Configure SQLite for better performance and reliability
      this.sqliteDb.pragma('journal_mode = WAL')
      this.sqliteDb.pragma('synchronous = NORMAL')
      this.sqliteDb.pragma('cache_size = 10000')
      this.sqliteDb.pragma('temp_store = memory')
      
      this.db = new Kysely<DatabaseSchema>({
        dialect: new SqliteDialect({
          database: this.sqliteDb,
        }),
      })

      console.log(`✅ Connected to SQLite database at ${location}`)
    } catch (error) {
      console.error('❌ Failed to connect to SQLite database:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.db) {
        await this.db.destroy()
        this.db = null
      }
      if (this.sqliteDb) {
        this.sqliteDb.close()
        this.sqliteDb = null
      }
      console.log('✅ Disconnected from SQLite database')
    } catch (error) {
      console.error('❌ Failed to disconnect from SQLite database:', error)
      throw error
    }
  }

  async migrate(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected')
    }

    try {
      console.log('🔄 Running SQLite database migrations...')
      const migrator = new Migrator({ db: this.db, provider: migrationProvider })
      const { error, results } = await migrator.migrateToLatest()
      
      if (error) {
        console.error('❌ SQLite migration failed:', error)
        throw error
      }
      
      if (results && results.length > 0) {
        console.log(`✅ Applied ${results.length} SQLite migration(s)`)
        results.forEach((result) => {
          console.log(`  - ${result.migrationName}: ${result.status}`)
        })
      } else {
        console.log('✅ SQLite database is up to date')
      }
    } catch (error) {
      console.error('❌ SQLite database migration failed:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) {
        return false
      }
      
      // Simple query to check database connectivity
      await this.db.selectFrom('post').select('uri').limit(1).execute()
      return true
    } catch (error) {
      console.error('❌ SQLite health check failed:', error)
      return false
    }
  }

  getDatabase(): Kysely<DatabaseSchema> {
    if (!this.db) {
      throw new Error('Database not connected')
    }
    return this.db
  }

  // FeedDatabase implementation
  posts = {
    create: async (post: Omit<PostRecord, 'id'>): Promise<PostRecord> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      const id = randomUUID()
      const newPost = { id, ...post }

      await this.db
        .insertInto('post')
        .values({
          uri: newPost.uri,
          cid: newPost.cid,
          replyParent: newPost.replyParent || null,
          replyRoot: newPost.replyRoot || null,
          authorDid: newPost.authorDid,
          recordJson: newPost.recordJson,
          indexedAt: newPost.indexedAt.toISOString(),
        })
        .execute()

      return newPost
    },

    findMany: async (criteria: {
      authorDid?: string
      limit?: number
      cursor?: string
    }): Promise<PostRecord[]> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      let query = this.db.selectFrom('post')
        .selectAll()
        .orderBy('indexedAt', 'desc')

      if (criteria.authorDid) {
        query = query.where('authorDid', '=', criteria.authorDid)
      }

      if (criteria.cursor) {
        query = query.where('indexedAt', '<', criteria.cursor)
      }

      if (criteria.limit) {
        query = query.limit(criteria.limit)
      }

      const rows = await query.execute()
      return rows.map(row => ({
        id: row.uri, // Using URI as ID for compatibility
        uri: row.uri,
        cid: row.cid,
        replyParent: row.replyParent || undefined,
        replyRoot: row.replyRoot || undefined,
        authorDid: row.authorDid,
        recordJson: row.recordJson,
        indexedAt: new Date(row.indexedAt),
      }))
    },

    findByUri: async (uri: string): Promise<PostRecord | null> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      const row = await this.db
        .selectFrom('post')
        .selectAll()
        .where('uri', '=', uri)
        .executeTakeFirst()

      if (!row) {
        return null
      }

      return {
        id: row.uri,
        uri: row.uri,
        cid: row.cid,
        replyParent: row.replyParent || undefined,
        replyRoot: row.replyRoot || undefined,
        authorDid: row.authorDid,
        recordJson: row.recordJson,
        indexedAt: new Date(row.indexedAt),
      }
    },

    deleteByUri: async (uri: string): Promise<boolean> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      const result = await this.db
        .deleteFrom('post')
        .where('uri', '=', uri)
        .execute()

      return result.length > 0 && Number(result[0].numDeletedRows) > 0
    },

    getAlgorithmFeed: async (
      algorithm: string,
      limit: number,
      cursor?: string
    ): Promise<{ posts: PostRecord[]; cursor?: string }> => {
      // For now, return all posts (algorithm-specific logic can be added later)
      const posts = await this.posts.findMany({ limit, cursor })
      const newCursor = posts.length > 0 ? posts[posts.length - 1].indexedAt.toISOString() : undefined
      
      return { posts, cursor: newCursor }
    },
  }

  subscriptionState = {
    get: async (service: string): Promise<SubscriptionState | null> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      const row = await this.db
        .selectFrom('sub_state')
        .selectAll()
        .where('service', '=', service)
        .executeTakeFirst()

      if (!row) {
        return null
      }

      return {
        service: row.service,
        cursor: row.cursor,
      }
    },

    update: async (service: string, cursor: number): Promise<void> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      await this.db
        .insertInto('sub_state')
        .values({ service, cursor })
        .onConflict((oc) => oc.column('service').doUpdateSet({ cursor }))
        .execute()
    },
  }
}