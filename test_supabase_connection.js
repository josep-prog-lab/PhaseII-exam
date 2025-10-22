// Test Supabase Connection
// Run this with: node test_supabase_connection.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tifytikdzembawmgggij.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZnl0aWtkemVtYmF3bWdnZ2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMzY0NTksImV4cCI6MjA3NjYxMjQ1OX0.CZRhCrMnH2aM_tWFb80lsCZelOnuN-lNFMkRQcFZKZ0';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test 1: Check if we can connect
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase.from('exams').select('id').limit(1);
    
    if (error) {
      console.error('Connection test failed:', error);
      return;
    }
    
    console.log('✅ Basic connection successful');
    
    // Test 2: Try to insert a candidate session (this should fail with current RLS)
    console.log('2. Testing candidate session insertion...');
    const { data: sessionData, error: sessionError } = await supabase
      .from('candidate_sessions')
      .insert({
        exam_id: 'test-exam-id',
        full_name: 'Test User',
        email: 'test@example.com',
        contact: '1234567890',
        exam_location: 'home',
        consent_given: true
      })
      .select()
      .single();
    
    if (sessionError) {
      console.log('❌ Candidate session insertion failed (expected):', sessionError.message);
      console.log('   This confirms the RLS policy issue needs to be fixed.');
    } else {
      console.log('✅ Candidate session insertion successful');
      // Clean up test data
      await supabase.from('candidate_sessions').delete().eq('id', sessionData.id);
    }
    
  } catch (err) {
    console.error('Test failed with error:', err);
  }
}

testConnection();

