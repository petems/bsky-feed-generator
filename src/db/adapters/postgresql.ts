import { Pool, PoolClient } from 'pg'
import { DatabaseConfig } from '../../config'
import { DatabaseAdapter, FeedDatabase, PostRecord, SubscriptionState } from '../interfaces'
import { randomUUID } from 'crypto'

/**
 * PostgreSQL database adapter implementation
 */
export class PostgreSQLAdapter implements DatabaseAdapter, FeedDatabase {
  private pool: Pool | null = null
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    try {
      if (!this.config.postgresql) {
        throw new Error('PostgreSQL configuration is required')
      }

      const pgConfig = this.config.postgresql
      this.pool = new Pool({
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.username,
        password: pgConfig.password,
        ssl: pgConfig.ssl,
        max: pgConfig.poolSize || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      })

      // Test the connection
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()

      console.log(`✅ Connected to PostgreSQL database at ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`)
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL database:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end()
        this.pool = null
      }
      console.log('✅ Disconnected from PostgreSQL database')
    } catch (error) {
      console.error('❌ Failed to disconnect from PostgreSQL database:', error)
      throw error
    }
  }

  async migrate(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not connected')
    }

    try {
      console.log('🔄 Running PostgreSQL database migrations...')
      
      // Create migration tracking table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS kysely_migration (
          name VARCHAR(255) PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Check which migrations have been applied
      const { rows: appliedMigrations } = await this.pool.query(
        'SELECT name FROM kysely_migration ORDER BY name'
      )
      const appliedNames = new Set(appliedMigrations.map(row => row.name))

      // Migration 001: Create initial tables
      if (!appliedNames.has('001')) {
        await this.pool.query(`
          CREATE TABLE post (
            uri VARCHAR(255) PRIMARY KEY,
            cid VARCHAR(255) NOT NULL,
            "indexedAt" VARCHAR(255) NOT NULL
          )
        `)
        
        await this.pool.query(`
          CREATE TABLE sub_state (
            service VARCHAR(255) PRIMARY KEY,
            cursor INTEGER NOT NULL
          )
        `)
        
        await this.pool.query(`
          CREATE INDEX post_indexed_at_idx ON post ("indexedAt")
        `)
        
        await this.pool.query(`
          INSERT INTO kysely_migration (name) VALUES ('001')
        `)
        
        console.log('  - 001: Initial schema created')
      }

      // Migration 002: Add additional post fields
      if (!appliedNames.has('002')) {
        await this.pool.query(`
          ALTER TABLE post 
          ADD COLUMN "replyParent" VARCHAR(255),
          ADD COLUMN "replyRoot" VARCHAR(255),
          ADD COLUMN "authorDid" VARCHAR(255) NOT NULL DEFAULT '',
          ADD COLUMN "recordJson" TEXT NOT NULL DEFAULT '{}'
        `)
        
        await this.pool.query(`
          CREATE INDEX post_author_did_idx ON post ("authorDid")
        `)
        
        await this.pool.query(`
          INSERT INTO kysely_migration (name) VALUES ('002')
        `)
        
        console.log('  - 002: Extended post schema')
      }

      console.log('✅ PostgreSQL database migrations completed')
    } catch (error) {
      console.error('❌ PostgreSQL database migration failed:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false
      }
      
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch (error) {
      console.error('❌ PostgreSQL health check failed:', error)
      return false
    }
  }

  getDatabase(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected')
    }
    return this.pool
  }

  // FeedDatabase implementation
  posts = {
    create: async (post: Omit<PostRecord, 'id'>): Promise<PostRecord> => {
      if (!this.pool) {
        throw new Error('Database not connected')
      }

      const id = randomUUID()
      const newPost = { id, ...post }

      await this.pool.query(
        `INSERT INTO post (uri, cid, "replyParent", "replyRoot", "authorDid", "recordJson", "indexedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newPost.uri,
          newPost.cid,
          newPost.replyParent || null,
          newPost.replyRoot || null,
          newPost.authorDid,
          newPost.recordJson,
          newPost.indexedAt.toISOString(),
        ]
      )

      return newPost
    },

    findMany: async (criteria: {
      authorDid?: string
      limit?: number
      cursor?: string
    }): Promise<PostRecord[]> => {
      if (!this.pool) {
        throw new Error('Database not connected')
      }

      let query = `SELECT * FROM post WHERE 1=1`
      const params: any[] = []
      let paramIndex = 1

      if (criteria.authorDid) {
        query += ` AND "authorDid" = $${paramIndex++}`
        params.push(criteria.authorDid)
      }

      if (criteria.cursor) {
        query += ` AND "indexedAt" < $${paramIndex++}`
        params.push(criteria.cursor)
      }

      query += ` ORDER BY "indexedAt" DESC`

      if (criteria.limit) {
        query += ` LIMIT $${paramIndex++}`
        params.push(criteria.limit)
      }

      const { rows } = await this.pool.query(query, params)
      return rows.map(row => ({
        id: row.uri,
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
      if (!this.pool) {
        throw new Error('Database not connected')
      }

      const { rows } = await this.pool.query(
        'SELECT * FROM post WHERE uri = $1',
        [uri]
      )

      if (rows.length === 0) {
        return null
      }

      const row = rows[0]
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
      if (!this.pool) {
        throw new Error('Database not connected')
      }

      const { rowCount } = await this.pool.query(
        'DELETE FROM post WHERE uri = $1',
        [uri]
      )

      return (rowCount || 0) > 0
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
      if (!this.pool) {
        throw new Error('Database not connected')
      }

      const { rows } = await this.pool.query(
        'SELECT * FROM sub_state WHERE service = $1',
        [service]
      )

      if (rows.length === 0) {
        return null
      }

      const row = rows[0]
      return {
        service: row.service,
        cursor: row.cursor,
      }
    },

    update: async (service: string, cursor: number): Promise<void> => {
      if (!this.pool) {
        throw new Error('Database not connected')
      }

      await this.pool.query(
        `INSERT INTO sub_state (service, cursor) VALUES ($1, $2)
         ON CONFLICT (service) DO UPDATE SET cursor = EXCLUDED.cursor`,
        [service, cursor]
      )
    },
  }
}