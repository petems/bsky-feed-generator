import { MongoClient, Db, Collection } from 'mongodb'
import { DatabaseConfig } from '../../config'
import { DatabaseAdapter, FeedDatabase, PostRecord, SubscriptionState } from '../interfaces'
import { randomUUID } from 'crypto'

/**
 * MongoDB document interfaces
 */
interface PostDocument {
  _id?: string
  uri: string
  cid: string
  replyParent?: string
  replyRoot?: string
  authorDid: string
  recordJson: string
  indexedAt: Date
}

interface SubscriptionStateDocument {
  _id?: string
  service: string
  cursor: number
}

/**
 * MongoDB database adapter implementation
 */
export class MongoDBAdapter implements DatabaseAdapter, FeedDatabase {
  private client: MongoClient | null = null
  private db: Db | null = null
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    try {
      if (!this.config.mongodb) {
        throw new Error('MongoDB configuration is required')
      }

      const mongoConfig = this.config.mongodb
      this.client = new MongoClient(mongoConfig.uri, {
        maxPoolSize: mongoConfig.options?.maxPoolSize || 10,
        serverSelectionTimeoutMS: mongoConfig.options?.serverSelectionTimeoutMS || 5000,
        socketTimeoutMS: mongoConfig.options?.socketTimeoutMS || 45000,
      })

      await this.client.connect()
      this.db = this.client.db(mongoConfig.database)

      // Test the connection
      await this.db.admin().ping()

      console.log(`✅ Connected to MongoDB database: ${mongoConfig.database}`)
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB database:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close()
        this.client = null
        this.db = null
      }
      console.log('✅ Disconnected from MongoDB database')
    } catch (error) {
      console.error('❌ Failed to disconnect from MongoDB database:', error)
      throw error
    }
  }

  async migrate(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected')
    }

    try {
      console.log('🔄 Running MongoDB database setup...')
      
      // Create collections if they don't exist
      const collections = await this.db.listCollections().toArray()
      const existingCollections = new Set(collections.map(c => c.name))

      if (!existingCollections.has('posts')) {
        await this.db.createCollection('posts')
        console.log('  - Created posts collection')
      }

      if (!existingCollections.has('subscription_states')) {
        await this.db.createCollection('subscription_states')
        console.log('  - Created subscription_states collection')
      }

      // Create indexes for efficient querying
      const postsCollection = this.db.collection('posts')
      const subscriptionStatesCollection = this.db.collection('subscription_states')

      // Create indexes on posts collection
      await postsCollection.createIndex({ uri: 1 }, { unique: true })
      await postsCollection.createIndex({ authorDid: 1 })
      await postsCollection.createIndex({ indexedAt: -1 })
      console.log('  - Created indexes on posts collection')

      // Create index on subscription states collection
      await subscriptionStatesCollection.createIndex({ service: 1 }, { unique: true })
      console.log('  - Created indexes on subscription_states collection')

      console.log('✅ MongoDB database setup completed')
    } catch (error) {
      console.error('❌ MongoDB database setup failed:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) {
        return false
      }
      
      await this.db.admin().ping()
      return true
    } catch (error) {
      console.error('❌ MongoDB health check failed:', error)
      return false
    }
  }

  getDatabase(): Db {
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
      const collection = this.db.collection<PostDocument>('posts')

      const document: PostDocument = {
        uri: newPost.uri,
        cid: newPost.cid,
        replyParent: newPost.replyParent,
        replyRoot: newPost.replyRoot,
        authorDid: newPost.authorDid,
        recordJson: newPost.recordJson,
        indexedAt: newPost.indexedAt,
      }

      await collection.insertOne(document)
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

      const collection = this.db.collection<PostDocument>('posts')
      const filter: any = {}

      if (criteria.authorDid) {
        filter.authorDid = criteria.authorDid
      }

      if (criteria.cursor) {
        filter.indexedAt = { $lt: new Date(criteria.cursor) }
      }

      const cursor = collection
        .find(filter)
        .sort({ indexedAt: -1 })

      if (criteria.limit) {
        cursor.limit(criteria.limit)
      }

      const documents = await cursor.toArray()
      return documents.map(doc => ({
        id: doc.uri,
        uri: doc.uri,
        cid: doc.cid,
        replyParent: doc.replyParent,
        replyRoot: doc.replyRoot,
        authorDid: doc.authorDid,
        recordJson: doc.recordJson,
        indexedAt: doc.indexedAt,
      }))
    },

    findByUri: async (uri: string): Promise<PostRecord | null> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      const collection = this.db.collection<PostDocument>('posts')
      const document = await collection.findOne({ uri })

      if (!document) {
        return null
      }

      return {
        id: document.uri,
        uri: document.uri,
        cid: document.cid,
        replyParent: document.replyParent,
        replyRoot: document.replyRoot,
        authorDid: document.authorDid,
        recordJson: document.recordJson,
        indexedAt: document.indexedAt,
      }
    },

    deleteByUri: async (uri: string): Promise<boolean> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      const collection = this.db.collection<PostDocument>('posts')
      const result = await collection.deleteOne({ uri })
      return result.deletedCount > 0
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

      const collection = this.db.collection<SubscriptionStateDocument>('subscription_states')
      const document = await collection.findOne({ service })

      if (!document) {
        return null
      }

      return {
        service: document.service,
        cursor: document.cursor,
      }
    },

    update: async (service: string, cursor: number): Promise<void> => {
      if (!this.db) {
        throw new Error('Database not connected')
      }

      const collection = this.db.collection<SubscriptionStateDocument>('subscription_states')
      await collection.replaceOne(
        { service },
        { service, cursor },
        { upsert: true }
      )
    },
  }
}