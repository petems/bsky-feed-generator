/**
 * Database schema definition for the feed generator
 */
export type DatabaseSchema = {
  /** Posts table for storing indexed posts */
  post: Post
  /** Subscription state table for tracking firehose cursor position */
  sub_state: SubState
}

/**
 * Post record structure
 */
export type Post = {
  /** AT-URI of the post */
  uri: string
  /** Content identifier (CID) of the post */
  cid: string
  /** Reply parent URI (optional) */
  replyParent?: string | null
  /** Reply root URI (optional) */
  replyRoot?: string | null
  /** Post author DID */
  authorDid: string
  /** Record JSON data */
  recordJson: string
  /** ISO timestamp when the post was indexed */
  indexedAt: string
}

/**
 * Subscription state for tracking firehose position
 */
export type SubState = {
  /** Service identifier */
  service: string
  /** Current cursor position in the firehose */
  cursor: number
}