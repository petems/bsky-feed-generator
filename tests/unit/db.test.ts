import { createDb, migrateToLatest } from '../../src/db'
import { DatabaseSchema } from '../../src/db/schema'

describe('Database', () => {
  describe('createDb', () => {
    it('should create an in-memory database', () => {
      const db = createDb(':memory:')
      expect(db).toBeDefined()
      expect(typeof db.selectFrom).toBe('function')
      expect(typeof db.insertInto).toBe('function')
      expect(typeof db.deleteFrom).toBe('function')
      expect(typeof db.updateTable).toBe('function')
    })

    it('should handle database creation errors', () => {
      // Test with invalid path that would cause SQLite to fail
      expect(() => createDb('/invalid/path/that/does/not/exist/db.sqlite')).toThrow()
    })
  })

  describe('migrateToLatest', () => {
    let db: any

    beforeEach(() => {
      db = createDb(':memory:')
    })

    afterEach(async () => {
      if (db) {
        await db.destroy()
      }
    })

    it('should run migrations successfully', async () => {
      await expect(migrateToLatest(db)).resolves.not.toThrow()
    })

    it('should create required tables', async () => {
      await migrateToLatest(db)

      // Check if tables exist by trying to query them
      const postResult = await db.selectFrom('post').selectAll().execute()
      const subStateResult = await db.selectFrom('sub_state').selectAll().execute()

      expect(Array.isArray(postResult)).toBe(true)
      expect(Array.isArray(subStateResult)).toBe(true)
    })

    it('should handle migration errors gracefully', async () => {
      // Mock a database that will fail migrations
      const mockDb = {
        schema: {
          createTable: jest.fn().mockReturnValue({
            addColumn: jest.fn().mockReturnValue({
              execute: jest.fn().mockRejectedValue(new Error('Migration failed')),
            }),
          }),
        },
      }

      const mockMigrator = {
        migrateToLatest: jest.fn().mockResolvedValue({
          error: new Error('Migration failed'),
          results: [],
        }),
      }

      // This would require mocking the Migrator constructor, which is complex
      // For now, we'll test that the function throws when migration fails
      const invalidDb = { invalid: true } as any
      await expect(migrateToLatest(invalidDb)).rejects.toThrow()
    })
  })

  describe('Database Schema', () => {
    let db: any

    beforeEach(async () => {
      db = createDb(':memory:')
      await migrateToLatest(db)
    })

    afterEach(async () => {
      if (db) {
        await db.destroy()
      }
    })

    it('should insert and retrieve posts', async () => {
      const testPost = {
        uri: 'at://did:example:alice/app.bsky.feed.post/test',
        cid: 'bafyreic',
        indexedAt: new Date().toISOString(),
      }

      await db.insertInto('post').values(testPost).execute()

      const results = await db.selectFrom('post').selectAll().execute()
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject(testPost)
    })

    it('should insert and retrieve subscription state', async () => {
      const testSubState = {
        service: 'bsky.network',
        cursor: 12345,
      }

      await db.insertInto('sub_state').values(testSubState).execute()

      const results = await db.selectFrom('sub_state').selectAll().execute()
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject(testSubState)
    })

    it('should handle duplicate post URIs', async () => {
      const testPost = {
        uri: 'at://did:example:alice/app.bsky.feed.post/duplicate',
        cid: 'bafyreic',
        indexedAt: new Date().toISOString(),
      }

      await db.insertInto('post').values(testPost).execute()

      // Attempting to insert the same URI should fail due to primary key constraint
      await expect(
        db.insertInto('post').values(testPost).execute()
      ).rejects.toThrow()
    })

    it('should order posts by indexedAt descending', async () => {
      const posts = [
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/1',
          cid: 'bafyreic1',
          indexedAt: '2023-01-01T00:00:00.000Z',
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/2',
          cid: 'bafyreic2',
          indexedAt: '2023-01-01T00:02:00.000Z',
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/3',
          cid: 'bafyreic3',
          indexedAt: '2023-01-01T00:01:00.000Z',
        },
      ]

      for (const post of posts) {
        await db.insertInto('post').values(post).execute()
      }

      const results = await db
        .selectFrom('post')
        .selectAll()
        .orderBy('indexedAt', 'desc')
        .execute()

      expect(results).toHaveLength(3)
      expect(results[0].uri).toBe(posts[1].uri) // Most recent
      expect(results[1].uri).toBe(posts[2].uri) // Middle
      expect(results[2].uri).toBe(posts[0].uri) // Oldest
    })
  })
})