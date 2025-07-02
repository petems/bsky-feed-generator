export default async function globalTeardown() {
  console.log('🧹 Cleaning up global test environment...')
  
  // Clean up any global resources if needed
  // Note: Database connections are handled by individual test adapters
  
  console.log('✅ Global test environment cleanup complete')
} 