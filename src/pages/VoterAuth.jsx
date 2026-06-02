import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import OtpInput from '../components/OtpInput';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/voter-auth.css';

export default function VoterAuth() {
  const [view, setView] = useState('login'); // 'login' | 'register' | 'otp' | 'forgot'
  const [otpChannel, setOtpChannel] = useState('email'); // 'email' | 'phone'
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();

  const handleSendOTP = (e) => {
    e.preventDefault();
    setOtpSent(true);
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    alert('Voter Authentication Successful! Redirecting to Voter Cockpit.');
    navigate('/voter');
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
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="420" height="320" fill="url(#voter-grid)" rx="12"/>

                {/* Ballot box central */}
                <rect x="155" y="100" width="110" height="130" rx="10" fill="rgba(74,157,143,0.08)" stroke="rgba(74,157,143,0.3)" stroke-width="1.5"/>
                <rect x="185" y="90" width="50" height="20" rx="5" fill="rgba(74,157,143,0.15)" stroke="rgba(74,157,143,0.4)" stroke-width="1"/>
                {/* Slot */}
                <rect x="193" y="97" width="34" height="4" rx="2" fill="rgba(74,157,143,0.5)"/>
                {/* Ballot entering */}
                <rect x="175" y="68" width="70" height="40" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
                <line x1="185" y1="80" x2="235" y2="80" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
                <line x1="185" y1="88" x2="220" y2="88" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
                {/* Check mark on ballot */}
                <path d="M237 76 L241 81 L248 72" stroke="#4a9d8f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>

                {/* Lock icon top right */}
                <rect x="320" y="40" width="54" height="54" rx="12" fill="rgba(212,168,67,0.08)" stroke="rgba(212,168,67,0.2)" stroke-width="1"/>
                <rect x="334" y="63" width="26" height="20" rx="4" fill="none" stroke="#d4a843" stroke-width="1.5"/>
                <path d="M339 63 v-5 a8 8 0 0 1 16 0 v5" fill="none" stroke="#d4a843" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="347" cy="72" r="2.5" fill="#d4a843" opacity="0.7"/>

                {/* Shield icon bottom left */}
                <rect x="46" y="200" width="54" height="54" rx="12" fill="rgba(74,157,143,0.08)" stroke="rgba(74,157,143,0.2)" stroke-width="1"/>
                <path d="M73 212 L58 217 v8 c0 8 6 14 15 16 9-2 15-8 15-16 v-8 z" fill="none" stroke="#4a9d8f" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M66 225 l4 4 7-8" stroke="#4a9d8f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>

                {/* Audit line items */}
                <rect x="46" y="90" width="90" height="80" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
                <text x="58" y="108" font-family="IBM Plex Mono" font-size="7" fill="rgba(74,157,143,0.7)">AUDIT LOG</text>
                <rect x="58" y="113" width="65" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
                <rect x="58" y="124" width="50" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <rect x="58" y="135" width="60" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
                <rect x="58" y="146" width="40" height="6" rx="2" fill="rgba(255,255,255,0.06)"/>
                <circle cx="54" cy="116" r="2.5" fill="#4a9d8f" opacity="0.6"/>
                <circle cx="54" cy="127" r="2.5" fill="#4a9d8f" opacity="0.6"/>
                <circle cx="54" cy="138" r="2.5" fill="#4a9d8f" opacity="0.6"/>
                <circle cx="54" cy="149" r="2.5" fill="rgba(255,255,255,0.2)" opacity="0.6"/>

                {/* Right stats panel */}
                <rect x="284" y="130" width="110" height="110" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
                <text x="296" y="148" font-family="IBM Plex Mono" font-size="7" fill="rgba(255,255,255,0.3)">PARTICIPATION</text>
                {/* mini bar chart */}
                <rect x="296" y="195" width="12" height="25" rx="2" fill="rgba(74,157,143,0.3)"/>
                <rect x="312" y="182" width="12" height="38" rx="2" fill="rgba(74,157,143,0.5)"/>
                <rect x="328" y="170" width="12" height="50" rx="2" fill="rgba(74,157,143,0.7)"/>
                <rect x="344" y="175" width="12" height="45" rx="2" fill="rgba(74,157,143,0.55)"/>
                <rect x="360" y="162" width="12" height="58" rx="2" fill="#4a9d8f"/>
                <line x1="296" y1="220" x2="380" y2="220" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                <text x="296" y="162" font-family="DM Serif Display" font-size="18" fill="rgba(240,239,232,0.9)">94%</text>

                {/* Anonymous mask icon */}
                <rect x="175" y="220" width="70" height="50" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
                <circle cx="210" cy="237" r="9" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
                <path d="M199 252 q11-10 22 0" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="200" y1="260" x2="220" y2="260" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

                {/* Connecting lines */}
                <line x1="136" y1="145" x2="155" y2="155" stroke="rgba(74,157,143,0.2)" stroke-width="1" stroke-dasharray="4 3"/>
                <line x1="265" y1="165" x2="284" y2="175" stroke="rgba(74,157,143,0.2)" stroke-width="1" stroke-dasharray="4 3"/>
                <line x1="100" y1="227" x2="155" y2="230" stroke="rgba(74,157,143,0.15)" stroke-width="1" stroke-dasharray="4 3"/>
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

                <div className="field">
                  <label>STUDENT ID / USER ID</label>
                  <input type="text" placeholder="e.g. STU2024001"/>
                </div>
                <div className="field">
                  <label>PASSWORD</label>
                  <input type="password" placeholder="Enter your password"/>
                </div>
                <div className="field-check">
                  <label className="check-label"><input type="checkbox"/> Remember me</label>
                  <span className="link-sm" onClick={() => setView('forgot')}>Forgot Password?</span>
                </div>
                <button className="btn-main" onClick={() => setView('otp')}>Login</button>
                <button className="btn-ghost" onClick={() => setView('register')}>Register Instead</button>

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

                <div className="field"><label>FULL NAME</label><input type="text" placeholder="Your full name"/></div>
                <div className="field-row">
                  <div className="field"><label>ROLL NUMBER</label><input type="text" placeholder="e.g. 21CS042"/></div>
                  <div className="field"><label>DEPARTMENT</label><input type="text" placeholder="e.g. CSE"/></div>
                </div>
                <div className="field"><label>EMAIL ADDRESS</label><input type="email" placeholder="you@institution.edu"/></div>
                <div className="field-row">
                  <div className="field"><label>PHONE NUMBER</label><input type="tel" placeholder="+91 9XXXXXXXXX"/></div>
                  <div className="field" style={{ flex: 0 }}></div>
                </div>
                <div className="field"><label>PASSWORD</label><input type="password" placeholder="Create a strong password"/></div>
                <div className="field"><label>CONFIRM PASSWORD</label><input type="password" placeholder="Repeat your password"/></div>
                <button className="btn-main" onClick={() => setView('otp')}>Register</button>
                <button className="btn-ghost" onClick={() => setView('login')}>Already have an account? Login</button>
              </div>
            )}

            {/* OTP VIEW */}
            {view === 'otp' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => setView('login')}><span className="back-arrow">←</span> Back</div>
                <div className="card-title">Verify Your Identity</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>A one-time password will be sent to verify you</div>

                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px' }}>Send code to:</div>
                <div className="otp-channel">
                  <div className={`otp-opt ${otpChannel === 'email' ? 'sel' : ''}`} onClick={() => setOtpChannel('email')}>📧 Email</div>
                  <div className={`otp-opt ${otpChannel === 'phone' ? 'sel' : ''}`} onClick={() => setOtpChannel('phone')}>📱 Phone</div>
                </div>

                <button 
                  className="btn-ghost" 
                  style={{ marginBottom: '20px', borderColor: otpSent ? 'var(--teal3)' : '', color: otpSent ? 'var(--teal)' : '' }} 
                  onClick={handleSendOTP}
                >
                  {otpSent ? 'Code Sent ✓' : 'Send OTP'}
                </button>

                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px' }}>Enter 6-digit code</div>
                <OtpInput />
                
                <div className="otp-sent-info">Didn't receive it? <span className="link-sm">Resend</span></div>
                <button className="btn-main" style={{ marginTop: '8px' }} onClick={handleVerifyOTP}>Verify OTP</button>
                <div className="sec-indicators">
                  <div className="sec-ind"><div className="sec-ind-dot"></div>Secure Auth</div>
                  <div className="sec-ind"><div className="sec-ind-dot"></div>Audit Protected</div>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {view === 'forgot' && (
              <div className="form-view active">
                <div className="back-link" onClick={() => setView('login')}><span className="back-arrow">←</span> Back to Login</div>
                <div className="card-title">Reset Password</div>
                <div className="card-sub" style={{ marginBottom: '24px' }}>Enter your email or user ID to receive a recovery link</div>
                <div className="field">
                  <label>EMAIL OR USER ID</label>
                  <input type="text" placeholder="you@institution.edu or STU2024001"/>
                </div>
                <button className="btn-main" onClick={(e) => { e.preventDefault(); alert('Recovery link sent to your email.'); setView('login'); }}>Send Recovery Link</button>
                <button className="btn-ghost" onClick={() => setView('login')}>Back to Login</button>
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
