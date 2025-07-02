-- PostgreSQL initialization script for testing
-- This script runs automatically when the container starts

-- Create additional test database if needed
CREATE DATABASE feedgen_test_integration;

-- Connect to the test database
\c feedgen_test;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE feedgen_test TO testuser;
GRANT ALL PRIVILEGES ON DATABASE feedgen_test_integration TO testuser;

-- Create tables (these will be created by migrations, but we can pre-create for testing)
CREATE TABLE IF NOT EXISTS post (
    uri VARCHAR(255) PRIMARY KEY,
    cid VARCHAR(255) NOT NULL,
    "indexedAt" VARCHAR(255) NOT NULL,
    "replyParent" VARCHAR(255),
    "replyRoot" VARCHAR(255),
    "authorDid" VARCHAR(255) NOT NULL DEFAULT '',
    "recordJson" TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sub_state (
    service VARCHAR(255) PRIMARY KEY,
    cursor INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS post_indexed_at_idx ON post ("indexedAt");
CREATE INDEX IF NOT EXISTS post_author_did_idx ON post ("authorDid");

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS kysely_migration (
    name VARCHAR(255) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 