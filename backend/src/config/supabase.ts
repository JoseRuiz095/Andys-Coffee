import { createClient } from '@supabase/supabase-js';

// Asumimos que tienes un archivo para gestionar variables de entorno.
// Si no, puedes usar `process.env.SUPABASE_URL`.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);