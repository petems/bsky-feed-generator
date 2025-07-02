import { DatabaseConfig } from '../../src/config'
import { createDatabaseAdapter } from '../../src/db'
import { PostRecord } from '../../src/db/interfaces'

// Test configuration
const MONGODB_CONFIG: DatabaseConfig = {
  type: 'mongodb',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://root:testpass@localhost:27017',
    database: process.env.MONGODB_DATABASE || 'feedgen_test',
    options: {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    },
  },
}

const POSTGRESQL_CONFIG: DatabaseConfig = {
  type: 'postgresql',
  postgresql: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'feedgen_test',
    username: process.env.POSTGRES_USERNAME || 'testuser',
    password: process.env.POSTGRES_PASSWORD || 'testpass',
    ssl: false,
    poolSize: 5,
  },
}

describe('Database Acceptance Tests', () => {
  // Test data
  const testPosts: Omit<PostRecord, 'id'>[] = [
    {
      uri: 'at://did:example:alice/app.bsky.feed.post/acceptance-1',
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      authorDid: 'did:example:alice',
      recordJson: JSON.stringify({ text: 'Acceptance test post 1', createdAt: new Date().toISOString() }),
      indexedAt: new Date(Date.now() - 3600000), // 1 hour ago
    },
    {
      uri: 'at://did:example:bob/app.bsky.feed.post/acceptance-2',
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      authorDid: 'did:example:bob',
      recordJson: JSON.stringify({ text: 'Acceptance test post 2', createdAt: new Date().toISOString() }),
      indexedAt: new Date(Date.now() - 1800000), // 30 minutes ago
    },
    {
      uri: 'at://did:example:alice/app.bsky.feed.post/acceptance-3',
      cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      authorDid: 'did:example:alice',
      recordJson: JSON.stringify({ text: 'Acceptance test post 3', createdAt: new Date().toISOString() }),
      indexedAt: new Date(),
      replyParent: 'at://did:example:bob/app.bsky.feed.post/acceptance-2',
      replyRoot: 'at://did:example:bob/app.bsky.feed.post/acceptance-2',
    },
  ]

  describe.each([
    ['MongoDB', MONGODB_CONFIG],
    ['PostgreSQL', POSTGRESQL_CONFIG],
  ])('%s Adapter Acceptance Tests', (adapterName, config) => {
    let adapter: any

    beforeAll(async () => {
      // Skip if running in unit test mode
      if (process.env.TEST_MODE === 'unit') {
        return
      }

      try {
        adapter = await createDatabaseAdapter(config)
        await adapter.migrate()
             } catch (error) {
         console.warn(`⚠️  Skipping ${adapterName} acceptance tests - database not available:`, (error as Error).message)
         adapter = null
       }
    }, 30000)

    afterAll(async () => {
      if (adapter) {
        await adapter.disconnect()
      }
    })

    beforeEach(async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} test - adapter not available`)
        return
      }

      // Clean up test data
      try {
        for (const post of testPosts) {
          await adapter.posts.deleteByUri(post.uri)
        }
             } catch {
         // Ignore cleanup errors
       }
    })

    it('should establish connection and pass health check', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} health check - adapter not available`)
        return
      }

      const isHealthy = await adapter.healthCheck()
      expect(isHealthy).toBe(true)
    })

    it('should create and retrieve posts correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} post creation test - adapter not available`)
        return
      }

             // Create posts
       const createdPosts: PostRecord[] = []
       for (const postData of testPosts) {
         const created = await adapter.posts.create(postData)
         createdPosts.push(created)
         expect(created.uri).toBe(postData.uri)
         expect(created.authorDid).toBe(postData.authorDid)
         expect(created.id).toBeDefined()
       }

       // Retrieve posts individually
       for (const post of createdPosts) {
         const found = await adapter.posts.findByUri(post.uri)
         expect(found).toBeDefined()
         expect(found!.uri).toBe(post.uri)
         expect(found!.authorDid).toBe(post.authorDid)
       }
    })

    it('should handle duplicate URI constraint', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} duplicate URI test - adapter not available`)
        return
      }

      const postData = testPosts[0]
      
      // Create first post
      await adapter.posts.create(postData)
      
      // Attempt to create duplicate
      await expect(adapter.posts.create(postData))
        .rejects
        .toThrow()
    })

    it('should find posts by author correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} find by author test - adapter not available`)
        return
      }

      // Create test posts
      for (const postData of testPosts) {
        await adapter.posts.create(postData)
      }

      // Find Alice's posts
      const alicePosts = await adapter.posts.findMany({ 
        authorDid: 'did:example:alice', 
        limit: 10 
      })
      
      expect(alicePosts).toHaveLength(2)
             expect(alicePosts.every((p: PostRecord) => p.authorDid === 'did:example:alice')).toBe(true)

      // Find Bob's posts
      const bobPosts = await adapter.posts.findMany({ 
        authorDid: 'did:example:bob', 
        limit: 10 
      })
      
      expect(bobPosts).toHaveLength(1)
      expect(bobPosts[0].authorDid).toBe('did:example:bob')
    })

    it('should implement pagination correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} pagination test - adapter not available`)
        return
      }

      // Create test posts
      for (const postData of testPosts) {
        await adapter.posts.create(postData)
      }

      // Get first page
      const firstPage = await adapter.posts.findMany({ limit: 2 })
      expect(firstPage).toHaveLength(2)

      // Get next page using cursor
      const oldestPost = firstPage[firstPage.length - 1]
      const secondPage = await adapter.posts.findMany({ 
        limit: 2, 
        cursor: oldestPost.indexedAt.toISOString() 
      })
      
      expect(secondPage).toHaveLength(1)
      expect(secondPage[0].indexedAt.getTime()).toBeLessThan(oldestPost.indexedAt.getTime())
    })

    it('should delete posts correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} delete test - adapter not available`)
        return
      }

      const postData = testPosts[0]
      
      // Create post
      await adapter.posts.create(postData)
      
      // Verify it exists
      const found = await adapter.posts.findByUri(postData.uri)
      expect(found).toBeDefined()
      
      // Delete it
      const deleted = await adapter.posts.deleteByUri(postData.uri)
      expect(deleted).toBe(true)
      
      // Verify it's gone
      const notFound = await adapter.posts.findByUri(postData.uri)
      expect(notFound).toBeNull()
    })

    it('should manage subscription state correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} subscription state test - adapter not available`)
        return
      }

      const service = `test-service-${Date.now()}`
      const cursor = 12345

      // Create subscription state
      await adapter.subscriptionState.update(service, cursor)
      
      // Retrieve it
      const state = await adapter.subscriptionState.get(service)
      expect(state).toBeDefined()
      expect(state!.service).toBe(service)
      expect(state!.cursor).toBe(cursor)

      // Update cursor
      const newCursor = 54321
      await adapter.subscriptionState.update(service, newCursor)
      
      // Verify update
      const updatedState = await adapter.subscriptionState.get(service)
      expect(updatedState!.cursor).toBe(newCursor)
    })

    it('should generate algorithm feeds correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} algorithm feed test - adapter not available`)
        return
      }

      // Create test posts
      for (const postData of testPosts) {
        await adapter.posts.create(postData)
      }

      // Get algorithm feed
      const feed = await adapter.posts.getAlgorithmFeed('test-algorithm', 10)
      
      expect(feed.posts).toHaveLength(3)
      expect(feed.cursor).toBeDefined()
      
      // Verify posts are ordered by indexedAt descending
      for (let i = 1; i < feed.posts.length; i++) {
        const current = new Date(feed.posts[i].indexedAt)
        const previous = new Date(feed.posts[i - 1].indexedAt)
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime())
      }
    })

    it('should handle reply relationships correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} reply relationships test - adapter not available`)
        return
      }

      // Create test posts
      for (const postData of testPosts) {
        await adapter.posts.create(postData)
      }

      // Find the reply post
      const replyPost = await adapter.posts.findByUri(testPosts[2].uri)
      expect(replyPost).toBeDefined()
      expect(replyPost!.replyParent).toBe(testPosts[2].replyParent)
      expect(replyPost!.replyRoot).toBe(testPosts[2].replyRoot)
    })

    it('should handle concurrent operations correctly', async () => {
      if (!adapter) {
        console.log(`⏭️  Skipping ${adapterName} concurrency test - adapter not available`)
        return
      }

      const concurrentPosts = Array.from({ length: 5 }, (_, i) => ({
        uri: `at://did:example:concurrent/app.bsky.feed.post/concurrent-${i}`,
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        authorDid: 'did:example:concurrent',
        recordJson: JSON.stringify({ text: `Concurrent post ${i}` }),
        indexedAt: new Date(Date.now() - i * 1000),
      }))

      // Create posts concurrently
      const createPromises = concurrentPosts.map(post => adapter.posts.create(post))
      const results = await Promise.allSettled(createPromises)
      
      // All should succeed
      const successes = results.filter(r => r.status === 'fulfilled')
      expect(successes).toHaveLength(5)

      // Clean up
      for (const post of concurrentPosts) {
        await adapter.posts.deleteByUri(post.uri)
      }
    })
  })
}) 