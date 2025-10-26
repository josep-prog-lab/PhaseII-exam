// Test Supabase Connection
// Run with: node test-connection.js

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tifytikdzembawmgggij.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'your-anon-key-here';

console.log('🔍 Testing Supabase Connection...');
console.log('URL:', SUPABASE_URL);
console.log('Key:', SUPABASE_KEY.substring(0, 20) + '...');

async function testConnection() {
  try {
    // Test basic connectivity
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Supabase connection successful!');
      
      // Test storage bucket
      const storageResponse = await fetch(`${SUPABASE_URL}/storage/v1/buckets`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      if (storageResponse.ok) {
        const buckets = await storageResponse.json();
        const examBucket = buckets.find(b => b.id === 'exam-recordings');
        
        if (examBucket) {
          console.log('✅ exam-recordings bucket found');
          console.log('   Size limit:', (examBucket.file_size_limit / (1024 * 1024 * 1024)).toFixed(2) + 'GB');
          console.log('   MIME types:', examBucket.allowed_mime_types.join(', '));
        } else {
          console.log('❌ exam-recordings bucket not found');
        }
      } else {
        console.log('❌ Storage API not accessible');
      }
      
    } else {
      console.log('❌ Supabase connection failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.log('❌ Connection error:', error.message);
  }
}

testConnection();
