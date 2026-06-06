/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  // Validate required client environment variables exist
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_APP_ENV'
  ];

  const missing = [];
  requiredVars.forEach(v => {
    const val = env[v] || process.env[v];
    if (!val) {
      missing.push(v);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `\n\n[VoteGuard Config Error] Missing critical client environment variables: ${missing.join(', ')}\n` +
      `Please ensure these are defined in your environment or .env file.\n\n`
    );
  }

  return {
    plugins: [react()],
  }
})
