# PWA Logo Fix - Deployment Instructions

## Problem Identified
The deployed version of your Exam Space app is showing a different logo (bird/eagle silhouette) in the PWA installation prompt, while your local version correctly shows your custom logo.

## Root Cause
The deployed version is likely using cached files or the deployment platform (Vercel) is serving old manifest and icon files.

## Solution Applied
I've implemented cache-busting to force browsers and deployment platforms to use the updated files:

### Changes Made:
1. **Added cache-busting parameters** (`?v=2`) to all icon references in `manifest.json`
2. **Updated HTML file** to use cache-busted favicon and manifest links
3. **Updated all icon references** in shortcuts and screenshots
4. **Added cache-busting to Open Graph and Twitter meta tags**

### Files Updated:
- `/public/manifest.json` - All icon URLs now have `?v=2`
- `/index.html` - All icon and manifest links now have `?v=2`
- Built files in `/dist/` are updated with cache-busting

## Deployment Steps

### For Vercel Deployment:

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Fix PWA logo with cache-busting"
   git push origin main
   ```

2. **Force a clean deployment:**
   - Go to your Vercel dashboard
   - Find your project
   - Click "Redeploy" or trigger a new deployment
   - Or delete and redeploy the project

3. **Clear browser cache:**
   - Hard refresh the deployed site (Ctrl+F5 or Cmd+Shift+R)
   - Or open in incognito/private mode

### Alternative: Manual Deployment

If you're using a different deployment method:

1. **Upload the `/dist` folder contents** to your hosting platform
2. **Ensure all files are uploaded** including:**
   - `manifest.json`
   - `logo.png`
   - `favicon.png`
   - All icon files (`icon-*.png`)

## Verification Steps

### After Deployment:

1. **Check the deployed manifest:**
   - Visit: `https://your-domain.com/manifest.json`
   - Verify all icon URLs have `?v=2` parameter

2. **Test PWA installation:**
   - Open the deployed site
   - Look for the install prompt
   - Verify your custom logo appears (not the bird logo)

3. **Clear browser cache if needed:**
   - The cache-busting should force new downloads
   - If still showing old logo, clear browser cache completely

## Troubleshooting

### If the issue persists:

1. **Check file accessibility:**
   - Ensure `/logo.png` is accessible at the deployed URL
   - Test: `https://your-domain.com/logo.png`

2. **Verify manifest:**
   - Check: `https://your-domain.com/manifest.json`
   - All icon URLs should have `?v=2`

3. **Force cache clear:**
   - Add a different version number (e.g., `?v=3`)
   - Update all references and redeploy

### Browser-Specific Issues:

- **Chrome/Edge**: Clear site data in DevTools
- **Safari**: Clear website data in Settings
- **Mobile**: Uninstall and reinstall the PWA

## Expected Result

After deployment, your PWA should show:
- ✅ Your custom logo in the installation prompt
- ✅ Your custom logo in the browser tab
- ✅ Your custom logo when the app is installed
- ✅ Consistent branding across all platforms

## Files to Verify

Ensure these files are correctly deployed:
- `/manifest.json` (with cache-busted icon URLs)
- `/logo.png` (your custom logo)
- `/favicon.png` (your custom logo)
- `/icon-*.png` (all icon sizes)
- `/index.html` (with cache-busted links)

The cache-busting parameters (`?v=2`) will force browsers to download the updated files instead of using cached versions.
