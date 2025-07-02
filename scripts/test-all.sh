#!/bin/bash

# Test runner script for Bluesky Feed Generator
# This script sets up the test environment and runs all tests

set -e

echo "🚀 Starting comprehensive test suite..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found. Skipping acceptance tests."
        return 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose not found. Skipping acceptance tests."
        return 1
    fi
    
    return 0
}

# Run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    yarn test:unit
    print_success "Unit tests completed"
}

# Set up Docker services
setup_docker() {
    print_status "Setting up Docker services..."
    yarn docker:up
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    print_success "Docker services are ready"
}

# Run acceptance tests
run_acceptance_tests() {
    print_status "Running acceptance tests..."
    TEST_MODE=acceptance yarn test:acceptance
    print_success "Acceptance tests completed"
}

# Cleanup Docker services
cleanup_docker() {
    print_status "Cleaning up Docker services..."
    yarn docker:down
    print_success "Docker cleanup completed"
}

# Main execution
main() {
    print_status "Bluesky Feed Generator - Comprehensive Test Suite"
    
    # Always run unit tests
    run_unit_tests
    
    # Check if we should run acceptance tests
    if check_docker; then
        # Set up Docker services
        setup_docker
        
        # Trap to ensure cleanup on exit
        trap cleanup_docker EXIT
        
        # Run acceptance tests
        run_acceptance_tests
        
        print_success "All tests completed successfully! 🎉"
    else
        print_warning "Skipping acceptance tests due to missing Docker"
        print_success "Unit tests completed successfully! ✅"
    fi
}

# Run main function
main "$@" 