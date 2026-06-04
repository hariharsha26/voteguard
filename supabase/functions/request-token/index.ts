// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}



Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No Authorization header found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Initialize Supabase user client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    })

    // 2. Fetch authenticated user details
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { election_id } = await req.json()
    if (!election_id) {
      return new Response(
        JSON.stringify({ error: 'Missing election_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Check if standard voter session is verified (OTP verified check)
    const { data: isVerified, error: sessionError } = await supabaseClient.rpc('is_session_verified')
    if (sessionError || !isVerified) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized session. Please complete OTP verification first.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Fetch voter profile details
    const { data: voter, error: voterError } = await supabaseClient
      .from('voters')
      .select('roll_number, email')
      .eq('auth_user_id', user.id)
      .single()

    if (voterError || !voter) {
      return new Response(
        JSON.stringify({ error: 'Voter profile not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Fetch election details
    const { data: election, error: elError } = await supabaseClient
      .from('elections')
      .select('election_code, status')
      .eq('id', election_id)
      .single()

    if (elError || !election) {
      return new Response(
        JSON.stringify({ error: 'Election not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Fetch college code setting (from system_settings, default to 'L35')
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('value')
      .eq('key', 'college_code')
      .single()

    const collegeCode = settings?.value || 'L35'

    // 7. Generate a secure random string (14 characters uppercase alphanumeric)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let randomString = ''
    const randomValues = new Uint32Array(14)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < 14; i++) {
      randomString += chars[randomValues[i] % chars.length]
    }

    // Build the plain token
    const plainToken = `${collegeCode}-${election.election_code}-${randomString}`

    // Hash token with SHA-256
    const msgBuffer = new TextEncoder().encode(plainToken)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // 8. Commit token hash to database
    // We execute the commit via supabaseClient using voter's JWT
    const { error: rpcError } = await supabaseClient.rpc('request_election_token', {
      p_election_id: election_id,
      p_token_hash: tokenHash
    })

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Validation failed during token request commit.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. Send Email Dispatch Simulation
    // Log plaintext token locally only (for local DX/dev logs)
    console.log(`[EMAIL DISPATCH] Sent VoteGuard Secure Voting Token to ${voter.email}. Token: ${plainToken}`)

    // Create an admin/service client to insert audit log for 'Token Delivered'
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    await supabaseAdmin.from('audit_logs').insert({
      event_type: 'Token Delivered',
      actor: voter.roll_number,
      details: 'Secure token dispatched via simulated email channel successfully.'
    })

    // Return the generated plain token in the response so the frontend can display it in debug mode
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token generated and sent successfully.',
        token: plainToken
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

