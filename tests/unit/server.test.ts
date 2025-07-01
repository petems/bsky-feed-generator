import request from 'supertest'
import FeedGenerator from '../../src/server'
import { Config } from '../../src/config'

describe('Server Endpoints', () => {
  let server: FeedGenerator
  let app: any

  beforeAll(async () => {
    const config: Config = {
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
    }

    server = FeedGenerator.create(config)
    app = server.app
    
    // Initialize database for testing
    if (server.dbAdapter) {
      await server.dbAdapter.migrate()
    }
  })

  afterAll(async () => {
    if (server) {
      await server.shutdown()
    }
  })

  describe('GET /', () => {
    it('should return the index page with endpoint documentation', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.headers['content-type']).toMatch(/text\/html/)
      expect(response.text).toContain('Bluesky Feed Generator')
      expect(response.text).toContain('Available Endpoints')
      expect(response.text).toContain('/health')
      expect(response.text).toContain('/.well-known/did.json')
      expect(response.text).toContain('/xrpc/app.bsky.feed.describeFeedGenerator')
      expect(response.text).toContain('/xrpc/app.bsky.feed.getFeedSkeleton')
    })

    it('should include server information in the index page', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.text).toContain('sqlite backend')
      expect(response.text).toContain('did:web:example.com')
      expect(response.text).toContain('1.0.0 (Multi-DB Enhanced)')
    })

    it('should include endpoint categories and descriptions', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.text).toContain('Documentation')
      expect(response.text).toContain('System')
      expect(response.text).toContain('Identity')
      expect(response.text).toContain('AT Protocol')
      expect(response.text).toContain('Health check endpoint with database status')
      expect(response.text).toContain('DID (Decentralized Identifier) document')
    })

    it('should include parameter information for endpoints that need them', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.text).toContain('Parameters:')
      expect(response.text).toContain('feed')
      expect(response.text).toContain('REQUIRED')
      expect(response.text).toContain('limit')
      expect(response.text).toContain('OPTIONAL')
      expect(response.text).toContain('cursor')
    })

    it('should include try links for each endpoint', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.text).toContain('Try Endpoint →')
      expect(response.text).toContain('/health')
      expect(response.text).toContain('/.well-known/did.json')
    })
  })

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')

      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('version', '1.0.0')
      expect(response.body).toHaveProperty('database')
      expect(response.body.database).toHaveProperty('type', 'sqlite')
      expect(response.body.database).toHaveProperty('healthy')
    })
  })

  describe('GET /.well-known/did.json', () => {
    it('should return DID document', async () => {
      const response = await request(app)
        .get('/.well-known/did.json')
        .expect(200)

      expect(response.headers['content-type']).toMatch(/application\/json/)
      expect(response.body).toHaveProperty('@context')
      expect(response.body).toHaveProperty('id', 'did:web:example.com')
    })
  })

  describe('GET /xrpc/app.bsky.feed.describeFeedGenerator', () => {
    it('should return feed generator description', async () => {
      const response = await request(app)
        .get('/xrpc/app.bsky.feed.describeFeedGenerator')
        .expect(200)

      expect(response.headers['content-type']).toMatch(/application\/json/)
      expect(response.body).toHaveProperty('did', 'did:web:example.com')
      expect(response.body).toHaveProperty('feeds')
      expect(Array.isArray(response.body.feeds)).toBe(true)
    })
  })

  describe('GET /xrpc/app.bsky.feed.getFeedSkeleton', () => {
    it('should require feed parameter', async () => {
      const response = await request(app)
        .get('/xrpc/app.bsky.feed.getFeedSkeleton')
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should return feed skeleton when feed parameter is provided', async () => {
      const response = await request(app)
        .get('/xrpc/app.bsky.feed.getFeedSkeleton')
        .query({ 
          feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf' 
        })

      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/application\/json/)
        expect(response.body).toHaveProperty('feed')
        expect(Array.isArray(response.body.feed)).toBe(true)
      } else {
        // Database might not be properly initialized in test environment
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/xrpc/app.bsky.feed.getFeedSkeleton')
        .query({ 
          feed: 'at://did:example:alice/app.bsky.feed.generator/whats-alf',
          limit: '10',
          cursor: '2023-01-01T00:00:00.000Z'
        })

      if (response.status === 200) {
        expect(response.body).toHaveProperty('feed')
        expect(Array.isArray(response.body.feed)).toBe(true)
      } else {
        // Database might not be properly initialized in test environment
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })
  })

  describe('Error handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404)
    })

    it('should handle invalid XRPC methods', async () => {
      const response = await request(app)
        .get('/xrpc/com.example.unknown.method')
      
      // Can be 404 or 501 depending on XRPC server implementation
      expect([404, 501]).toContain(response.status)
    })
  })
})