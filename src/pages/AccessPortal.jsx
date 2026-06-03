import { Link } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import ThemeToggle from '../components/ThemeToggle';
import SpotlightCard from '../components/ReactBits/SpotlightCard';
import '../styles/Portal.css';
import { IconLock, IconShield, IconClipboardList, IconBolt, IconMasksTheater, IconCopyright } from '@tabler/icons-react';

export default function AccessPortal() {
  return (
    <div className="portal-page">
      <div className="portal-ambient"></div>
      <div className="portal-grid-bg"></div>

      {/* NAV */}
      <nav className="portal-nav">
        <div className="nav-logo">
          <LogoMark />
          <span className="logo-name">VoteGuard</span>
        </div>
        <span className="nav-tag">Secure Election Governance Platform</span>
        <div className="nav-right">
          <ThemeToggle />
          <Link to="/" className="nav-link">About</Link>
          <a href="#" className="nav-link">Documentation</a>
        </div>
      </nav>


      <main className="portal-main">
        {/* HEADER */}
        <div className="portal-header">
          <div className="portal-eyebrow">
            <div className="eyebrow-dot"></div>
            Access Portal
          </div>
          <h1 className="portal-title">How will you be<br /><em>accessing</em> VoteGuard?</h1>
          <p className="portal-desc">Select your access type below. Voter and administrator sessions are separated for security and governance compliance.</p>
        </div>

        {/* CARDS */}
        <div className="cards-row">
          {/* VOTER */}
          <SpotlightCard
            as={Link}
            className="portal-card card-voter"
            to="/voter-auth"
            spotlightColor="rgba(105, 241, 196, 0.18)"
            aria-label="Access voter page. Login, register, and cast ballots."
          >
            <div className="card-icon-wrap">
              <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><path d="M9 11l-2 10 5-3 5 3-2-10" strokeDasharray="1 0" /></svg>
            </div>
            <div className="card-label">Voter</div>
            <div className="card-title">I'm a Voter</div>
            <div className="card-desc">Participate in your institution's elections. Login, verify your identity, and cast your anonymous ballot securely.</div>
            <div className="card-footer">
              <div className="card-features">
                <div className="card-feature"><div className="card-feature-dot"></div>Login or Register</div>
                <div className="card-feature"><div className="card-feature-dot"></div>OTP Verification</div>
                <div className="card-feature"><div className="card-feature-dot"></div>Anonymous Voting</div>
              </div>
              <div className="card-action">
                Enter <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 7h8M8 4l3 3-3 3" /></svg>
              </div>
            </div>
          </SpotlightCard>

          {/* ADMIN */}
          <SpotlightCard
            as={Link}
            className="portal-card card-admin"
            to="/admin-auth"
            spotlightColor="rgba(246, 194, 94, 0.2)"
            aria-label="Access administrator portal. Admin session login for secure governance."
          >
            <div className="card-icon-wrap">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
            </div>
            <div className="card-label">Administrator</div>
            <div className="card-title">I'm an Admin</div>
            <div className="card-desc">Manage elections, audit activity, control users, and monitor platform health through the administrative control center.</div>
            <div className="card-footer">
              <div className="card-features">
                <div className="card-feature"><div className="card-feature-dot"></div>Admin ID Required</div>
                <div className="card-feature"><div className="card-feature-dot"></div>2FA Authentication</div>
                <div className="card-feature"><div className="card-feature-dot"></div>Authorized Access Only</div>
              </div>
              <div className="card-action">
                Enter <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 7h8M8 4l3 3-3 3" /></svg>
              </div>
            </div>
          </SpotlightCard>

          {/* LEARN MORE */}
          <SpotlightCard
            as={Link}
            className="portal-card card-learn"
            to="/"
            spotlightColor="rgba(165, 180, 252, 0.16)"
            aria-label="Learn more about the VoteGuard platform."
          >
            <div className="card-icon-wrap">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            </div>
            <div className="card-label">Learn More</div>
            <div className="card-title">About VoteGuard</div>
            <div className="card-desc">Explore how VoteGuard works, what problems it solves, and why institutions trust it for secure election governance.</div>
            <div className="card-footer">
              <div className="card-features">
                <div className="card-feature"><div className="card-feature-dot"></div>Platform Overview</div>
                <div className="card-feature"><div className="card-feature-dot"></div>Features &amp; Security</div>
                <div className="card-feature"><div className="card-feature-dot"></div>How It Works</div>
              </div>
              <div className="card-action">
                Explore <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 7h8M8 4l3 3-3 3" /></svg>
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* FLOW DIAGRAM */}
        <div className="flow-section">
          <div className="flow-label">Access Flow</div>
          <div className="flow-diagram">
            <div className="flow-node start">Landing Page</div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">Choose Access Type</div>
            <div className="flow-arrow">→</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flow-node highlight-teal">Voter Login</div>
              <div className="flow-node highlight-gold">Admin Login</div>
              <div className="flow-node" style={{ color: 'var(--text2)' }}>About Page</div>
            </div>
          </div>
        </div>

        {/* SECURITY BAR */}
        <div className="security-bar">
          <div className="sec-item"><span className="sec-icon"><IconLock size={16}/></span>Encrypted sessions</div>
          <div className="sec-item"><span className="sec-icon"><IconShield size={16}/></span>SQL injection protection</div>
          <div className="sec-item"><span className="sec-icon"><IconClipboardList size={16}/></span>Full audit logging</div>
          <div className="sec-item"><span className="sec-icon"><IconBolt size={16}/></span>Rate limiting active</div>
          <div className="sec-item"><span className="sec-icon"><IconMasksTheater size={16}/></span>Anonymous voting</div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="portal-footer">
        <div className="footer-left">
          <LogoMark />
          <span className="footer-copy"><IconCopyright size={14}/> 2025 VoteGuard</span>
        </div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Support</a>
        </div>
      </footer>
    </div>
  );
}
