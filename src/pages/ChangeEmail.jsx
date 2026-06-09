import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ThemeToggle from '../components/ThemeToggle';
import LogoMark from '../components/LogoMark';
import OtpInput from '../components/OtpInput';
import { IconArrowLeft, IconMail, IconLock, IconAlertCircle } from '@tabler/icons-react';
import '../styles/voter-auth.css'; // Leverage existing auth page layout classes

export default function ChangeEmail() {
  const navigate = useNavigate();
  
  // Step/View state: 'form' | 'otp' | 'success' | 'loading'
  const [step, setStep] = useState('form'); 
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Form states
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setConfirmNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // OTP verification states
  const [requestId, setRequestId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);

  // Load current voter's email on mount
  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/voter-auth');
        return;
      }
      setCurrentEmail(session.user.email || '');
    };
    fetchUserEmail();
  }, [navigate]);

  // Handle Cooldown countdown
  useEffect(() => {
    if (cooldownTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setCooldownTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownTimeLeft]);

  // Step 1: Request Email Change (Re-authenticate & generate OTP)
  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    // Validations
    if (!newEmail.trim() || !confirmNewEmail.trim() || !password) {
      setErrorMsg('Please fill out all fields.');
      return;
    }
    
    if (newEmail.trim().toLowerCase() !== confirmNewEmail.trim().toLowerCase()) {
      setErrorMsg('New emails do not match.');
      return;
    }
    
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setErrorMsg('New email must be different from current email.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setErrorMsg('Invalid new email format.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Re-authenticating security credentials...');

    try {
      // 1. Re-authenticate user using current credentials to verify password
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: password,
      });

      if (reauthError) {
        // Log failure to audit logs
        await supabase.rpc('log_email_change_failure', {
          p_email: currentEmail,
          p_reason: 'Password re-authentication failed'
        });
        setErrorMsg('Authentication failed: Incorrect password.');
        setLoading(false);
        return;
      }

      setLoadingMessage('Initializing cryptographic change ticket...');

      // 2. Call RPC to request email change (generates OTP, hashes, and stores request)
      const { data, error: requestError } = await supabase.rpc('request_email_change', {
        p_new_email: newEmail.trim().toLowerCase()
      });

      if (requestError) {
        setErrorMsg(requestError.message || 'Failed to request email change.');
        setLoading(false);
        return;
      }

      setRequestId(data.request_id);

      // Check if debug mode / dev mode is active to fetch OTP locally
      const { data: dbgOtp } = await supabase.rpc('get_debug_email_change_otp', {
        p_request_id: data.request_id
      });
      if (dbgOtp) {
        setDebugOtp(dbgOtp);
      } else {
        setDebugOtp('');
      }

      // Proceed to Step 2 (OTP Input)
      setStep('otp');
    } catch (err) {
      console.error('Request email change error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP & execute the actual email change
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setVerificationError('');

    if (otpCode.length < 6) {
      setVerificationError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Verifying security token...');

    try {
      // 1. Verify OTP via Database RPC
      const { error: verifyError } = await supabase.rpc('verify_email_change_otp', {
        p_request_id: requestId,
        p_otp: otpCode
      });

      if (verifyError) {
        // Check if verifyError was due to lockout cooldown
        if (verifyError.message.includes('Cooldown')) {
          setCooldownTimeLeft(900); // 15 mins
        }
        setVerificationError(verifyError.message || 'Invalid or expired verification code.');
        setLoading(false);
        return;
      }

      setLoadingMessage('Synchronizing credentials on the ledger...');

      // 2. Update Supabase Auth email (performs the secure update)
      const { error: authUpdateError } = await supabase.auth.updateUser({
        email: newEmail.trim().toLowerCase()
      });

      if (authUpdateError) {
        setVerificationError('Auth update failed: ' + authUpdateError.message);
        setLoading(false);
        return;
      }

      setLoadingMessage('Sealing transaction details...');

      // 3. Finalize change in voter profile table and delete request
      const { error: finalizeError } = await supabase.rpc('finalize_email_change', {
        p_request_id: requestId
      });

      if (finalizeError) {
        setVerificationError('Profile sync failed: ' + finalizeError.message);
        setLoading(false);
        return;
      }

      setStep('success');
      setLoadingMessage('Wiping secure session footprint...');

      // 4. Force invalidate session & logout after 2 seconds
      setTimeout(async () => {
        try {
          await supabase.rpc('handle_logout');
          await supabase.auth.signOut();
        } catch (logoutErr) {
          console.error('Logout error during cleanup:', logoutErr);
        }
        navigate('/voter-auth');
      }, 2500);

    } catch (err) {
      console.error('Verify OTP error:', err);
      setVerificationError(err.message || 'An unexpected verification error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voter-auth-page">
      <div className="auth-wrap">
        
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="left-inner">
            <div className="left-logo" onClick={() => navigate('/voter')} style={{ cursor: 'pointer' }}>
              <LogoMark size={14} />
              <span className="logo-name">VoteGuard</span>
            </div>

            <div className="left-illustration">
              <svg className="illus-svg" viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="change-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="420" height="320" fill="url(#change-grid)" rx="12"/>

                {/* Secure mail transaction visual */}
                <rect x="135" y="100" width="150" height="110" rx="10" fill="rgba(74,157,143,0.08)" stroke="rgba(74,157,143,0.3)" strokeWidth="1.5"/>
                <path d="M145 120 L210 160 L275 120" stroke="rgba(74,157,143,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="210" cy="155" r="30" fill="rgba(8,10,13,0.9)" stroke="#4a9d8f" strokeWidth="2"/>
                <path d="M200 155 l7 7 13-13" stroke="#4a9d8f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h1 className="left-headline">Secure Account<br/>Control &amp; Trust.</h1>
            <p className="left-desc">Your credentials represent your voting signature. Email updates require verified authentication, token checks, and ledger logging to guarantee identity security.</p>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div style={{ position: 'absolute', top: '24px', right: '32px', zIndex: 10 }}>
            <ThemeToggle />
          </div>

          <div className="auth-card">
            
            {/* LOADING OVERLAY */}
            {loading && (
              <div style={{ padding: '40px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div className="secure-loading-spinner" />
                <div style={{ fontSize: '15px', fontWeight: '650', color: 'var(--text)' }}>Cryptographic Lock active</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{loadingMessage}</div>
              </div>
            )}

            {/* FORM VIEW (STEP 1) */}
            {!loading && step === 'form' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => navigate('/voter')}>
                  <IconArrowLeft size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Back to Profile
                </div>
                
                <div className="card-title">Change Email Address</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>
                  A verification security token will be dispatched to your new destination email.
                </div>

                {errorMsg && (
                  <div className="error-banner show" style={{ marginBottom: 16, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconAlertCircle size={16} />
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleRequestEmailChange}>
                  <div className="field">
                    <label>CURRENT EMAIL</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="email" 
                        value={currentEmail} 
                        readOnly 
                        className="preview-readonly-input"
                        style={{ paddingLeft: '36px', opacity: 0.7 }}
                      />
                      <IconMail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="new-email">NEW EMAIL ADDRESS</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="new-email"
                        type="email" 
                        placeholder="new-email@institution.edu" 
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        style={{ paddingLeft: '36px' }}
                      />
                      <IconMail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="confirm-email">CONFIRM NEW EMAIL</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="confirm-email"
                        type="email" 
                        placeholder="Repeat new email address" 
                        value={confirmNewEmail}
                        onChange={(e) => setConfirmNewEmail(e.target.value)}
                        required
                        style={{ paddingLeft: '36px' }}
                      />
                      <IconMail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="current-password">CURRENT PASSWORD</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="current-password"
                        type="password" 
                        placeholder="Enter account password to verify" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ paddingLeft: '36px' }}
                      />
                      <IconLock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    </div>
                  </div>

                  <button type="submit" className="btn-main" style={{ marginTop: '20px' }}>
                    Send Verification OTP
                  </button>
                </form>
              </div>
            )}

            {/* OTP VERIFICATION VIEW (STEP 2) */}
            {!loading && step === 'otp' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => setStep('form')}>
                  <IconArrowLeft size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Back
                </div>

                <div className="card-title">Verify New Email</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>
                  Please enter the 6-digit security OTP sent to <strong>{newEmail}</strong>.
                </div>

                {verificationError && (
                  <div className="error-banner show" style={{ marginBottom: 16, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconAlertCircle size={16} />
                    {verificationError}
                  </div>
                )}

                {debugOtp && (
                  <div className="info-banner show" style={{ marginBottom: 16, padding: '10px', background: 'rgba(74, 157, 143, 0.1)', border: '1px solid rgba(74, 157, 143, 0.3)', borderRadius: '6px', fontSize: '12.5px', color: 'var(--teal)', fontWeight: '600', textAlign: 'center' }}>
                    Development Mode: Use verification code <strong>{debugOtp}</strong>
                  </div>
                )}

                {cooldownTimeLeft > 0 ? (
                  <div className="error-banner show" style={{ marginBottom: 16, fontSize: '13px' }}>
                    Verification locked. Cooldown active for {Math.ceil(cooldownTimeLeft / 60)} minutes.
                  </div>
                ) : (
                  <form onSubmit={handleVerifyOtp}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' }}>
                      Security OTP Code
                    </div>
                    <OtpInput onChange={setOtpCode} />

                    <button type="submit" className="btn-main" style={{ marginTop: '24px' }}>
                      Verify &amp; Change Email
                    </button>
                    
                    <button type="button" className="btn-ghost" onClick={() => setStep('form')}>
                      Cancel Change
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* SUCCESS VIEW */}
            {!loading && step === 'success' && (
              <div className="form-view active" style={{ textAlign: 'center', padding: '30px 10px' }}>
                <div className="secure-success-checkmark animate-scale-up" style={{ margin: '0 auto 20px' }}>
                  <svg viewBox="0 0 52 52" style={{ width: '54px', height: '54px' }}>
                    <circle cx="26" cy="26" r="25" fill="none" stroke="var(--teal)" strokeWidth="3" />
                    <path fill="none" stroke="var(--teal)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                </div>
                <div className="card-title">Email Updated Successfully</div>
                <div className="card-sub" style={{ fontSize: '13.5px', lineHeight: '1.5' }}>
                  Your cryptographic voting signature has been updated. The current session is being terminated for security reasons.
                </div>
                <div style={{ marginTop: '20px', fontSize: '12.5px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                  Redirecting to login portal...
                </div>
              </div>
            )}

          </div>

          <div className="auth-footer">
            <a href="#">Security Protocol</a>
            <a href="#">Privacy policy</a>
            <a href="#">Support tickets</a>
          </div>
        </div>

      </div>
    </div>
  );
}
