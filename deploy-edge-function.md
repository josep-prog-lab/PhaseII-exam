# Deploy Google Drive Upload Edge Function

## Prerequisites

1. **Supabase CLI installed**: `npm install -g supabase`
2. **Supabase project linked**: `supabase link --project-ref YOUR_PROJECT_REF`
3. **Google Drive Service Account** with Drive API access

## Step 1: Set up Google Drive Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Drive API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Give it a name like "exam-space-drive-uploader"
   - Grant it "Editor" role or create custom role with Drive permissions
5. Create and download the JSON key file
6. Create a folder in Google Drive for exam recordings
7. Share the folder with the service account email (give "Editor" access)

## Step 2: Set Environment Variables in Supabase

In your Supabase dashboard, go to Settings > Edge Functions and add these secrets:

```bash
# Set the service account JSON (replace with your actual JSON)
supabase secrets set GDRIVE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'

# Set the Google Drive folder ID (get from the folder URL)
supabase secrets set GDRIVE_FOLDER_ID='your-folder-id-here'
```

## Step 3: Deploy the Edge Function

```bash
# Deploy the function
supabase functions deploy upload-to-drive

# Verify deployment
supabase functions list
```

## Step 4: Test the Function

You can test the function using curl:

```bash
# Test with a small file
curl -X POST \
  -F "file=@test-file.txt" \
  -F "candidateName=Test Candidate" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/upload-to-drive \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Step 5: Update Environment Variables

Make sure your frontend has the correct Supabase URL:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

## Troubleshooting

### 404 Error
- Make sure the function is deployed: `supabase functions list`
- Check the function name matches exactly: `upload-to-drive`
- Verify the URL format: `https://PROJECT_REF.supabase.co/functions/v1/upload-to-drive`

### 500 Error
- Check the secrets are set: `supabase secrets list`
- Verify the service account JSON is valid
- Check the Google Drive folder ID is correct
- Ensure the service account has access to the folder

### Database Errors
- Run the migration: Execute the SQL in `supabase/migrations/20250122000000_add_recording_drive_file_id.sql`
- Check that the `recording_drive_file_id` column exists in `candidate_sessions` table
