import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
// Storage writes need the service-role key: the anon key is public by design, and the
// bucket's RLS policies (correctly) do not allow anonymous inserts. The service-role key
// must only ever live in backend/.env — never in the frontend.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey = serviceRoleKey || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be provided.');
}

if (!serviceRoleKey) {
  logger.warn('SUPABASE_SERVICE_ROLE_KEY is not set: product image uploads will be rejected by Storage RLS.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
