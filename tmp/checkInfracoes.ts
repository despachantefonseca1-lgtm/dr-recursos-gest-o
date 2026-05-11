import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tgybgghrleimeujjtbvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneWJnZ2hybGVpbWV1amp0YnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDkxNDQsImV4cCI6MjA4MjkyNTE0NH0.2TSCZpgijxF7ICzMOTN0BRj6qX6RjKVMegOJW9T9qFk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from('infracoes')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  console.log('Infracoes keys:', Object.keys(data[0] || {}));
}

main();
