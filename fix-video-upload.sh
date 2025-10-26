#!/bin/bash

echo "🔧 Video Upload Fix Setup Script"
echo "================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Supabase Configuration - REPLACE WITH YOUR ACTUAL VALUES
VITE_SUPABASE_URL=https://tifytikdzembawmgggij.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here
VITE_SUPABASE_FUNCTIONS_URL=https://tifytikdzembawmgggij.supabase.co/functions/v1

# Google Drive Configuration (Optional - for direct client upload)
VITE_GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
EOF
    echo "✅ .env file created. Please update with your actual Supabase credentials."
else
    echo "✅ .env file already exists."
fi

echo ""
echo "📋 Next Steps:"
echo "1. Update .env file with your actual Supabase URL and anon key"
echo "2. Run the storage fix SQL script in your Supabase dashboard:"
echo "   - Go to SQL Editor in Supabase dashboard"
echo "   - Copy and paste the contents of apply_storage_fix.sql"
echo "   - Execute the script"
echo ""
echo "3. Deploy the Google Drive Edge Function:"
echo "   supabase functions deploy upload-to-drive --no-verify-jwt"
echo ""
echo "4. Set Google Drive secrets:"
echo "   supabase secrets set GDRIVE_FOLDER_ID=your-folder-id"
echo "   supabase secrets set GDRIVE_SERVICE_ACCOUNT_JSON='$(cat examspace-storage.json)'"
echo ""
echo "5. Share your Google Drive folder with: examspace-bot@response-dashboard-475713.iam.gserviceaccount.com"
echo ""
echo "6. Restart your development server:"
echo "   npm run dev"
echo ""
echo "🎯 The video upload should now work with proper error handling and fallback mechanisms!"
