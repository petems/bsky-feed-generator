import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { DatabaseAdapter, FeedDatabase } from './db/interfaces'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  constructor(
    db: any, // Legacy database for compatibility
    service: string,
    dbAdapter?: DatabaseAdapter & FeedDatabase
  ) {
    super(db, service, dbAdapter)
  }

  /**
   * Set the database adapter after initialization
   */
  setDatabaseAdapter(dbAdapter: DatabaseAdapter & FeedDatabase) {
    this.dbAdapter = dbAdapter
  }

  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    // This logs the text of every post off the firehose.
    // Just for fun :)
    // Delete before actually using
    for (const post of ops.posts.creates) {
      console.log(post.record.text)
    }

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .map((create) => {
        // map all posts to db rows - algorithms will handle filtering
        return {
          uri: create.uri,
          cid: create.cid,
          replyParent: create.record.reply?.parent?.uri || undefined,
          replyRoot: create.record.reply?.root?.uri || undefined,
          authorDid: create.author,
          recordJson: JSON.stringify(create.record),
          indexedAt: new Date(),
        }
      })

    // Use new database adapter if available, otherwise fall back to legacy
    if (this.dbAdapter) {
      // Delete posts using new adapter
      for (const uri of postsToDelete) {
        try {
          await this.dbAdapter.posts.deleteByUri(uri)
        } catch (error) {
          console.error(`Failed to delete post ${uri}:`, error)
        }
      }

      // Create posts using new adapter
      for (const post of postsToCreate) {
        try {
          await this.dbAdapter.posts.create(post)
        } catch (error) {
          console.error(`Failed to create post ${post.uri}:`, error)
        }
      }
    } else {
      // Legacy database operations
      if (postsToDelete.length > 0) {
        await this.db
          .deleteFrom('post')
          .where('uri', 'in', postsToDelete)
          .execute()
      }
      if (postsToCreate.length > 0) {
        const legacyPosts = postsToCreate.map(post => ({
          uri: post.uri,
          cid: post.cid,
          replyParent: post.replyParent || null,
          replyRoot: post.replyRoot || null,
          authorDid: post.authorDid,
          recordJson: post.recordJson,
          indexedAt: post.indexedAt.toISOString(),
        }))
        
        await this.db
          .insertInto('post')
          .values(legacyPosts)
          .onConflict((oc: any) => oc.doNothing())
          .execute()
      }
    }
  }
}
