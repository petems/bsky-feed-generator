import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { createDb, Database, migrateToLatest, createDatabaseAdapter, DatabaseAdapter, FeedDatabase } from './db'
import { FirehoseSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'

/**
 * Main Feed Generator server class
 * Handles the HTTP server, database, and firehose subscription
 */
export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public dbAdapter?: DatabaseAdapter & FeedDatabase
  public firehose: FirehoseSubscription
  public cfg: Config
  private isShuttingDown: boolean = false

  constructor(
    app: express.Application,
    db: Database,
    firehose: FirehoseSubscription,
    cfg: Config,
    dbAdapter?: DatabaseAdapter & FeedDatabase,
  ) {
    this.app = app
    this.db = db
    this.dbAdapter = dbAdapter
    this.firehose = firehose
    this.cfg = cfg

    // Setup graceful shutdown handlers
    this.setupGracefulShutdown()
  }

  /**
   * Creates a new FeedGenerator instance with all dependencies configured
   * @param cfg - Application configuration
   * @returns Configured FeedGenerator instance
   */
  static create(cfg: Config): FeedGenerator {
    try {
      console.log('🔧 Initializing Feed Generator...')
      
      const app = express()
      
      // Add request logging middleware
      app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
        next()
      })

      // Use new database adapter if available, otherwise fall back to legacy SQLite
      let db: Database
      let dbAdapter: (DatabaseAdapter & FeedDatabase) | undefined
      
      if (cfg.database) {
        console.log(`💾 Using ${cfg.database.type} database adapter`)
        // Note: The adapter will be created and connected in the start() method
        // For now, create a legacy SQLite connection for backward compatibility
        db = createDb(cfg.sqliteLocation || ':memory:')
      } else {
        console.log('💾 Using legacy SQLite database')
        db = createDb(cfg.sqliteLocation || ':memory:')
      }

      const firehose = new FirehoseSubscription(db, cfg.subscriptionEndpoint)

      const didCache = new MemoryCache()
      const didResolver = new DidResolver({
        plcUrl: 'https://plc.directory',
        didCache,
      })

      const server = createServer({
        validateResponse: true,
        payload: {
          jsonLimit: 100 * 1024, // 100kb
          textLimit: 100 * 1024, // 100kb
          blobLimit: 5 * 1024 * 1024, // 5mb
        },
      })
      
      const ctx: AppContext = {
        db,
        didResolver,
        cfg,
      }
      
      // Setup XRPC methods
      feedGeneration(server, ctx)
      describeGenerator(server, ctx)
      
      // Mount middleware
      app.use(server.xrpc.router)
      app.use(wellKnown(ctx))

      // Index page showing all available endpoints
      app.get('/', (req, res) => {
        const baseUrl = `${req.protocol}://${req.get('host')}`
        const endpoints = [
          {
            path: '/',
            method: 'GET',
            description: 'This page - API documentation and endpoint listing',
            category: 'Documentation'
          },
          {
            path: '/health',
            method: 'GET',
            description: 'Health check endpoint with database status',
            category: 'System'
          },
          {
            path: '/.well-known/did.json',
            method: 'GET',
            description: 'DID (Decentralized Identifier) document for this service',
            category: 'Identity'
          },
          {
            path: '/xrpc/app.bsky.feed.describeFeedGenerator',
            method: 'GET',
            description: 'Describes the feed generator capabilities and metadata',
            category: 'AT Protocol'
          },
          {
            path: '/xrpc/app.bsky.feed.getFeedSkeleton',
            method: 'GET',
            description: 'Get feed posts skeleton (requires feed parameter)',
            parameters: [
              { name: 'feed', required: true, description: 'Feed AT-URI (e.g., at://did:example:alice/app.bsky.feed.generator/whats-alf)' },
              { name: 'limit', required: false, description: 'Number of posts to return (default: 50, max: 100)' },
              { name: 'cursor', required: false, description: 'Pagination cursor for next page' }
            ],
            category: 'AT Protocol'
          }
        ]

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bluesky Feed Generator - API Documentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }
        
        .header h1 {
            color: #2d3748;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .header p {
            color: #718096;
            font-size: 1.1rem;
            margin-bottom: 1rem;
        }
        
        .status {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: #48bb78;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .status::before {
            content: "●";
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .info-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 1.5rem;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }
        
        .info-card h3 {
            color: #2d3748;
            margin-bottom: 0.5rem;
            font-size: 1.1rem;
        }
        
        .info-card p {
            color: #718096;
            font-size: 0.95rem;
        }
        
        .endpoints {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }
        
        .endpoints h2 {
            color: #2d3748;
            margin-bottom: 1.5rem;
            font-size: 1.8rem;
            font-weight: 600;
        }
        
        .category {
            margin-bottom: 2rem;
        }
        
        .category h3 {
            color: #4a5568;
            margin-bottom: 1rem;
            font-size: 1.2rem;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 0.5rem;
        }
        
        .endpoint {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            transition: all 0.3s ease;
        }
        
        .endpoint:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            border-color: #667eea;
        }
        
        .endpoint-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 0.5rem;
        }
        
        .method {
            background: #48bb78;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.8rem;
        }
        
        .path {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #2d3748;
            color: #e2e8f0;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.9rem;
            flex-grow: 1;
            word-break: break-all;
        }
        
        .description {
            color: #4a5568;
            margin-bottom: 1rem;
        }
        
        .parameters {
            margin-top: 1rem;
        }
        
        .parameters h4 {
            color: #2d3748;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            font-weight: 600;
        }
        
        .parameter {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
        }
        
        .parameter-name {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-weight: 600;
            color: #2d3748;
        }
        
        .required {
            background: #fed7d7;
            color: #c53030;
            padding: 0.125rem 0.375rem;
            border-radius: 3px;
            font-size: 0.7rem;
            font-weight: 600;
            margin-left: 0.5rem;
        }
        
        .optional {
            background: #bee3f8;
            color: #2b6cb0;
            padding: 0.125rem 0.375rem;
            border-radius: 3px;
            font-size: 0.7rem;
            font-weight: 600;
            margin-left: 0.5rem;
        }
        
        .parameter-desc {
            color: #718096;
            font-size: 0.85rem;
            margin-top: 0.25rem;
        }
        
        .try-link {
            display: inline-block;
            background: #667eea;
            color: white;
            text-decoration: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.9rem;
            margin-top: 0.5rem;
            transition: background 0.3s ease;
        }
        
        .try-link:hover {
            background: #5a67d8;
        }
        
        .footer {
            text-align: center;
            margin-top: 2rem;
            color: rgba(255, 255, 255, 0.8);
            font-size: 0.9rem;
        }
        
        .footer a {
            color: rgba(255, 255, 255, 0.9);
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Bluesky Feed Generator</h1>
            <p>AT Protocol Feed Generator API - Cursor Enhanced Version</p>
            <div class="status">
                Server Running
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-card">
                <h3>🏠 Base URL</h3>
                <p><code>${baseUrl}</code></p>
            </div>
            <div class="info-card">
                <h3>💾 Database</h3>
                <p>${cfg.database?.type || 'sqlite'} backend</p>
            </div>
            <div class="info-card">
                <h3>🌐 Service DID</h3>
                <p><code>${cfg.serviceDid}</code></p>
            </div>
            <div class="info-card">
                <h3>📡 Version</h3>
                <p>1.0.0 (Multi-DB Enhanced)</p>
            </div>
        </div>
        
        <div class="endpoints">
            <h2>📋 Available Endpoints</h2>
            
            ${Object.entries(
              endpoints.reduce((groups, endpoint) => {
                const category = endpoint.category
                if (!groups[category]) groups[category] = []
                groups[category].push(endpoint)
                return groups
              }, {} as Record<string, typeof endpoints>)
            ).map(([category, categoryEndpoints]) => `
                <div class="category">
                    <h3>${category}</h3>
                    ${categoryEndpoints.map(endpoint => `
                        <div class="endpoint">
                            <div class="endpoint-header">
                                <span class="method">${endpoint.method}</span>
                                <span class="path">${endpoint.path}</span>
                            </div>
                            <div class="description">${endpoint.description}</div>
                            ${endpoint.parameters ? `
                                <div class="parameters">
                                    <h4>Parameters:</h4>
                                    ${endpoint.parameters.map(param => `
                                        <div class="parameter">
                                            <div>
                                                <span class="parameter-name">${param.name}</span>
                                                <span class="${param.required ? 'required' : 'optional'}">
                                                    ${param.required ? 'REQUIRED' : 'OPTIONAL'}
                                                </span>
                                            </div>
                                            <div class="parameter-desc">${param.description}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            <a href="${baseUrl}${endpoint.path}" class="try-link" target="_blank">
                                Try Endpoint →
                            </a>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>
                Powered by <a href="https://atproto.com/" target="_blank">AT Protocol</a> | 
                Enhanced with <a href="https://cursor.sh/" target="_blank">Cursor AI</a> | 
                <a href="https://github.com/bluesky-social/feed-generator" target="_blank">Original Project</a>
            </p>
        </div>
    </div>
</body>
</html>`

        res.send(html)
      })

      // Health check endpoint
      app.get('/health', async (req, res) => {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          database: {
            type: cfg.database?.type || 'sqlite',
            healthy: false,
          },
        }

        // Check database health
        try {
          if (dbAdapter) {
            health.database.healthy = await dbAdapter.healthCheck()
          } else {
            // Legacy health check - try a simple query
            await db.selectFrom('post').select('uri').limit(1).execute()
            health.database.healthy = true
          }
        } catch (error) {
          console.error('❌ Database health check failed:', error)
          health.database.healthy = false
        }

        const statusCode = health.database.healthy ? 200 : 503
        res.status(statusCode).json(health)
      })

      // Error handling middleware
      app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('❌ Express error:', err)
        res.status(500).json({ error: 'Internal server error' })
      })

      console.log('✅ Feed Generator initialized successfully')
      return new FeedGenerator(app, db, firehose, cfg, dbAdapter)
    } catch (error) {
      console.error('❌ Failed to create Feed Generator:', error)
      throw error
    }
  }

  /**
   * Starts the server and all associated services
   * @returns Promise resolving to the HTTP server instance
   */
  async start(): Promise<http.Server> {
    try {
      console.log('🚀 Starting Feed Generator server...')
      
      // Initialize database adapter if configured
      if (this.cfg.database && !this.dbAdapter) {
        console.log(`💾 Initializing ${this.cfg.database.type} database adapter...`)
        this.dbAdapter = await createDatabaseAdapter(this.cfg.database)
        console.log('✅ Database adapter initialized and migrated')
      } else {
        // Run legacy database migrations
        await migrateToLatest(this.db)
      }
      
      // Start firehose subscription
      console.log('📡 Starting firehose subscription...')
      this.firehose.run(this.cfg.subscriptionReconnectDelay)
      
      // Start HTTP server
      console.log(`🌐 Starting HTTP server on ${this.cfg.listenhost}:${this.cfg.port}...`)
      this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
      await events.once(this.server, 'listening')
      
      console.log('✅ Feed Generator server started successfully')
      return this.server
    } catch (error) {
      console.error('❌ Failed to start Feed Generator server:', error)
      throw error
    }
  }

  /**
   * Gracefully shuts down the server and all services
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    console.log('🛑 Shutting down Feed Generator server...')

    try {
      // Stop accepting new connections
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            console.log('✅ HTTP server closed')
            resolve()
          })
        })
      }

      // Stop firehose subscription
      if (this.firehose && this.firehose.sub) {
        // Note: Subscription doesn't have a destroy method in current version
        // The subscription will be closed when the process exits
        console.log('✅ Firehose subscription will close on process exit')
      }

      // Close database connections
      if (this.dbAdapter) {
        await this.dbAdapter.disconnect()
        console.log('✅ Database adapter disconnected')
      }
      
      if (this.db) {
        await this.db.destroy()
        console.log('✅ Legacy database connection closed')
      }

      console.log('✅ Feed Generator server shutdown complete')
    } catch (error) {
      console.error('❌ Error during shutdown:', error)
      throw error
    }
  }

  /**
   * Sets up graceful shutdown handlers for process signals
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`📨 Received ${signal}, starting graceful shutdown...`)
        try {
          await this.shutdown()
          process.exit(0)
        } catch (error) {
          console.error('❌ Error during graceful shutdown:', error)
          process.exit(1)
        }
      })
    })
  }
}

export default FeedGenerator