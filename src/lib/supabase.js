import { createClient } from '@supabase/supabase-js'

// Sæt disse værdier ind fra dit Supabase projekt (Settings → API)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://DIN-PROJEKT-ID.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'din-anon-key-her'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
