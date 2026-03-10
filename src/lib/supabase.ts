import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client for the browser (uses Anon Key)
export const supabaseBrowserClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
);

// Client for the server/admin (uses Service Role Key to bypass RLS for inserts)
export const getSupabaseAdminClient = () => {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';
    return createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey);
};
