
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tgybgghrleimeujjtbvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneWJnZ2hybGVpbWV1amp0YnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDkxNDQsImV4cCI6MjA4MjkyNTE0NH0.2TSCZpgijxF7ICzMOTN0BRj6qX6RjKVMegOJW9T9qFk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    const email = 'ifadvogado214437@gmail.com';
    const password = 'Lcj133028';

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('Error signing up:', error.message);
    } else {
        console.log('User signed up successfully:', data.user?.id);
    }
}

createAdmin();
