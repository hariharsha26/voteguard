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

    // Initialize admin/service client
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Fetch production lock status from system_settings
    const { data: prodLockSetting } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'production_lock')
      .maybeSingle()

    const isProductionLockActive = prodLockSetting?.value === 'true'
    const appEnv = Deno.env.get('APP_ENV') || 'development'
    const isProd = isProductionLockActive || appEnv === 'production'

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
      .select('roll_number, email, full_name')
      .eq('auth_user_id', user.id)
      .single()

    if (voterError || !voter) {
      return new Response(
        JSON.stringify({ error: 'Voter profile not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Block test account logins/token requests if production lock is active
    if (isProd) {
      if (voter.roll_number === '25L35A4416' || voter.email === 'hariharshahello@gmail.com') {
        return new Response(
          JSON.stringify({ error: 'Development test accounts are disabled under production lock.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 5. Fetch election details
    const { data: election, error: elError } = await supabaseClient
      .from('elections')
      .select('election_code, status, election_name')
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

    // 9. Send Email Dispatch
    let emailStatus = 'delivered'
    let emailError = ''

    if (isProd) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
      const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@resend.dev'
      const resendFromName = Deno.env.get('RESEND_FROM_NAME') || 'VoteGuard'

      if (!resendApiKey) {
        emailStatus = 'failed'
        emailError = 'RESEND_API_KEY environment variable is missing.'
        console.error(emailError)
      } else {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: `${resendFromName} <${resendFromEmail}>`,
              to: voter.email,
              subject: `VoteGuard Voting Token – ${election.election_name}`,
              text: `Hello ${voter.full_name},\n\nYour voting token for ${election.election_name} has been generated.\n\nVoting Token:\n\n${plainToken}\n\nThis token is confidential and may only be used once.\n\nDo not share this token with anyone.\n\nVoteGuard Election System`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; line-height: 1.6; color: #333;">
                  <p>Hello <strong>${voter.full_name}</strong>,</p>
                  <p>Your voting token for <strong>${election.election_name}</strong> has been generated.</p>
                  <p>Voting Token:</p>
                  <div style="background: #f7f7f7; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; border: 1px dashed #4a9d8f; letter-spacing: 1px; color: #333;">
                    ${plainToken}
                  </div>
                  <p>This token is confidential and may only be used once.</p>
                  <p>Do not share this token with anyone.</p>
                  <p style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; font-size: 14px; color: #555; font-weight: 550;">
                    VoteGuard Election System
                  </p>
                </div>
              `
            })
          })

          if (!emailResponse.ok) {
            const errText = await emailResponse.text()
            emailStatus = 'failed'
            emailError = `Resend API Error: ${errText}`
            console.error(emailError)
          }
        } catch (e) {
          emailStatus = 'failed'
          emailError = e instanceof Error ? e.message : 'Unknown email transmission error'
          console.error(emailError)
        }
      }

      // Log email delivery log (privacy-first)
      await supabaseAdmin.from('email_delivery_logs').insert({
        recipient_identifier: voter.roll_number,
        delivery_type: 'TOKEN_EMAIL',
        status: emailStatus,
        error_message: emailError ? emailError : null
      })

    } else {
      // In development mode, simulate dispatch
      console.log(`[EMAIL DISPATCH] Sent VoteGuard Secure Voting Token to ${voter.email}. Token: ${plainToken}`)
      
      await supabaseAdmin.from('email_delivery_logs').insert({
        recipient_identifier: voter.roll_number,
        delivery_type: 'TOKEN_EMAIL',
        status: 'delivered'
      })
    }

    // Insert audit log
    await supabaseAdmin.from('audit_logs').insert({
      event_type: 'Token Delivered',
      actor: voter.roll_number,
      details: isProd 
        ? 'Secure token dispatched via real Resend email channel.' 
        : 'Secure token dispatched via simulated email channel successfully.'
    })

    // Return the generated plain token ONLY in development mode (isProd === false)
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token generated and sent successfully.',
        token: isProd ? null : plainToken
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
