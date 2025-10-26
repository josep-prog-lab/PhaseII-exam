#!/bin/bash

# Camera Preview Fix - Quick Deployment Script
# This script builds and commits the camera preview fixes

set -e  # Exit on error

echo "🚀 Camera Preview Fix - Deployment Script"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📦 Step 1: Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

echo ""
echo "📝 Step 2: Git status..."
git status --short

echo ""
echo "🔍 Files to be committed:"
echo "  - src/components/VideoRecorder.tsx (enhanced camera preview)"
echo "  - COMPLETE_CAMERA_FIX_GUIDE.md (documentation)"
echo "  - CAMERA_PREVIEW_DEPLOYMENT_FIX.md (previous fix docs)"
echo "  - dist/ (production build)"
echo ""

read -p "Do you want to commit and push these changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📤 Step 3: Committing changes..."
    git add src/components/VideoRecorder.tsx
    git add COMPLETE_CAMERA_FIX_GUIDE.md
    git add CAMERA_PREVIEW_DEPLOYMENT_FIX.md
    git add dist/
    git add deploy.sh
    
    git commit -m "Fix camera preview rendering in production with polling and enhanced logging

- Increased initial delay from 200ms to 500ms for production builds
- Added polling mechanism (up to 2s) to wait for video element
- Enhanced stream assignment verification with detailed logging
- Added video element event handlers (onPlay, onPause, onError)
- Improved error handling with state reset and stream cleanup
- Added [VideoRecorder] prefix to all logs for easier debugging
- Fixes black screen issue on deployed version

This ensures the camera preview shows the candidate's face on both
localhost and production deployments."
    
    echo "✅ Changes committed!"
    echo ""
    echo "📤 Step 4: Pushing to remote..."
    git push origin main
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully pushed to remote!"
        echo ""
        echo "🎉 Deployment complete!"
        echo ""
        echo "📋 Next steps:"
        echo "  1. Wait for your hosting platform to deploy (Lovable/Vercel/Netlify)"
        echo "  2. Open your deployed URL (must be HTTPS)"
        echo "  3. Open browser console (F12)"
        echo "  4. Navigate to exam page and start recording"
        echo "  5. Check console for [VideoRecorder] logs"
        echo "  6. Verify camera preview shows your face"
        echo ""
        echo "📖 See COMPLETE_CAMERA_FIX_GUIDE.md for detailed testing instructions"
    else
        echo "❌ Push failed. Please check your git configuration and try again."
        exit 1
    fi
else
    echo ""
    echo "⏸️  Deployment cancelled. No changes were committed."
    echo ""
    echo "You can manually commit and push with:"
    echo "  git add ."
    echo "  git commit -m 'Fix camera preview in production'"
    echo "  git push origin main"
fi

echo ""
echo "=========================================="
