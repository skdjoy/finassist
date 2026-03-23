// Set required env vars before any module is imported, so Supabase client
// can initialize without throwing "supabaseUrl is required".
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "placeholder-service-key";
process.env.ANTHROPIC_API_KEY = "placeholder-anthropic-key";
