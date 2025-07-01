import { Kysely, Migration, MigrationProvider } from 'kysely'

/**
 * Database migrations registry
 */
const migrations: Record<string, Migration> = {}

/**
 * Migration provider for Kysely
 */
export const migrationProvider: MigrationProvider = {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  },
}

/**
 * Initial migration - creates the core tables
 */
migrations['001'] = {
  async up(db: Kysely<unknown>): Promise<void> {
    // Create posts table for storing indexed posts
    await db.schema
      .createTable('post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
    
    // Create subscription state table for tracking firehose cursor
    await db.schema
      .createTable('sub_state')
      .addColumn('service', 'varchar', (col) => col.primaryKey())
      .addColumn('cursor', 'integer', (col) => col.notNull())
      .execute()
    
    // Create index on indexedAt for efficient querying
    await db.schema
      .createIndex('post_indexed_at_idx')
      .on('post')
      .column('indexedAt')
      .execute()
  },
  
  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('sub_state').execute()
  },
}

/**
 * Add additional post fields for comprehensive feed generation
 */
migrations['002'] = {
  async up(db: Kysely<unknown>): Promise<void> {
    // Add reply tracking fields
    await db.schema
      .alterTable('post')
      .addColumn('replyParent', 'varchar')
      .execute()
    
    await db.schema
      .alterTable('post')
      .addColumn('replyRoot', 'varchar')
      .execute()
    
    // Add author and record data fields
    await db.schema
      .alterTable('post')
      .addColumn('authorDid', 'varchar', (col) => col.notNull().defaultTo(''))
      .execute()
    
    await db.schema
      .alterTable('post')
      .addColumn('recordJson', 'text', (col) => col.notNull().defaultTo('{}'))
      .execute()
    
    // Create index on authorDid for efficient author queries
    await db.schema
      .createIndex('post_author_did_idx')
      .on('post')
      .column('authorDid')
      .execute()
  },
  
  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('post_author_did_idx').execute()
    await db.schema.alterTable('post').dropColumn('recordJson').execute()
    await db.schema.alterTable('post').dropColumn('authorDid').execute()
    await db.schema.alterTable('post').dropColumn('replyRoot').execute()
    await db.schema.alterTable('post').dropColumn('replyParent').execute()
  },
}