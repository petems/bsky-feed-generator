import { getAlgorithmNames, getAlgorithm } from '../../src/algos'
import * as whatsAlf from '../../src/algos/whats-alf'
import { AppContext } from '../../src/config'
import { createDb } from '../../src/db'

describe('Algorithms', () => {
  describe('getAlgorithmNames', () => {
    it('should return an array of algorithm names', () => {
      const names = getAlgorithmNames()
      expect(Array.isArray(names)).toBe(true)
      expect(names.length).toBeGreaterThan(0)
      expect(names).toContain('whats-alf')
    })
  })

  describe('getAlgorithm', () => {
    it('should return algorithm handler for valid name', () => {
      const handler = getAlgorithm('whats-alf')
      expect(handler).toBeDefined()
      expect(typeof handler).toBe('function')
    })

    it('should return undefined for invalid name', () => {
      const handler = getAlgorithm('non-existent-algo')
      expect(handler).toBeUndefined()
    })
  })

  describe('whats-alf algorithm', () => {
    let mockContext: AppContext
    let mockDb: any

    beforeEach(() => {
      // Create mock database
      mockDb = {
        selectFrom: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      }

      mockContext = {
        db: mockDb,
        didResolver: {} as any,
        cfg: {
          port: 3000,
          listenhost: 'localhost',
          hostname: 'example.com',
          database: {
            type: 'sqlite' as const,
            sqlite: { location: ':memory:' },
          },
          sqliteLocation: ':memory:',
          subscriptionEndpoint: 'wss://bsky.network',
          serviceDid: 'did:web:example.com',
          publisherDid: 'did:example:alice',
          subscriptionReconnectDelay: 3000,
        },
      }
    })

    it('should have correct shortname', () => {
      expect(whatsAlf.shortname).toBe('whats-alf')
      expect(whatsAlf.shortname.length).toBeLessThanOrEqual(15)
    })

    it('should return empty feed when no posts', async () => {
      mockDb.execute.mockResolvedValue([])

      const result = await whatsAlf.handler(mockContext, { 
        feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
        limit: 10 
      })

      expect(result).toEqual({
        cursor: undefined,
        feed: [],
      })
    })

    it('should filter and return only ALF-related posts', async () => {
      const mockPosts = [
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/1',
          cid: 'bafyreic',
          indexedAt: '2023-01-01T00:00:00.000Z',
          recordJson: JSON.stringify({ text: 'This post mentions ALF the alien' }),
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/2',
          cid: 'bafyreib',
          indexedAt: '2023-01-01T00:01:00.000Z',
          recordJson: JSON.stringify({ text: 'This is about something else entirely' }),
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/3',
          cid: 'bafyreic3',
          indexedAt: '2023-01-01T00:02:00.000Z',
          recordJson: JSON.stringify({ text: 'Another post about alf the TV show' }),
        },
      ]
      mockDb.execute.mockResolvedValue(mockPosts)

      const result = await whatsAlf.handler(mockContext, { 
        feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
        limit: 10 
      })

      // Should only return the 2 ALF-related posts
      expect(result.feed).toHaveLength(2)
      expect(result.feed[0]).toEqual({ post: mockPosts[0].uri })
      expect(result.feed[1]).toEqual({ post: mockPosts[2].uri })
      expect(result.cursor).toBeDefined()
    })

    it('should handle cursor-based pagination', async () => {
      const mockPosts = [
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/3',
          cid: 'bafyreic',
          indexedAt: '2023-01-01T00:02:00.000Z',
          recordJson: JSON.stringify({ text: 'ALF is great' }),
        },
      ]
      mockDb.execute.mockResolvedValue(mockPosts)

      const cursor = new Date('2023-01-01T00:05:00.000Z').getTime().toString()
      await whatsAlf.handler(mockContext, { 
        feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
        limit: 10, 
        cursor 
      })

      expect(mockDb.where).toHaveBeenCalledWith(
        'post.indexedAt',
        '<',
        '2023-01-01T00:05:00.000Z'
      )
    })

    it('should handle case-insensitive ALF filtering', async () => {
      const mockPosts = [
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/1',
          cid: 'bafyreic1',
          indexedAt: '2023-01-01T00:00:00.000Z',
          recordJson: JSON.stringify({ text: 'ALF is awesome' }),
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/2',
          cid: 'bafyreic2',
          indexedAt: '2023-01-01T00:01:00.000Z',
          recordJson: JSON.stringify({ text: 'I love alf' }),
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/3',
          cid: 'bafyreic3',
          indexedAt: '2023-01-01T00:02:00.000Z',
          recordJson: JSON.stringify({ text: 'Alf the alien' }),
        },
      ]
      mockDb.execute.mockResolvedValue(mockPosts)

      const result = await whatsAlf.handler(mockContext, { 
        feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
        limit: 10 
      })

      expect(result.feed).toHaveLength(3)
    })

    it('should handle malformed recordJson gracefully', async () => {
      const mockPosts = [
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/1',
          cid: 'bafyreic1',
          indexedAt: '2023-01-01T00:00:00.000Z',
          recordJson: 'invalid json',
        },
        {
          uri: 'at://did:example:alice/app.bsky.feed.post/2',
          cid: 'bafyreic2',
          indexedAt: '2023-01-01T00:01:00.000Z',
          recordJson: JSON.stringify({ text: 'This mentions ALF' }),
        },
      ]
      mockDb.execute.mockResolvedValue(mockPosts)

      const result = await whatsAlf.handler(mockContext, { 
        feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
        limit: 10 
      })

      // Should only return the valid ALF post, ignoring the malformed one
      expect(result.feed).toHaveLength(1)
      expect(result.feed[0]).toEqual({ post: mockPosts[1].uri })
    })

    it('should respect limit after filtering', async () => {
      const mockPosts = Array.from({ length: 10 }, (_, i) => ({
        uri: `at://did:example:alice/app.bsky.feed.post/${i}`,
        cid: `bafyreic${i}`,
        indexedAt: new Date(Date.now() + i * 1000).toISOString(),
        recordJson: JSON.stringify({ text: `Post ${i} about ALF` }),
      }))
      mockDb.execute.mockResolvedValue(mockPosts)

      const result = await whatsAlf.handler(mockContext, { 
        feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
        limit: 5 
      })

      expect(result.feed).toHaveLength(5)
    })

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed')
      mockDb.execute.mockRejectedValue(error)

      await expect(
        whatsAlf.handler(mockContext, { 
          feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
          limit: 10 
        })
      ).rejects.toThrow('Database connection failed')
    })
  })
})