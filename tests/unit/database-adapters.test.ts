import { DatabaseConfig } from '../../src/config'
import { createDatabaseAdapter, validateDatabaseConfig, createDatabaseConfigFromEnv } from '../../src/db'
import { PostRecord } from '../../src/db/interfaces'

describe('Database Adapters', () => {
  describe('SQLite Adapter', () => {
    const sqliteConfig: DatabaseConfig = {
      type: 'sqlite',
      sqlite: {
        location: ':memory:',
      },
    }

    let adapter: any

    beforeEach(async () => {
      adapter = await createDatabaseAdapter(sqliteConfig)
    })

    afterEach(async () => {
      if (adapter) {
        await adapter.disconnect()
      }
    })

    it('should connect and migrate successfully', async () => {
      expect(adapter).toBeDefined()
      const isHealthy = await adapter.healthCheck()
      expect(isHealthy).toBe(true)
    })

    it('should create and retrieve posts', async () => {
      const postData: Omit<PostRecord, 'id'> = {
        uri: 'at://did:example:alice/app.bsky.feed.post/123',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        authorDid: 'did:example:alice',
        recordJson: '{"text":"Hello World"}',
        indexedAt: new Date(),
      }

      const createdPost = await adapter.posts.create(postData)
      expect(createdPost.uri).toBe(postData.uri)
      expect(createdPost.id).toBeDefined()

      const foundPost = await adapter.posts.findByUri(postData.uri)
      expect(foundPost).toBeDefined()
      expect(foundPost!.uri).toBe(postData.uri)
      expect(foundPost!.authorDid).toBe(postData.authorDid)
    })

    it('should find posts by author', async () => {
      const authorDid = 'did:example:alice'
      const posts = [
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/1',
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          authorDid,
          recordJson: '{"text":"Post 1"}',
          indexedAt: new Date(),
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/2',
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          authorDid,
          recordJson: '{"text":"Post 2"}',
          indexedAt: new Date(),
        },
      ]

      for (const post of posts) {
        await adapter.posts.create(post)
      }

      const foundPosts = await adapter.posts.findMany({ authorDid, limit: 10 })
      expect(foundPosts).toHaveLength(2)
      expect(foundPosts.every((p: any) => p.authorDid === authorDid)).toBe(true)
    })

    it('should delete posts', async () => {
      const postData: Omit<PostRecord, 'id'> = {
        uri: 'at://did:example:alice/app.bsky.feed.post/delete-test',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        authorDid: 'did:example:alice',
        recordJson: '{"text":"To be deleted"}',
        indexedAt: new Date(),
      }

      await adapter.posts.create(postData)
      const deleted = await adapter.posts.deleteByUri(postData.uri)
      expect(deleted).toBe(true)

      const foundPost = await adapter.posts.findByUri(postData.uri)
      expect(foundPost).toBeNull()
    })

    it('should manage subscription state', async () => {
      const service = 'test-service'
      const cursor = 12345

      await adapter.subscriptionState.update(service, cursor)
      const state = await adapter.subscriptionState.get(service)
      
      expect(state).toBeDefined()
      expect(state!.service).toBe(service)
      expect(state!.cursor).toBe(cursor)

      // Update cursor
      const newCursor = 54321
      await adapter.subscriptionState.update(service, newCursor)
      const updatedState = await adapter.subscriptionState.get(service)
      expect(updatedState!.cursor).toBe(newCursor)
    })

    it('should get algorithm feed', async () => {
      const posts = [
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/feed1',
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          authorDid: 'did:example:alice',
          recordJson: '{"text":"Feed post 1"}',
          indexedAt: new Date(Date.now() - 1000),
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/feed2',
          cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          authorDid: 'did:example:alice',
          recordJson: '{"text":"Feed post 2"}',
          indexedAt: new Date(),
        },
      ]

      for (const post of posts) {
        await adapter.posts.create(post)
      }

      const feed = await adapter.posts.getAlgorithmFeed('test-algo', 10)
      expect(feed.posts).toHaveLength(2)
      expect(feed.cursor).toBeDefined()
    })
  })

  describe('Configuration Validation', () => {
    it('should validate SQLite configuration', () => {
      const validConfig: DatabaseConfig = {
        type: 'sqlite',
        sqlite: { location: ':memory:' },
      }

      expect(() => validateDatabaseConfig(validConfig)).not.toThrow()

      const invalidConfig: DatabaseConfig = {
        type: 'sqlite',
        // Missing sqlite config
      } as any

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow('SQLite location is required')
    })

    it('should validate PostgreSQL configuration', () => {
      const validConfig: DatabaseConfig = {
        type: 'postgresql',
        postgresql: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        },
      }

      expect(() => validateDatabaseConfig(validConfig)).not.toThrow()

      const invalidConfig: DatabaseConfig = {
        type: 'postgresql',
        postgresql: {
          host: 'localhost',
          // Missing required fields
        } as any,
      }

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow()
    })

    it('should validate MongoDB configuration', () => {
      const validConfig: DatabaseConfig = {
        type: 'mongodb',
        mongodb: {
          uri: 'mongodb://localhost:27017',
          database: 'test',
        },
      }

      expect(() => validateDatabaseConfig(validConfig)).not.toThrow()

      const invalidConfig: DatabaseConfig = {
        type: 'mongodb',
        mongodb: {
          // Missing required fields
        } as any,
      }

      expect(() => validateDatabaseConfig(invalidConfig)).toThrow()
    })
  })

  describe('Environment Configuration', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should create SQLite config from environment', () => {
      process.env.DATABASE_TYPE = 'sqlite'
      process.env.SQLITE_LOCATION = './test.db'

      const config = createDatabaseConfigFromEnv()
      expect(config.type).toBe('sqlite')
      expect(config.sqlite?.location).toBe('./test.db')
    })

    it('should create PostgreSQL config from environment', () => {
      process.env.DATABASE_TYPE = 'postgresql'
      process.env.POSTGRES_HOST = 'db.example.com'
      process.env.POSTGRES_PORT = '5432'
      process.env.POSTGRES_DATABASE = 'feedgen'
      process.env.POSTGRES_USERNAME = 'dbuser'
      process.env.POSTGRES_PASSWORD = 'secret'
      process.env.POSTGRES_SSL = 'true'

      const config = createDatabaseConfigFromEnv()
      expect(config.type).toBe('postgresql')
      expect(config.postgresql?.host).toBe('db.example.com')
      expect(config.postgresql?.port).toBe(5432)
      expect(config.postgresql?.ssl).toBe(true)
    })

    it('should create MongoDB config from environment', () => {
      process.env.DATABASE_TYPE = 'mongodb'
      process.env.MONGODB_URI = 'mongodb://mongo.example.com:27017'
      process.env.MONGODB_DATABASE = 'feedgen'
      process.env.MONGODB_MAX_POOL_SIZE = '20'

      const config = createDatabaseConfigFromEnv()
      expect(config.type).toBe('mongodb')
      expect(config.mongodb?.uri).toBe('mongodb://mongo.example.com:27017')
      expect(config.mongodb?.database).toBe('feedgen')
      expect(config.mongodb?.options?.maxPoolSize).toBe(20)
    })

    it('should default to SQLite when no DATABASE_TYPE is set', () => {
      delete process.env.DATABASE_TYPE

      const config = createDatabaseConfigFromEnv()
      expect(config.type).toBe('sqlite')
      expect(config.sqlite?.location).toBe(':memory:')
    })
  })

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      const invalidConfig: DatabaseConfig = {
        type: 'sqlite',
        sqlite: {
          location: '/invalid/path/that/does/not/exist/db.sqlite',
        },
      }

      await expect(createDatabaseAdapter(invalidConfig)).rejects.toThrow()
    })

    it('should handle unsupported database types', async () => {
      const unsupportedConfig = {
        type: 'unsupported',
      } as any

      await expect(createDatabaseAdapter(unsupportedConfig)).rejects.toThrow('Unsupported database type')
    })
  })
})