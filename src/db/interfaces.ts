import { DatabaseConfig } from '../config'

/**
 * Common database operations interface
 */
export interface DatabaseAdapter {
  /** Initialize the database connection */
  connect(): Promise<void>
  
  /** Close the database connection */
  disconnect(): Promise<void>
  
  /** Run database migrations */
  migrate(): Promise<void>
  
  /** Check if the database connection is healthy */
  healthCheck(): Promise<boolean>
  
  /** Get the underlying database instance */
  getDatabase(): any
}

/**
 * Post record interface for consistent data structure across databases
 */
export interface PostRecord {
  /** Unique identifier */
  id: string
  /** Post URI */
  uri: string
  /** Content identifier */
  cid: string
  /** Reply parent URI (optional) */
  replyParent?: string
  /** Reply root URI (optional) */
  replyRoot?: string
  /** Post author DID */
  authorDid: string
  /** Record JSON data */
  recordJson: string
  /** Index timestamp */
  indexedAt: Date
}

/**
 * Subscription state interface
 */
export interface SubscriptionState {
  /** Service identifier */
  service: string
  /** Current cursor position */
  cursor: number
}

/**
 * Database operations interface for feed generator data
 */
export interface FeedDatabase {
  /** Post operations */
  posts: {
    /** Create a new post record */
    create(post: Omit<PostRecord, 'id'>): Promise<PostRecord>
    
    /** Find posts by criteria */
    findMany(criteria: {
      authorDid?: string
      limit?: number
      cursor?: string
    }): Promise<PostRecord[]>
    
    /** Find a single post by URI */
    findByUri(uri: string): Promise<PostRecord | null>
    
    /** Delete a post by URI */
    deleteByUri(uri: string): Promise<boolean>
    
    /** Get posts for a specific algorithm */
    getAlgorithmFeed(algorithm: string, limit: number, cursor?: string): Promise<{
      posts: PostRecord[]
      cursor?: string
    }>
  }
  
  /** Subscription state operations */
  subscriptionState: {
    /** Get current subscription state */
    get(service: string): Promise<SubscriptionState | null>
    
    /** Update subscription state */
    update(service: string, cursor: number): Promise<void>
  }
}

/**
 * Database factory function type
 */
export type DatabaseFactory = (config: DatabaseConfig) => Promise<DatabaseAdapter & FeedDatabase>