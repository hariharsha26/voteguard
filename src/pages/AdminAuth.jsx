import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import OtpInput from '../components/OtpInput';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/AdminAuth.css';
import { IconDeviceMobile, IconShield, IconClipboardList, IconBolt, IconLock, IconMail } from '@tabler/icons-react';

export default function AdminAuth() {
  const [view, setView] = useState('login'); // 'login' | 'otp-channel' | 'otp-enter'
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpChannel, setOtpChannel] = useState('email');
  const [otpTimer, setOtpTimer] = useState(300); // 5:00 in seconds
  const [otpSent, setOtpSent] = useState(false);
  const [inputErrors, setInputErrors] = useState(false);

  const navigate = useNavigate();
  const MAX_FAILS = 3;
  const cooldownTimerRef = useRef(null);
  const otpTimerRef = useRef(null);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current);
            setLocked(false);
            setFailCount(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(cooldownTimerRef.current);
  }, [cooldown]);

  // OTP countdown effect
  useEffect(() => {
    if (view === 'otp-enter' && otpTimer > 0) {
      otpTimerRef.current = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            clearInterval(otpTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(otpTimerRef.current);
  }, [view, otpTimer]);

  const handleAdminIdChange = (e) => {
    const val = e.target.value;
    if (val.length <= 8) {
      setAdminId(val);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (locked) return;

    if (adminId.trim() === 'VGADM001' && adminPass === 'admin123') {
      setView('otp-channel');
      return;
    }

    // Handle invalid attempts
    const newFailCount = failCount + 1;
    setFailCount(newFailCount);
    setInputErrors(true);

    setTimeout(() => {
      setInputErrors(false);
    }, 1200);

    if (newFailCount >= MAX_FAILS) {
      setLocked(true);
      setCooldown(30);
    }
  };

  const handleSendOTP = (e) => {
    e.preventDefault();
    setOtpSent(true);
    setOtpTimer(300); // Reset timer
    setTimeout(() => {
      setView('otp-enter');
    }, 700);
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    // Simulate successful login
    alert('Two-Factor Authentication Verified! Redirecting to Dashboard.');
    navigate('/dashboard');
  };

  const formatOtpTimer = (secs) => {
    if (secs <= 0) return 'Expired';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="admin-auth-page">
      <div className="auth-wrap">
        
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="left-inner">
            <div className="left-logo">
              <LogoMark size={14} />
              <span className="logo-name">VoteGuard</span>
            </div>

            <div className="left-illus">
              <svg className="illus-svg" viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="admin-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth={1}/>
                  </pattern>
                </defs>
                <rect width="420" height="320" fill="url(#admin-grid)" rx="12"/>

                {/* Central shield */}
                <path d="M210 60 L170 75 v50 c0 38 18 68 40 80 22-12 40-42 40-80 V75 z"
                  fill="rgba(212,168,67,0.07)" stroke="rgba(212,168,67,0.35)" strokeWidth={1.5} strokeLinejoin="round"/>
                {/* Inner shield check */}
                <path d="M196 145 l10 10 20-22" stroke="#d4a843" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>

                {/* Glow ring around shield */}
                <circle cx="210" cy="135" r="52" fill="none" stroke="rgba(212,168,67,0.08)" strokeWidth={20}/>
                <circle cx="210" cy="135" r="52" fill="none" stroke="rgba(212,168,67,0.15)" strokeWidth={1} strokeDasharray="6 5"/>

                {/* Top left: Audit dashboard panel */}
                <rect x="30" y="40" width="110" height="100" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
                <text x="42" y="58" fontFamily="IBM Plex Mono" fontSize={7} fill="rgba(212,168,67,0.6)">AUDIT DASHBOARD</text>
                <rect x="42" y="64" width="85" height="6" rx="2" fill="rgba(255,255,255,0.07)"/>
                <rect x="42" y="75" width="65" height="6" rx="2" fill="rgba(255,255,255,0.05)"/>
                <rect x="42" y="86" width="75" height="6" rx="2" fill="rgba(255,255,255,0.07)"/>
                <rect x="42" y="97" width="55" height="6" rx="2" fill="rgba(255,255,255,0.05)"/>
                <rect x="42" y="108" width="80" height="6" rx="2" fill="rgba(255,255,255,0.07)"/>
                <circle cx="38" cy="67" r="2.5" fill="#d4a843" opacity="0.5"/>
                <circle cx="38" cy="78" r="2.5" fill="#4a9d8f" opacity="0.5"/>
                <circle cx="38" cy="89" r="2.5" fill="#d4a843" opacity="0.5"/>
                <circle cx="38" cy="100" r="2.5" fill="rgba(255,255,255,0.2)"/>
                <circle cx="38" cy="111" r="2.5" fill="#4a9d8f" opacity="0.5"/>

                {/* Top right: Election monitoring */}
                <rect x="280" y="40" width="110" height="90" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
                <text x="292" y="58" fontFamily="IBM Plex Mono" fontSize={7} fill="rgba(74,157,143,0.7)">ELECTIONS LIVE</text>
                {/* mini progress bars */}
                <rect x="292" y="64" width="85" height="6" rx="3" fill="rgba(255,255,255,0.06)"/>
                <rect x="292" y="64" width="65" height="6" rx="3" fill="rgba(74,157,143,0.5)"/>
                <rect x="292" y="75" width="85" height="6" rx="3" fill="rgba(255,255,255,0.06)"/>
                <rect x="292" y="75" width="40" height="6" rx="3" fill="rgba(212,168,67,0.5)"/>
                <rect x="292" y="86" width="85" height="6" rx="3" fill="rgba(255,255,255,0.06)"/>
                <rect x="292" y="86" width="78" height="6" rx="3" fill="rgba(74,157,143,0.7)"/>
                <text x="292" y="110" fontFamily="DM Serif Display" fontSize={20} fill="rgba(240,239,232,0.85)">3</text>
                <text x="310" y="110" fontFamily="IBM Plex Mono" fontSize={8} fill="rgba(255,255,255,0.3)">active</text>

                {/* Bottom left: governance analytics */}
                <rect x="30" y="190" width="110" height="100" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
                <text x="42" y="208" fontFamily="IBM Plex Mono" fontSize={7} fill="rgba(255,255,255,0.3)">GOVERNANCE</text>
                {/* bar chart */}
                <rect x="42" y="255" width="14" height="30" rx="2" fill="rgba(212,168,67,0.25)"/>
                <rect x="60" y="240" width="14" height="45" rx="2" fill="rgba(212,168,67,0.45)"/>
                <rect x="78" y="230" width="14" height="55" rx="2" fill="rgba(212,168,67,0.65)"/>
                <rect x="96" y="220" width="14" height="65" rx="2" fill="#d4a843"/>
                <line x1="42" y1="285" x2="120" y2="285" stroke="rgba(255,255,255,0.1)" strokeWidth={1}/>

                {/* Bottom right: system health */}
                <rect x="280" y="175" width="110" height="115" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
                <text x="292" y="193" fontFamily="IBM Plex Mono" fontSize={7} fill="rgba(255,255,255,0.3)">SYSTEM HEALTH</text>
                <rect x="292" y="200" width="85" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <rect x="292" y="200" width="85" height="6" rx="2" fill="rgba(74,157,143,0.4)"/>
                <rect x="292" y="212" width="85" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <rect x="292" y="212" width="70" height="6" rx="2" fill="rgba(74,157,143,0.6)"/>
                <rect x="292" y="224" width="85" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <rect x="292" y="224" width="85" height="6" rx="2" fill="rgba(74,157,143,0.4)"/>
                <rect x="292" y="236" width="85" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <rect x="292" y="236" width="52" height="6" rx="2" fill="rgba(212,168,67,0.5)"/>
                {/* status labels */}
                <circle cx="380" cy="203" r="3" fill="#4a9d8f"/>
                <circle cx="380" cy="215" r="3" fill="#4a9d8f"/>
                <circle cx="380" cy="227" r="3" fill="#4a9d8f"/>
                <circle cx="380" cy="239" r="3" fill="#d4a843"/>

                {/* Connecting lines */}
                <line x1="140" y1="90" x2="165" y2="110" stroke="rgba(212,168,67,0.15)" strokeWidth={1} strokeDasharray="4 3"/>
                <line x1="280" y1="85" x2="258" y2="110" stroke="rgba(212,168,67,0.15)" strokeWidth={1} strokeDasharray="4 3"/>
                <line x1="140" y1="240" x2="165" y2="210" stroke="rgba(212,168,67,0.12)" strokeWidth={1} strokeDasharray="4 3"/>
                <line x1="280" y1="230" x2="258" y2="210" stroke="rgba(212,168,67,0.12)" strokeWidth={1} strokeDasharray="4 3"/>
              </svg>
            </div>

            <h1 className="left-headline">Administrative<br/>Control Center</h1>
            <p className="left-desc">Manage elections, monitor infrastructure, audit voting activity, and maintain election integrity through VoteGuard's governance platform.</p>

            <div className="admin-badges">
              <div className="admin-badge"><div className="badge-icon"><IconShield size={16}/></div>Multi-factor authentication required</div>
              <div className="admin-badge"><div className="badge-icon"><IconClipboardList size={16}/></div>All admin sessions are fully audit-logged</div>
              <div className="admin-badge"><div className="badge-icon"><IconBolt size={16}/></div>Progressive rate limiting active</div>
              <div className="admin-badge"><div className="badge-icon"><IconLock size={16}/></div>Authorized personnel only</div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div style={{ position: 'absolute', top: '24px', right: '32px', zIndex: 10 }}>
            <ThemeToggle />
          </div>
          <div className="auth-card" id="auth-card">


            {/* VIEW 1: ADMIN LOGIN */}
            {view === 'login' && (
              <div className="form-view active">
                <div className="admin-access-badge">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L2 2.5v3.5c0 2.8 1.8 5.2 4 6 2.2-.8 4-3.2 4-6V2.5L6 1z" stroke="#d4a843" strokeWidth={1} fill="rgba(212,168,67,0.2)"/>
                  </svg>
                  Authorized Personnel Only
                </div>
                <div className="card-logo">
                  <LogoMark size={14} style={{ margin: '0 auto 10px' }} />
                </div>
                <div className="card-title">Administrator Login</div>
                <div className="card-sub">VoteGuard Governance Platform</div>

                {/* Error banner (hidden by default) */}
                {failCount > 0 && !locked && (
                  <div className="error-banner show">
                    <div>Invalid Admin ID or Password.</div>
                    <div className="attempt-info">Remaining attempts: <strong>{MAX_FAILS - failCount}</strong></div>
                  </div>
                )}

                {/* Lockout banner */}
                {locked && (
                  <div className="error-banner show">
                    Too many failed attempts. Try again in{' '}
                    <span className="cooldown-timer">{cooldown}</span>s
                  </div>
                )}

                <div className="field">
                  <label>
                    ADMIN ID
                    <span className="field-hint">Exactly 8 characters</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="VGADM001" 
                    maxLength={8} 
                    value={adminId}
                    onChange={handleAdminIdChange}
                    className={inputErrors ? 'error' : ''}
                    disabled={locked}
                  />
                  <div className={`char-count ${adminId.length === 8 ? 'ok' : ''}`}>
                    {adminId.length} / 8
                  </div>
                </div>
                <div className="field">
                  <label>PASSWORD</label>
                  <input 
                    type="password" 
                    placeholder="Enter admin password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    className={inputErrors ? 'error' : ''}
                    disabled={locked}
                  />
                </div>

                <button 
                  className="btn-main gold" 
                  style={{ marginTop: '8px' }} 
                  onClick={handleLoginSubmit}
                  disabled={locked}
                >
                  Continue
                </button>

                <div className="sec-panel">
                  <div className="sec-item"><div className="sec-dot"></div>SQL Injection Protection</div>
                  <div className="sec-item"><div className="sec-dot"></div>Multi-Factor Authentication</div>
                  <div className="sec-item"><div className="sec-dot"></div>Audit Logging Enabled</div>
                  <div className="sec-item"><div className="sec-dot"></div>Secure Session Management</div>
                  <div className="sec-item"><div className="sec-dot"></div>Progressive Rate Limiting</div>
                  <div className="sec-item"><div className="sec-dot"></div>Encrypted Transport</div>
                </div>
              </div>
            )}

            {/* VIEW 2: OTP CHANNEL SELECT */}
            {view === 'otp-channel' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => setView('login')}>← Back</div>
                <div className="admin-access-badge">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L2 2.5v3.5c0 2.8 1.8 5.2 4 6 2.2-.8 4-3.2 4-6V2.5L6 1z" stroke="#d4a843" strokeWidth={1} fill="rgba(212,168,67,0.2)"/>
                  </svg>
                  Two-Factor Authentication
                </div>
                <div className="card-title">Verify Identity</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>Choose where to receive your verification code</div>

                <div className="otp-channel">
                  <div className={`otp-opt ${otpChannel === 'email' ? 'sel' : ''}`} onClick={() => setOtpChannel('email')}><IconMail size={18} style={{marginRight: 8}}/> Email</div>
                  <div className={`otp-opt ${otpChannel === 'phone' ? 'sel' : ''}`} onClick={() => setOtpChannel('phone')}><IconDeviceMobile size={18} style={{marginRight: 8}}/> Phone</div>
                </div>

                <button 
                  className="btn-main gold" 
                  style={{
                    background: otpSent ? 'rgba(74,157,143,0.2)' : '',
                    color: otpSent ? '#4a9d8f' : '',
                    border: otpSent ? '1px solid rgba(74,157,143,0.3)' : ''
                  }}
                  onClick={handleSendOTP}
                >
                  {otpSent ? 'Code Sent ✓' : 'Send OTP'}
                </button>

                <div className="sec-panel" style={{ gridTemplateColumns: '1fr', marginTop: '18px' }}>
                  <div className="sec-item"><div className="sec-dot"></div>Code expires in 5 minutes</div>
                  <div className="sec-item"><div className="sec-dot"></div>Session locked to this device</div>
                </div>
              </div>
            )}

            {/* VIEW 3: OTP ENTER */}
            {view === 'otp-enter' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => setView('otp-channel')}>← Back</div>
                <div className="card-title">Enter Verification Code</div>
                <div className="card-sub" style={{ marginBottom: '8px' }}>Admin Access · 2FA Required</div>

                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>Code sent to your registered contact</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px' }}>
                  Expires in <span style={{ color: 'var(--gold)', fontFamily: 'var(--mono)' }}>{formatOtpTimer(otpTimer)}</span>
                </div>

                <OtpInput />

                <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text3)', marginBottom: '18px' }}>
                  Didn't receive it? <span style={{ color: 'var(--gold)', cursor: 'pointer' }}>Resend code</span>
                </div>

                <button className="btn-main gold" onClick={handleVerifyOTP}>Verify &amp; Login</button>

                <div className="sec-panel" style={{ marginTop: '18px' }}>
                  <div className="sec-item"><div className="sec-dot"></div>Audit log on verify</div>
                  <div className="sec-item"><div className="sec-dot"></div>Rate limited</div>
                </div>
              </div>
            )}

          </div>

          <div className="auth-footer">
            <div className="auth-footer-top">VoteGuard</div>
            <div className="auth-footer-tag">SECURE ELECTION GOVERNANCE PLATFORM</div>
            <div className="auth-footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms</a>
              <a href="#">Support</a>
            </div>
            <div className="version">v2.4.1 · build 20250601</div>
          </div>
        </div>

      </div>
    </div>
  );
}
