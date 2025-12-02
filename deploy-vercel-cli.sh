#!/bin/bash

# Deploy to Vercel via CLI
# Make sure you have Node.js installed

echo "🚀 Deploying to Vercel..."

# Install Vercel CLI if not installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Login to Vercel
echo "Logging in to Vercel..."
vercel login

# Deploy
echo "Deploying project..."
vercel

# Add environment variable (if not already set)
echo ""
echo "⚠️  Don't forget to add your OPENAI_API_KEY:"
echo "   vercel env add OPENAI_API_KEY"
echo ""
echo "Or add it in the Vercel dashboard:"
echo "   Settings → Environment Variables"

# Deploy to production
read -p "Deploy to production? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    vercel --prod
    echo "✅ Deployed to production!"
fi

