/* eslint-disable no-undef */
// MongoDB initialization script for testing
db = db.getSiblingDB('feedgen_test');

// Create test user with read/write permissions
db.createUser({
  user: 'testuser',
  pwd: 'testpass',
  roles: [
    {
      role: 'readWrite',
      db: 'feedgen_test'
    }
  ]
});

// Create indexes for better performance during testing
db.posts.createIndex({ uri: 1 }, { unique: true });
db.posts.createIndex({ authorDid: 1 });
db.posts.createIndex({ indexedAt: -1 });

db.subscription_states.createIndex({ service: 1 }, { unique: true });

print('MongoDB test database initialized successfully'); 