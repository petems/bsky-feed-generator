# Algorithm Architecture Improvement

## Overview

This document explains a significant architectural improvement made to the Bluesky feed generator: **moving content filtering logic from the subscription layer to the algorithm layer**.

## Previous Architecture (❌ Problematic)

### What Was Wrong

**Subscription Layer (`src/subscription.ts`)**:
```typescript
const postsToCreate = ops.posts.creates
  .filter((create) => {
    // ❌ BAD: Filtering for "alf" content at subscription level
    return create.record.text.toLowerCase().includes('alf')
  })
  .map((create) => { /* ... */ })
```

**Algorithm Layer (`src/algos/whats-alf.ts`)**:
```typescript
// ❌ BAD: Just returns all stored posts without filtering
const res = await builder.execute()
const feed = res.map((row) => ({ post: row.uri }))
```

### Problems with This Approach

1. **Database only contained "alf" posts** - made it impossible to create other algorithms
2. **Tight coupling** - subscription logic was tied to specific algorithm requirements  
3. **Inflexible** - adding new algorithms required changing core subscription code
4. **Poor separation of concerns** - filtering logic mixed with data ingestion

## New Architecture (✅ Improved)

### What's Better Now

**Subscription Layer (`src/subscription.ts`)**:
```typescript
const postsToCreate = ops.posts.creates
  .map((create) => {
    // ✅ GOOD: Store ALL posts - algorithms handle filtering
    return {
      uri: create.uri,
      cid: create.cid,
      replyParent: create.record.reply?.parent?.uri || null,
      replyRoot: create.record.reply?.root?.uri || null,
      authorDid: create.author,
      recordJson: JSON.stringify(create.record), // Store full record for filtering
      indexedAt: new Date().toISOString(),
    }
  })
```

**Algorithm Layer (`src/algos/whats-alf.ts`)**:
```typescript
// ✅ GOOD: Algorithm handles its own filtering logic
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
```

### Benefits of New Architecture

1. **🗄️ Complete Data Storage**: Database now contains ALL posts, enabling multiple algorithms
2. **🔄 Algorithm Flexibility**: Each algorithm can implement its own filtering logic
3. **🏗️ Better Separation**: Subscription handles ingestion, algorithms handle filtering
4. **📈 Scalability**: Easy to add new algorithms without touching subscription code
5. **🧪 Testability**: Each component can be tested independently

## Implementation Details

### Database Schema Enhancement

The `recordJson` field stores the complete post record, allowing algorithms to access:
- Post text content
- Reply relationships  
- Author information
- Timestamps
- Any other AT Protocol record fields

### Performance Considerations

- **Fetch Strategy**: Algorithm fetches 3x the requested limit to account for filtering
- **Memory Efficiency**: Filtering happens in-memory on fetched subset
- **Pagination**: Cursor-based pagination works correctly after filtering

### Error Handling

- **Malformed JSON**: Gracefully handles corrupted `recordJson` with warnings
- **Missing Fields**: Safely checks for required fields before filtering
- **Database Errors**: Proper error propagation with logging

## Example: Adding New Algorithms

With this architecture, adding new algorithms is straightforward:

```typescript
// src/algos/trending-topics.ts
export const handler = async (ctx: AppContext, params: QueryParams) => {
  const res = await ctx.db
    .selectFrom('post')
    .selectAll()
    .orderBy('indexedAt', 'desc')
    .limit(params.limit * 2)
    .execute()

  // Filter for posts with hashtags
  const trendingPosts = res.filter((row) => {
    const record = JSON.parse(row.recordJson)
    return record.text && record.text.includes('#')
  })

  return {
    feed: trendingPosts.map(row => ({ post: row.uri })),
    cursor: /* ... */
  }
}
```

## Migration Notes

### What Changed

1. **Subscription Logic**: Removed content filtering, now stores all posts
2. **Algorithm Logic**: Added filtering logic to `whats-alf` algorithm  
3. **Database Content**: Will now contain all posts, not just "alf" posts
4. **Test Coverage**: Updated tests to verify filtering behavior

### Backward Compatibility

- ✅ **API Endpoints**: No changes to external API
- ✅ **Feed Output**: Same feed results for existing algorithms
- ✅ **Configuration**: No configuration changes required
- ⚠️ **Database**: Existing databases will work but may be missing non-alf posts

## Testing

The new architecture includes comprehensive tests:

- **Filtering Logic**: Tests case-insensitive "alf" detection
- **Error Handling**: Tests malformed JSON handling
- **Pagination**: Tests cursor-based pagination with filtering
- **Performance**: Tests limit handling after filtering

## Conclusion

This architectural improvement transforms the feed generator from a single-purpose "alf" filter into a **flexible, multi-algorithm platform**. The separation of concerns makes the codebase more maintainable, testable, and extensible.

**Key Takeaway**: Filtering logic belongs in algorithms, not in the data ingestion layer. This allows for maximum flexibility and proper separation of concerns.