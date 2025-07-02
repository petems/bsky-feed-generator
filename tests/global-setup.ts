import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function globalSetup() {
  console.log('🚀 Setting up global test environment...')
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.TEST_MODE = process.env.TEST_MODE || 'all'
  
  // Only set up databases for acceptance tests
  if (process.env.TEST_MODE === 'acceptance' || process.env.TEST_MODE === 'all') {
    console.log('📊 Setting up test databases...')
    
    // Check if Docker is available
    try {
      await execAsync('docker --version')
      console.log('✅ Docker is available')
      
      // Check if Docker Compose services are running
      try {
        const { stdout } = await execAsync('docker-compose ps --services --filter "status=running"')
        const runningServices = stdout.trim().split('\n').filter(s => s.length > 0)
        
        if (runningServices.includes('mongodb') && runningServices.includes('postgresql')) {
          console.log('✅ Database services are already running')
        } else {
          console.log('⚠️  Database services not running. Please run: docker-compose up -d')
        }
             } catch {
         console.log('⚠️  Could not check Docker Compose status. Please ensure services are running.')
       }
     } catch {
       console.log('⚠️  Docker not available. Acceptance tests may be skipped.')
     }
    
    // Set database connection URIs for tests
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://root:testpass@localhost:27017'
    process.env.MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'feedgen_test'
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost'
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432'
    process.env.POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || 'feedgen_test'
    process.env.POSTGRES_USERNAME = process.env.POSTGRES_USERNAME || 'testuser'
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'testpass'
  }
  
  console.log('✅ Global test environment setup complete')
} 