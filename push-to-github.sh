#!/bin/bash

# Script to push to GitHub repository
# Make sure you've created the repository at: https://github.com/kavya5jan-prog/ema-claims

echo "Pushing to GitHub repository..."

# Check if remote is set correctly
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
echo "Current remote: $REMOTE_URL"

# Push to GitHub
echo "Pushing to origin/main..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo "Repository: https://github.com/kavya5jan-prog/ema-claims"
else
    echo "❌ Push failed. Possible reasons:"
    echo "1. Repository doesn't exist yet - create it at: https://github.com/new?name=ema-claims"
    echo "2. Authentication required - you may need a Personal Access Token"
    echo "3. Check your internet connection"
fi

