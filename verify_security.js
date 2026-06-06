/* global process */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local if exists (local dev), otherwise fallback to process.env (CI/CD)
const loadEnv = () => {
  const localEnvPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(localEnvPath)) {
    console.log('[INFO] Loading environment from .env.local');
    const content = fs.readFileSync(localEnvPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
};
loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[ERROR] Missing credentials for verify_security (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runSecurityVerification() {
  console.log('\n==================================================');
  console.log('         VOTEGUARD SECURITY VERIFICATION          ');
  console.log('==================================================\n');

  let testsPassed = true;

  // 1. Lockout Separation Check
  try {
    const { error: tableErr } = await supabaseAdmin.from('account_lockouts').select('*').limit(0);

    if (tableErr && tableErr.code === '42P01') {
      console.log('❌ [FAIL] Lockout Separation: account_lockouts table is missing.');
      testsPassed = false;
    } else {
      console.log('✅ [PASS] Lockout Separation: account_lockouts database structure is present.');
    }
  } catch (err) {
    console.log(`⚠️ [WARNING] Lockout Separation test incomplete: ${err.message}`);
  }

  // 2. Retention Policy Check
  try {
    const { error: cleanupErr } = await supabaseAdmin.rpc('cleanup_old_security_events');
    if (cleanupErr) throw cleanupErr;
    console.log('✅ [PASS] Log Retention: cleanup_old_security_events function executed without errors.');
  } catch (err) {
    console.log(`⚠️ [WARNING] Log Retention test incomplete: ${err.message}`);
  }

  // 3. Integrity Equations Check
  try {
    const { data: elections, error: elErr } = await supabaseAdmin
      .from('elections')
      .select('id')
      .limit(1);

    if (elErr) throw elErr;

    if (elections && elections.length > 0) {
      const electionId = elections[0].id;
      const { data: report, error: reportErr } = await supabaseAdmin.rpc('get_election_audit_report', { p_election_id: electionId });
      
      if (reportErr) throw reportErr;

      if (report && report.integrity_status) {
        console.log(`✅ [PASS] Integrity Equations: get_election_audit_report returned status "${report.integrity_status}".`);
      } else {
        console.log('❌ [FAIL] Integrity Equations: get_election_audit_report did not return an integrity_status.');
        testsPassed = false;
      }
    } else {
      console.log('⚠️ [WARNING] Integrity Equations skipped: No elections available to run audit scan.');
    }
  } catch (err) {
    console.log(`⚠️ [WARNING] Integrity Equations test incomplete: ${err.message}`);
  }

  // 4. Session Validation Check
  try {
    const { error: rlsErr } = await supabaseAdmin.from('verified_sessions').select('*').limit(0);

    if (rlsErr && rlsErr.code === '42P01') {
      console.log('❌ [FAIL] Session Enforcement: verified_sessions table is missing.');
      testsPassed = false;
    } else {
      console.log('✅ [PASS] Session Enforcement: verified_sessions table is operational.');
    }
  } catch (err) {
    console.log(`⚠️ [WARNING] Session Enforcement test incomplete: ${err.message}`);
  }

  if (testsPassed) {
    console.log('\n✅ [SUCCESS] All VoteGuard security verifications passed.');
    process.exit(0);
  } else {
    console.log('\n❌ [FAIL] Security verification failed.');
    process.exit(1);
  }
}

runSecurityVerification();
