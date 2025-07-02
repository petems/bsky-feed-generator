# ATProto Feed Generator - Cursor Interpretation

> **Note**: This is a Cursor-based interpretation and enhancement of the original [Bluesky Feed Generator](https://github.com/bluesky-social/feed-generator) project. This version includes additional features such as comprehensive unit testing, GitHub Actions CI/CD pipeline, improved TypeScript configuration with strict linting rules, and **multi-database backend support**.

This project is a starter kit for creating ATProto Feed Generators with enhanced development practices. It's not feature complete, but provides a solid foundation with modern development tooling to build and deploy custom feeds for the Bluesky social network.

## 🚀 What's New in This Cursor Interpretation

- **Interactive API Documentation**: Beautiful index page showing all available endpoints with descriptions and parameters
- **Improved Algorithm Architecture**: Moved filtering logic from subscription to algorithm layer for better flexibility and separation of concerns
- **Multi-Database Backend Support**: SQLite, PostgreSQL, and MongoDB support with unified adapter interface
- **Comprehensive Unit Testing**: Full Jest test suite with coverage reporting
- **GitHub Actions CI/CD**: Automated TypeScript validation and test execution
- **Enhanced TypeScript Configuration**: Strict type checking and modern ES features
- **ESLint Integration**: Comprehensive linting rules for code quality
- **Improved Developer Experience**: Better scripts, error handling, and documentation

## 💾 Database Backend Support

This feed generator supports multiple database backends through a unified adapter interface:

### Supported Databases

| Database | Status | Use Case |
|----------|--------|----------|
| **SQLite** | ✅ Production Ready | Development, small-scale deployments |
| **PostgreSQL** | ✅ Production Ready | Production deployments, high performance |
| **MongoDB** | ✅ Production Ready | Document-based storage, flexible schemas |

### Database Configuration

Configure your database backend using environment variables:

#### SQLite (Default)
```bash
DATABASE_TYPE=sqlite
SQLITE_LOCATION=./data/feedgen.db  # or :memory: for in-memory
```

#### PostgreSQL
```bash
DATABASE_TYPE=postgresql
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=feedgen
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=false
POSTGRES_POOL_SIZE=10
```

#### MongoDB
```bash
DATABASE_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=feedgen
MONGODB_MAX_POOL_SIZE=10
MONGODB_SERVER_SELECTION_TIMEOUT=5000
MONGODB_SOCKET_TIMEOUT=45000
```

### Database Features

- **Automatic Migrations**: All databases support automatic schema migrations
- **Connection Pooling**: PostgreSQL and MongoDB include connection pooling
- **Health Checks**: Built-in health check endpoints for all database types
- **Unified Interface**: Same API across all database backends
- **Type Safety**: Full TypeScript support with proper type definitions

## Overview

Feed Generators are services that provide custom algorithms to users through the AT Protocol.

They work very simply: the server receives a request from a user's server and returns a list of post URIs with some optional metadata attached. Those posts are then hydrated into full views by the requesting server and sent back to the client. This route is described in the app.bsky.feed.getFeedSkeleton lexicon.

A Feed Generator service can host one or more algorithms. The service itself is identified by DID, while each algorithm that it hosts is declared by a record in the repo of the account that created it. For instance, feeds offered by Bluesky will likely be declared in `@bsky.app`'s repo. Therefore, a given algorithm is identified by the at-uri of the declaration record. This declaration record includes a pointer to the service's DID along with some profile information for the feed.

## 🛠️ Getting Started

### Prerequisites

- Node.js >= 18
- yarn package manager
- Database server (optional - SQLite works out of the box)

### Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd cursor-bluesky-feed-generator
```

2. Install dependencies:
```bash
yarn install
```

3. Copy the environment configuration:
```bash
cp .env.example .env
```

4. Configure your database in the `.env` file (see Database Configuration above).

### Development

The server supports multiple database backends with automatic migrations. Choose the database that best fits your needs:

- **SQLite**: Perfect for development and small deployments
- **PostgreSQL**: Ideal for production with high performance requirements
- **MongoDB**: Great for flexible document-based storage

To get started, you need to:

1. **Implement indexing logic** in `src/subscription.ts`
   - This subscribes to the repo subscription stream on startup
   - Parses events and indexes them according to your logic

2. **Implement feed generation logic** in `src/algos`
   - We've provided a simple example feed algorithm (`whats-alf`)
   - You can edit it or add new algorithms alongside it
   - The types are in place - just return something satisfying `SkeletonFeedPost[]`

### Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build the TypeScript project
- `yarn start` - Start the production server
- `yarn test` - Run unit tests (includes database adapter tests)
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Generate test coverage report
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Fix ESLint issues automatically
- `yarn type-check` - Run TypeScript type checking
- `yarn publishFeed` - Publish your feed to the network
- `yarn unpublishFeed` - Remove your feed from the network

## 🧪 Testing

This project includes comprehensive unit tests for all database adapters:

```bash
# Run all tests including database adapter tests
yarn test

# Run tests in watch mode during development
yarn test:watch

# Generate coverage report
yarn test:coverage
```

The test suite includes:
- Database adapter functionality tests
- Configuration validation tests
- Environment configuration tests
- Error handling tests
- Feed generation tests

Tests are located in the `tests/` directory and follow the naming convention `*.test.ts` or `*.spec.ts`.

## 🔧 CI/CD Pipeline

This project includes a GitHub Actions workflow that:

- Runs on every push and pull request
- Tests on Node.js 18.x and 20.x
- Validates TypeScript compilation
- Runs ESLint for code quality
- Executes the full test suite including database tests
- Generates test coverage reports
- Performs security audits

The workflow file is located at `.github/workflows/ci.yml`.

## 📦 Deployment

### Local Development

Run the development server:
```bash
yarn dev
```

The server will start on port 3000 (or your configured port). You can access:
- `http://localhost:3000/` - **Interactive API documentation with all available endpoints**
- `http://localhost:3000/.well-known/did.json` - DID document
- `http://localhost:3000/xrpc/app.bsky.feed.describeFeedGenerator` - Feed description
- `http://localhost:3000/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://your-did/app.bsky.feed.generator/your-feed` - Feed skeleton
- `http://localhost:3000/health` - Health check with database status

### Production Deployment

1. **Configure your database**: Set up PostgreSQL or MongoDB for production use
2. **Set environment variables**: Configure all required environment variables
3. **Build the project**: `yarn build`
4. **Deploy to your hosting platform**: Heroku, Railway, Fly.io, AWS, etc.

#### Example Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json yarn.lock ./
RUN yarn install --frozen-lockfile --production
COPY dist ./dist
COPY src/lexicon ./src/lexicon
EXPOSE 3000
CMD ["yarn", "start"]
```

### Database Setup

#### PostgreSQL Setup
```sql
CREATE DATABASE feedgen;
CREATE USER feedgen_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE feedgen TO feedgen_user;
```

#### MongoDB Setup
```bash
# Create database and user
mongosh
use feedgen
db.createUser({
  user: "feedgen_user",
  pwd: "your_password",
  roles: [{ role: "readWrite", db: "feedgen" }]
})
```

### Publishing Your Feed

Once deployed, publish your feed to the network:

```bash
yarn publishFeed
```

You'll be prompted for your Bluesky credentials to publish the feed record.

## 📖 API Documentation

### Feed Skeleton Response

The basic response format:
```typescript
{
  cursor?: string,
  feed: Array<{
    post: string, // post URI
    reason?: {
      $type: 'app.bsky.feed.defs#skeletonReasonRepost',
      repost: string // repost URI
    }
  }>
}
```

### Health Check Endpoint

The `/health` endpoint provides detailed status information:

```typescript
{
  status: "healthy" | "unhealthy",
  timestamp: string,
  version: string,
  database: {
    type: "sqlite" | "postgresql" | "mongodb",
    healthy: boolean
  }
}
```

### Authentication

User requests are authenticated with JWT tokens signed by the user's repo signing key. The JWT format:

```typescript
{
  header: {
    type: "JWT",
    alg: "ES256K"
  },
  payload: {
    iss: "did:example:alice", // requesting user's DID
    aud: "did:example:feedGenerator", // feed generator's DID
    exp: 1683643619 // expiration timestamp
  }
}
```

## 🏗️ Project Structure

```
src/
├── algos/           # Feed algorithm implementations
├── db/              # Database layer
│   ├── adapters/    # Database adapter implementations
│   │   ├── sqlite.ts      # SQLite adapter
│   │   ├── postgresql.ts  # PostgreSQL adapter
│   │   └── mongodb.ts     # MongoDB adapter
│   ├── interfaces.ts      # Database interfaces
│   ├── factory.ts         # Database factory
│   ├── schema.ts          # Database schema
│   └── migrations.ts      # Database migrations
├── lexicon/         # ATProto lexicon definitions
├── methods/         # XRPC method handlers
├── util/            # Utility functions
├── auth.ts          # Authentication utilities
├── config.ts        # Configuration types and defaults
├── index.ts         # Application entry point
├── server.ts        # Express server setup
├── subscription.ts  # Firehose subscription logic
└── well-known.ts    # Well-known endpoints

tests/               # Unit tests
├── unit/
│   ├── algos.test.ts           # Algorithm tests
│   ├── db.test.ts              # Legacy database tests
│   └── database-adapters.test.ts # Multi-database adapter tests
└── setup.ts         # Test configuration

scripts/             # Utility scripts
.github/workflows/   # GitHub Actions CI/CD
```

## 🔄 Migration Guide

### From Legacy SQLite to Multi-Database

If you're upgrading from a previous version that only supported SQLite:

1. **Backup your data**: Export your existing SQLite database
2. **Update environment variables**: Add `DATABASE_TYPE=sqlite` to maintain current behavior
3. **Optional migration**: Migrate to PostgreSQL or MongoDB for better performance

### Database Migration Between Backends

To migrate between database backends:

1. **Export data** from your current database
2. **Update environment variables** to point to the new database
3. **Start the application** - migrations will run automatically
4. **Import your data** using the new database adapter

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Run the test suite: `yarn test`
5. Run linting: `yarn lint`
6. Commit your changes: `git commit -m 'Add some feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Submit a pull request

### Adding New Database Backends

To add support for a new database backend:

1. Create a new adapter in `src/db/adapters/`
2. Implement the `DatabaseAdapter` and `FeedDatabase` interfaces
3. Add the new database type to the factory
4. Add configuration types and environment variable support
5. Add comprehensive tests
6. Update documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original [Bluesky Feed Generator](https://github.com/bluesky-social/feed-generator) project
- Bluesky team for the ATProto specification
- Cursor AI for development assistance
- Database communities: SQLite, PostgreSQL, and MongoDB

## 📚 Additional Resources

- [ATProto Documentation](https://atproto.com/)
- [Bluesky Developer Documentation](https://docs.bsky.app/)
- [Feed Generator Examples](https://github.com/bluesky-social/feed-generator/tree/main/src/algos)
- [Database Setup Guides](./docs/database-setup.md)
- [Performance Tuning](./docs/performance.md)