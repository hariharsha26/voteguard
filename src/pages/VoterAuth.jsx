import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import OtpInput from '../components/OtpInput';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/voter-auth.css';
import { IconMail, IconDeviceMobile } from '@tabler/icons-react';
import { supabase } from '../lib/supabaseClient';

export default function VoterAuth() {
  const [view, setView] = useState('login'); // 'login' | 'register' | 'otp' | 'forgot'
  const [otpChannel, setOtpChannel] = useState('email'); // 'email' | 'phone'
  const [otpState, setOtpState] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'verifying' | 'success'
  const [otpProgressMessage, setOtpProgressMessage] = useState('');
  
  // Registration States
  const [regFullName, setRegFullName] = useState('');
  const [regRollNumber, setRegRollNumber] = useState('');
  const [regDept, setRegDept] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);

  // Login States
  const [loginRollNumber, setLoginRollNumber] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // OTP Verification States
  const [otpInputCode, setOtpInputCode] = useState('');
  const [debugOtpCode, setDebugOtpCode] = useState('');
  const [verificationError, setVerificationError] = useState('');

  // Forgot/Reset Password States
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Listen for password recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    if (!loginRollNumber || !loginPassword) {
      setLoginError('Please enter both Roll Number and Password.');
      return;
    }

    setLoginLoading(true);
    try {
      // 1. Look up email by roll number in voters table
      const { data: voter, error: lookupError } = await supabase
        .from('voters')
        .select('email')
        .eq('roll_number', loginRollNumber.trim().toUpperCase())
        .single();

      if (lookupError || !voter) {
        setLoginError('Invalid Roll Number or Password.');
        setLoginLoading(false);
        return;
      }

      // 2. Sign in with password using retrieved email
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: voter.email,
        password: loginPassword,
      });

      if (authError) {
        setLoginError('Invalid Roll Number or Password.');
        setLoginLoading(false);
        return;
      }

      setView('otp');
      setOtpState('idle');
    } catch (err) {
      setLoginError('An unexpected authentication error occurred.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setRegisterError('');
    if (!regFullName || !regRollNumber || !regDept || !regEmail || !regPassword) {
      setRegisterError('Please fill out all required fields.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegisterError('Passwords do not match.');
      return;
    }

    setRegisterLoading(true);
    try {
      // Create user and profile via DB triggers
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: {
            roll_number: regRollNumber.trim().toUpperCase(),
            full_name: regFullName.trim(),
            department: regDept.trim().toUpperCase(),
            phone_number: regPhone.trim()
          }
        }
      });

      if (signUpError) {
        setRegisterError(signUpError.message);
        setRegisterLoading(false);
        return;
      }

      if (!data.user) {
        setRegisterError('Registration failed. Try again.');
        setRegisterLoading(false);
        return;
      }

      setView('otp');
      setOtpState('idle');
    } catch (err) {
      setRegisterError('An unexpected registration error occurred.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    setVerificationError('');
    setOtpState('sending');
    setOtpProgressMessage('Preparing secure verification channel...');

    try {
      const { data, error: otpError } = await supabase.rpc('generate_login_otp');

      if (otpError) {
        setOtpState('idle');
        setVerificationError(otpError.message);
        return;
      }

      const { debug_otp } = data[0] || {};
      if (debug_otp) {
        setDebugOtpCode(debug_otp);
      }

      setOtpState('sent');
    } catch (err) {
      setOtpState('idle');
      setVerificationError('Failed to dispatch verification code.');
    }
  };

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    setVerificationError('');
    setOtpState('verifying');
    setOtpProgressMessage('Authenticating verification token...');

    try {
      const { error: verifyError } = await supabase.rpc('verify_login_otp', {
        p_otp_code: otpInputCode
      });

      if (verifyError) {
        setOtpState('sent');
        setVerificationError(verifyError.message);
        return;
      }

      setOtpState('success');
      setOtpProgressMessage('Verification successful. Redirecting...');
      setTimeout(() => {
        navigate('/voter');
      }, 1000);
    } catch (err) {
      setOtpState('sent');
      setVerificationError('Authentication integrity check failed.');
    }
  };

  const handleSendRecoveryEmail = async (e) => {
    if (e) e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: window.location.origin + '/voter-auth',
      });

      if (error) {
        setForgotError(error.message);
      } else {
        setForgotSuccess('Recovery link sent successfully. Please check your email.');
      }
    } catch (err) {
      setForgotError('An unexpected error occurred.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setResetError('');
    if (!resetPassword) {
      setResetError('Please enter a new password.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: resetPassword,
      });

      if (error) {
        setResetError(error.message);
      } else {
        setResetSuccess(true);
        setTimeout(() => {
          setView('login');
          setResetSuccess(false);
          setResetPassword('');
          setResetConfirmPassword('');
        }, 3000);
      }
    } catch (err) {
      setResetError('Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="voter-auth-page">
      <div className="auth-wrap">
        
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="left-inner">
            <div className="left-logo">
              <LogoMark size={14} />
              <span className="logo-name">VoteGuard</span>
            </div>

            <div className="left-illustration">
              <svg className="illus-svg" viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background grid */}
                <defs>
                  <pattern id="voter-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="420" height="320" fill="url(#voter-grid)" rx="12"/>

                {/* Ballot box central */}
                <rect x="155" y="100" width="110" height="130" rx="10" fill="rgba(74,157,143,0.08)" stroke="rgba(74,157,143,0.3)" strokeWidth="1.5"/>
                <rect x="185" y="90" width="50" height="20" rx="5" fill="rgba(74,157,143,0.15)" stroke="rgba(74,157,143,0.4)" strokeWidth="1"/>
                {/* Slot */}
                <rect x="193" y="97" width="34" height="4" rx="2" fill="rgba(74,157,143,0.5)"/>
                {/* Ballot entering */}
                <rect x="175" y="68" width="70" height="40" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                <line x1="185" y1="80" x2="235" y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
                <line x1="185" y1="88" x2="220" y2="88" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
                {/* Check mark on ballot */}
                <path d="M237 76 L241 81 L248 72" stroke="#4a9d8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

                {/* Lock icon top right */}
                <rect x="320" y="40" width="54" height="54" rx="12" fill="rgba(212,168,67,0.08)" stroke="rgba(212,168,67,0.2)" strokeWidth="1"/>
                <rect x="334" y="63" width="26" height="20" rx="4" fill="none" stroke="#d4a843" strokeWidth="1.5"/>
                <path d="M339 63 v-5 a8 8 0 0 1 16 0 v5" fill="none" stroke="#d4a843" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="347" cy="72" r="2.5" fill="#d4a843" opacity="0.7"/>

                {/* Shield icon bottom left */}
                <rect x="46" y="200" width="54" height="54" rx="12" fill="rgba(74,157,143,0.08)" stroke="rgba(74,157,143,0.2)" strokeWidth="1"/>
                <path d="M73 212 L58 217 v8 c0 8 6 14 15 16 9-2 15-8 15-16 v-8 z" fill="none" stroke="#4a9d8f" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M66 225 l4 4 7-8" stroke="#4a9d8f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>

                {/* Audit line items */}
                <rect x="46" y="90" width="90" height="80" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                <text x="58" y="108" fontFamily="IBM Plex Mono" fontSize="7" fill="rgba(74,157,143,0.7)">AUDIT LOG</text>
                <rect x="58" y="113" width="65" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
                <rect x="58" y="124" width="50" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <rect x="58" y="135" width="60" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
                <rect x="58" y="146" width="40" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <circle cx="54" cy="116" r="2.5" fill="#4a9d8f" opacity="0.6"/>
                <circle cx="54" cy="127" r="2.5" fill="#4a9d8f" opacity="0.6"/>
                <circle cx="54" cy="138" r="2.5" fill="#4a9d8f" opacity="0.6"/>
                <circle cx="54" cy="149" r="2.5" fill="rgba(255,255,255,0.2)" opacity="0.6"/>

                {/* Right stats panel */}
                <rect x="284" y="130" width="110" height="110" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                <text x="296" y="148" fontFamily="IBM Plex Mono" fontSize="7" fill="rgba(255,255,255,0.3)">PARTICIPATION</text>
                {/* mini bar chart */}
                <rect x="296" y="195" width="12" height="25" rx="2" fill="rgba(74,157,143,0.3)"/>
                <rect x="312" y="182" width="12" height="38" rx="2" fill="rgba(74,157,143,0.5)"/>
                <rect x="328" y="170" width="12" height="50" rx="2" fill="rgba(74,157,143,0.7)"/>
                <rect x="344" y="175" width="12" height="45" rx="2" fill="rgba(74,157,143,0.55)"/>
                <rect x="360" y="162" width="12" height="58" rx="2" fill="#4a9d8f"/>
                <line x1="296" y1="220" x2="380" y2="220" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                <text x="296" y="162" fontFamily="DM Serif Display" fontSize="18" fill="rgba(240,239,232,0.9)">94%</text>

                {/* Anonymous mask icon */}
                <rect x="175" y="220" width="70" height="50" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                <circle cx="210" cy="237" r="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
                <path d="M199 252 q11-10 22 0" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="200" y1="260" x2="220" y2="260" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>

                {/* Connecting lines */}
                <line x1="136" y1="145" x2="155" y2="155" stroke="rgba(74,157,143,0.2)" strokeWidth="1" strokeDasharray="4 3"/>
                <line x1="265" y1="165" x2="284" y2="175" stroke="rgba(74,157,143,0.2)" strokeWidth="1" strokeDasharray="4 3"/>
                <line x1="100" y1="227" x2="155" y2="230" stroke="rgba(74,157,143,0.15)" strokeWidth="1" stroke-dasharray="4 3"/>
              </svg>
            </div>

            <h1 className="left-headline">Your Vote.<br/>Your Voice.<br/><em>Protected.</em></h1>
            <p className="left-desc">Participate in secure and transparent elections through VoteGuard's trusted voting platform. Every ballot is anonymous. Every action is audited.</p>

            <div className="trust-badges">
              <div className="trust-badge"><div className="trust-dot"></div>Anonymous voting with cryptographic protection</div>
              <div className="trust-badge"><div className="trust-dot"></div>Full audit trail on every election event</div>
              <div className="trust-badge"><div className="trust-dot"></div>Institutional-grade security infrastructure</div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div style={{ position: 'absolute', top: '24px', right: '32px', zIndex: 10 }}>
            <ThemeToggle />
          </div>
          <div className="auth-card" id="auth-card">


            {/* LOGIN VIEW */}
            {view === 'login' && (
              <div className="form-view active">
                <div className="card-logo">
                  <LogoMark size={14} style={{ margin: '0 auto 10px' }} />
                </div>
                <div className="card-title">Welcome Back</div>
                <div className="card-sub">Login to participate in your election</div>

                <div className="auth-tabs">
                  <button className="tab-btn active" onClick={() => setView('login')}>Login</button>
                  <button className="tab-btn" onClick={() => setView('register')}>Register</button>
                </div>

                {loginError && <div className="error-banner show" style={{ marginBottom: 12, fontSize: '13px' }}>{loginError}</div>}
                <div className="field">
                  <label htmlFor="student-id-input">STUDENT ID / ROLL NUMBER</label>
                  <input 
                    id="student-id-input" 
                    type="text" 
                    placeholder="e.g. 21CS001" 
                    autoComplete="username" 
                    aria-required="true" 
                    value={loginRollNumber}
                    onChange={(e) => setLoginRollNumber(e.target.value)}
                    disabled={loginLoading}
                  />
                </div>
                <div className="field">
                  <label htmlFor="password-input">PASSWORD</label>
                  <input 
                    id="password-input" 
                    type="password" 
                    placeholder="Enter your password" 
                    autoComplete="current-password" 
                    aria-required="true" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loginLoading}
                  />
                </div>
                <div className="field-check">
                  <label className="check-label"><input type="checkbox" /> Remember me</label>
                  <span className="link-sm" onClick={() => setView('forgot')}>Forgot Password?</span>
                </div>
                <button className="btn-main" onClick={handleLogin} disabled={loginLoading}>
                  {loginLoading ? 'Authenticating...' : 'Login'}
                </button>
                <button className="btn-ghost" onClick={() => setView('register')} disabled={loginLoading}>Register Instead</button>

                <div className="sec-indicators">
                  <div className="sec-ind"><div className="sec-ind-dot"></div>Secure Auth</div>
                  <div className="sec-ind"><div className="sec-ind-dot"></div>Anonymous Voting</div>
                  <div className="sec-ind"><div className="sec-ind-dot"></div>Audit Protected</div>
                </div>
              </div>
            )}

            {/* REGISTER VIEW */}
            {view === 'register' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => setView('login')}><span className="back-arrow">←</span> Back to Login</div>
                <div className="card-title">Create Voter Account</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>Register to participate in your institution's elections</div>

                {registerError && <div className="error-banner show" style={{ marginBottom: 12, fontSize: '13px' }}>{registerError}</div>}

                <div className="field">
                  <label htmlFor="fullname-input">FULL NAME</label>
                  <input id="fullname-input" type="text" placeholder="Your full name" autoComplete="name" aria-required="true" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} disabled={registerLoading} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="roll-number-input">ROLL NUMBER</label>
                    <input id="roll-number-input" type="text" placeholder="e.g. 21CS042" aria-required="true" value={regRollNumber} onChange={(e) => setRegRollNumber(e.target.value)} disabled={registerLoading} />
                  </div>
                  <div className="field">
                    <label htmlFor="department-input">DEPARTMENT</label>
                    <input id="department-input" type="text" placeholder="e.g. CSE" aria-required="true" value={regDept} onChange={(e) => setRegDept(e.target.value)} disabled={registerLoading} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="email-input">EMAIL ADDRESS</label>
                  <input id="email-input" type="email" placeholder="you@institution.edu" autoComplete="email" aria-required="true" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} disabled={registerLoading} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="phone-input">PHONE NUMBER</label>
                    <input id="phone-input" type="tel" placeholder="+91 9XXXXXXXXX" autoComplete="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} disabled={registerLoading} />
                  </div>
                  <div className="field" style={{ flex: 0 }}></div>
                </div>
                <div className="field">
                  <label htmlFor="password-create-input">PASSWORD</label>
                  <input id="password-create-input" type="password" placeholder="Create a strong password" autoComplete="new-password" aria-required="true" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} disabled={registerLoading} />
                </div>
                <div className="field">
                  <label htmlFor="password-confirm-input">CONFIRM PASSWORD</label>
                  <input id="password-confirm-input" type="password" placeholder="Repeat your password" autoComplete="new-password" aria-required="true" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} disabled={registerLoading} />
                </div>
                <button className="btn-main" onClick={handleRegister} disabled={registerLoading}>
                  {registerLoading ? 'Creating Account...' : 'Register'}
                </button>
                <button className="btn-ghost" onClick={() => setView('login')}>Already have an account? Login</button>
              </div>
            )}

            {/* OTP VIEW */}
            {view === 'otp' && (
              <div className="form-view active">
                {/* 1. IDLE / CHANNEL SELECT STATE */}
                {otpState === 'idle' && (
                  <>
                    <div className="back-link" onClick={() => setView('login')}><span className="back-arrow">←</span> Back</div>
                    <div className="card-title">Identity Verification</div>
                    <div className="card-sub" style={{ marginBottom: '24px' }}>Choose your preferred channel to receive a secure one-time passcode (OTP).</div>

                    <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' }}>Select Verification Channel</div>
                    <div className="otp-channel" style={{ marginBottom: '24px' }}>
                      <div className={`otp-opt ${otpChannel === 'email' ? 'sel' : ''}`} onClick={() => setOtpChannel('email')}>
                        <IconMail size={18} style={{marginRight: 8}}/> Email OTP
                      </div>
                      <div className={`otp-opt ${otpChannel === 'phone' ? 'sel' : ''}`} onClick={() => setOtpChannel('phone')}>
                        <IconDeviceMobile size={18} style={{marginRight: 8}}/> Mobile OTP
                      </div>
                    </div>

                    <button className="btn-main" onClick={handleSendOTP}>Send Verification Code</button>
                  </>
                )}

                {/* 2. SENDING STATE OVERLAY */}
                {otpState === 'sending' && (
                  <div style={{ padding: '40px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <div className="secure-loading-spinner" />
                    <div style={{ fontSize: '15px', fontWeight: '650', color: 'var(--text)' }}>Contacting Dispatcher</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{otpProgressMessage}</div>
                  </div>
                )}

                {/* 3. CODE ENTRY STATE */}
                {otpState === 'sent' && (
                  <>
                    <div className="back-link" onClick={() => setOtpState('idle')}><span className="back-arrow">←</span> Change Channel</div>
                    <div className="card-title">Enter Security Code</div>
                    <div className="card-sub" style={{ marginBottom: '24px' }}>
                      A 6-digit verification code has been sent to your registered {otpChannel === 'email' ? 'email address' : 'mobile phone'}.
                    </div>

                    {verificationError && <div className="error-banner show" style={{ marginBottom: 12, fontSize: '13px' }}>{verificationError}</div>}
                    {debugOtpCode && (
                      <div className="info-banner show" style={{ marginBottom: 16, padding: '10px', background: 'rgba(74, 157, 143, 0.1)', border: '1px solid rgba(74, 157, 143, 0.3)', borderRadius: '6px', fontSize: '12.5px', color: 'var(--teal)', fontWeight: '600', textAlign: 'center' }}>
                        Development Mode: Use verification code <strong>{debugOtpCode}</strong>
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' }}>Enter Verification Code</div>
                    <OtpInput onChange={setOtpInputCode} />
                    
                    <div className="otp-sent-info" style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text3)' }}>
                      Didn't receive it? <span className="link-sm" onClick={() => handleSendOTP()} style={{ color: 'var(--teal)', cursor: 'pointer', fontWeight: '600' }}>Resend Code</span>
                    </div>
                    <button className="btn-main" style={{ marginTop: '16px' }} onClick={handleVerifyOTP}>Verify &amp; Authorize Session</button>
                  </>
                )}

                {/* 4. VERIFYING STATE OVERLAY */}
                {otpState === 'verifying' && (
                  <div style={{ padding: '40px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <div className="secure-loading-spinner" />
                    <div style={{ fontSize: '15px', fontWeight: '650', color: 'var(--text)' }}>Verifying Integrity</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{otpProgressMessage}</div>
                  </div>
                )}

                {/* 5. SUCCESS STATE OVERLAY */}
                {otpState === 'success' && (
                  <div style={{ padding: '40px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <div className="secure-success-checkmark animate-scale-up">
                      <svg viewBox="0 0 52 52" style={{ width: '48px', height: '48px' }}>
                        <circle cx="26" cy="26" r="25" fill="none" stroke="var(--teal)" strokeWidth="3" />
                        <path fill="none" stroke="var(--teal)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Session Authorized</div>
                    <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{otpProgressMessage}</div>
                  </div>
                )}

                <div className="sec-indicators" style={{ marginTop: '24px' }}>
                  <div className="sec-ind"><div className="sec-ind-dot"></div>Secure Two-Factor</div>
                  <div className="sec-ind"><div className="sec-ind-dot"></div>Anti-Tamper Session</div>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {view === 'forgot' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => setView('login')}><span className="back-arrow">←</span> Back to Login</div>
                <div className="card-title">Reset Password</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>Enter your email to receive a recovery link</div>
                {forgotError && <div className="error-banner show" style={{ marginBottom: 12, fontSize: '13px' }}>{forgotError}</div>}
                {forgotSuccess && <div className="info-banner show" style={{ marginBottom: 12, fontSize: '13.5px', color: 'var(--teal)', background: 'rgba(74,157,143,0.1)', border: '1px solid rgba(74,157,143,0.3)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>{forgotSuccess}</div>}
                <div className="field">
                  <label htmlFor="recovery-email-input">EMAIL ADDRESS</label>
                  <input 
                    id="recovery-email-input" 
                    type="email" 
                    placeholder="you@institution.edu" 
                    autoComplete="username" 
                    aria-required="true" 
                    value={forgotEmail} 
                    onChange={(e) => setForgotEmail(e.target.value)} 
                    disabled={forgotLoading}
                  />
                </div>
                <button className="btn-main" onClick={handleSendRecoveryEmail} disabled={forgotLoading}>
                  {forgotLoading ? 'Sending...' : 'Send Recovery Link'}
                </button>
                <button className="btn-ghost" onClick={() => setView('login')}>Back to Login</button>
              </div>
            )}

            {/* RESET PASSWORD VIEW */}
            {view === 'reset' && (
              <div className="form-view active">
                <div className="card-title">Create New Password</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>Please enter a strong new password for your account</div>

                {resetError && <div className="error-banner show" style={{ marginBottom: 12, fontSize: '13px' }}>{resetError}</div>}
                {resetSuccess && <div className="info-banner show" style={{ marginBottom: 12, fontSize: '13.5px', color: 'var(--teal)', background: 'rgba(74,157,143,0.1)', border: '1px solid rgba(74,157,143,0.3)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>Password reset successful. Redirecting to login...</div>}

                <div className="field">
                  <label htmlFor="reset-password-input">NEW PASSWORD</label>
                  <input 
                    id="reset-password-input" 
                    type="password" 
                    placeholder="Enter new password" 
                    value={resetPassword} 
                    onChange={(e) => setResetPassword(e.target.value)} 
                    disabled={resetLoading || resetSuccess} 
                    aria-required="true"
                  />
                </div>
                <div className="field">
                  <label htmlFor="reset-confirm-input">CONFIRM NEW PASSWORD</label>
                  <input 
                    id="reset-confirm-input" 
                    type="password" 
                    placeholder="Confirm new password" 
                    value={resetConfirmPassword} 
                    onChange={(e) => setResetConfirmPassword(e.target.value)} 
                    disabled={resetLoading || resetSuccess} 
                    aria-required="true"
                  />
                </div>
                <button className="btn-main" onClick={handleResetPassword} disabled={resetLoading || resetSuccess}>
                  {resetLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            )}

          </div>

          <div className="auth-footer">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
        </div>

      </div>
    </div>
  );
}
