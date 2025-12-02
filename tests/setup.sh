#!/bin/bash

# Test Automation Framework Setup Script
# This script sets up the test automation environment

set -e

echo "🚀 Setting up Test Automation Framework..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install --with-deps

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and set BASE_URL and OPENAI_API_KEY"
else
    echo "✅ .env file already exists"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p reports/html
mkdir -p reports/screenshots
mkdir -p reports/logs
mkdir -p test-data

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and set BASE_URL and OPENAI_API_KEY"
echo "2. Start the application: python app.py (from project root)"
echo "3. Run tests: npm test"
echo ""
echo "For more information, see:"
echo "  - README.md - Overview"
echo "  - EXECUTION_GUIDE.md - Detailed execution guide"
echo "  - MAINTENANCE.md - Maintenance guide"
echo ""


