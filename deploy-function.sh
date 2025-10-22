#!/bin/bash

# Deploy Google Drive Upload Edge Function
# Make sure you have Supabase CLI installed and are logged in

echo "🚀 Deploying Google Drive Upload Edge Function..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory. Please run this from the project root."
    exit 1
fi

# Deploy the function
echo "📦 Deploying upload-to-drive function..."
supabase functions deploy upload-to-drive

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
    echo ""
    echo "🔧 Next steps:"
    echo "1. Set your environment variables in Supabase dashboard:"
    echo "   - GDRIVE_SERVICE_ACCOUNT_JSON"
    echo "   - GDRIVE_FOLDER_ID"
    echo ""
    echo "2. Run the database migration:"
    echo "   Execute the SQL in supabase/migrations/20250122000000_add_recording_drive_file_id.sql"
    echo ""
    echo "3. Test the function:"
    echo "   Check the Supabase dashboard > Edge Functions"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi
