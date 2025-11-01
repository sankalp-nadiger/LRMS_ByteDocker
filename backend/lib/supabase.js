import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify connection
const verifyConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('land_records')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
    } else {
      console.log('✅ Supabase connected successfully');
      console.log(`📍 URL: ${supabaseUrl}`);
    }
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
  }
};

// Call verification on module load
verifyConnection();