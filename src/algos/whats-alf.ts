import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

/**
 * Algorithm shortname (max 15 characters as per ATProto spec)
 */
export const shortname = 'whats-alf'

/**
 * ALF-related feed algorithm handler
 * Filters all posts to return only those containing "alf" (case-insensitive)
 * 
 * @param ctx - Application context containing database and configuration
 * @param params - Query parameters including limit and cursor
 * @returns Feed skeleton with ALF-related posts and optional cursor for pagination
 */
export const handler = async (ctx: AppContext, params: QueryParams) => {
  try {
    let builder = ctx.db
      .selectFrom('post')
      .selectAll()
      .orderBy('indexedAt', 'desc')
      .orderBy('cid', 'desc')

    // Apply cursor-based pagination if provided
    if (params.cursor) {
      const timeStr = new Date(parseInt(params.cursor, 10)).toISOString()
      builder = builder.where('post.indexedAt', '<', timeStr)
    }
    
    // Get more posts than requested to account for filtering
    const fetchLimit = Math.min(params.limit * 3, 300) // Fetch 3x to account for filtering
    const res = await builder.limit(fetchLimit).execute()

    // Filter posts for ALF-related content
    const alfPosts = res.filter((row) => {
      try {
        const record = JSON.parse(row.recordJson)
        return record.text && record.text.toLowerCase().includes('alf')
      } catch (error) {
        console.warn('Failed to parse record JSON:', error)
        return false
      }
    })

    // Apply the requested limit after filtering
    const limitedPosts = alfPosts.slice(0, params.limit)

    // Transform database results to feed skeleton format
    const feed = limitedPosts.map((row) => ({
      post: row.uri,
    }))

    // Generate cursor for pagination (timestamp of last item)
    let cursor: string | undefined
    const last = limitedPosts.at(-1)
    if (last) {
      cursor = new Date(last.indexedAt).getTime().toString(10)
    }

    return {
      cursor,
      feed,
    }
  } catch (error) {
    console.error('❌ Error in whats-alf algorithm:', error)
    throw error
  }
}