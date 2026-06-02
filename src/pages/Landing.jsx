import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import useRevealOnScroll from '../hooks/useRevealOnScroll';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/Landing.css';

export default function Landing() {
  const [loaderDone, setLoaderDone] = useState(false);
  const pageRef = useRef(null);
  const navRef = useRef(null);
  const barsRef = useRef(null);
  const navigate = useNavigate();

  const handleLoaderComplete = useCallback(() => {
    setLoaderDone(true);
  }, []);

  // Build dashboard chart bars
  const buildBars = useCallback(() => {
    const wrap = barsRef.current;
    if (!wrap) return;
    wrap.innerHTML = '';
    const vals = [40, 62, 55, 75, 88, 70, 94];
    const colors = ['#2a4a44', '#3a6a62', '#2a4a44', '#4a7a72', '#4a9d8f', '#3a7a70', '#5abcb0'];
    vals.forEach((v, i) => {
      const b = document.createElement('div');
      b.className = 'dash-bar-item';
      b.style.height = v + 'px';
      b.style.background = colors[i];
      b.style.animationDelay = (i * 0.08) + 's';
      wrap.appendChild(b);
    });
  }, []);

  // Show nav + page after loader
  useEffect(() => {
    if (loaderDone) {
      navRef.current?.classList.add('vis');
      pageRef.current?.classList.add('vis');
      buildBars();
    }
  }, [loaderDone, buildBars]);

  useRevealOnScroll(pageRef, loaderDone);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Loader onComplete={handleLoaderComplete} />

      <div className="landing-page" ref={pageRef}>
        {/* NAV */}
        <nav className="landing-nav" ref={navRef}>
          <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>
            <div className="nav-logo-mark">
              <span></span><span></span><span></span><span></span>
            </div>
            <span className="nav-wordmark">VoteGuard</span>
          </a>
          <ul className="nav-links">
            <li><a href="#problems" onClick={(e) => { e.preventDefault(); scrollTo('problems'); }}>Problem</a></li>
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
            <li><a href="#security" onClick={(e) => { e.preventDefault(); scrollTo('security'); }}>Security</a></li>
            <li><a href="#comparison" onClick={(e) => { e.preventDefault(); scrollTo('comparison'); }}>Why Us</a></li>
          </ul>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ThemeToggle />
            <a href="#cta" className="nav-cta" onClick={(e) => { e.preventDefault(); scrollTo('cta'); }}>Get Started</a>
          </div>

          <div className="nav-mobile"><button>Menu</button></div>
        </nav>

        {/* S1 HERO */}
        <section id="hero">
          <div className="hero-text reveal">
            <div className="eyebrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" fill="#d4a843" opacity="0.8" /></svg>
              Election Governance Platform
            </div>
            <h1 className="hero-h1">Modern Elections.<br /><em>Transparent</em> Governance.<br />Trusted Results.</h1>
            <p className="hero-sub">VoteGuard is a secure election governance platform designed for colleges, institutions, and organizations. Anonymous voting, audit-driven transparency, real-time monitoring, and administrative control — unified.</p>
            <div className="hero-btns">
              <button className="btn-primary" onClick={() => scrollTo('cta')}>Get Started</button>
              <button className="btn-secondary" onClick={() => scrollTo('how')}>Learn More</button>
            </div>
          </div>
          <div className="hero-visual reveal" style={{ transitionDelay: '0.15s' }}>
            <div className="dashboard-mock">
              <div className="dash-bar">
                <div className="dash-dot"></div><div className="dash-dot"></div><div className="dash-dot"></div>
                <div className="dash-url">app.voteguard.io / dashboard</div>
              </div>
              <div className="dash-body">
                <div className="dash-sidebar">
                  <div className="dash-nav-panel">
                    <div className="dash-nav-item active"><div className="dash-nav-dot"></div>Dashboard</div>
                    <div className="dash-nav-item"><div className="dash-nav-dot"></div>Elections</div>
                    <div className="dash-nav-item"><div className="dash-nav-dot"></div>Users</div>
                    <div className="dash-nav-item"><div className="dash-nav-dot"></div>Audit Logs</div>
                    <div className="dash-nav-item"><div className="dash-nav-dot"></div>Reports</div>
                    <div className="dash-nav-item"><div className="dash-nav-dot"></div>System</div>
                    <div className="dash-nav-item"><div className="dash-nav-dot"></div>Alerts</div>
                  </div>
                  <div className="dash-content">
                    <div className="dash-stats">
                      <div className="dash-stat">
                        <div className="dash-stat-label">Votes Cast</div>
                        <div className="dash-stat-value">2,847</div>
                        <div className="dash-stat-sub">↑ 94.2%</div>
                      </div>
                      <div className="dash-stat">
                        <div className="dash-stat-label">Active Elections</div>
                        <div className="dash-stat-value">3</div>
                        <div className="dash-stat-sub">Live now</div>
                      </div>
                      <div className="dash-stat">
                        <div className="dash-stat-label">Audit Events</div>
                        <div className="dash-stat-value">14.2k</div>
                        <div className="dash-stat-sub">Tracked</div>
                      </div>
                    </div>
                    <div className="dash-chart-wrap">
                      <div className="dash-chart-title">PARTICIPATION TREND — 7 DAYS</div>
                      <div className="dash-bars" ref={barsRef}></div>
                    </div>
                    <div className="dash-audit">
                      <div className="dash-audit-title">RECENT AUDIT EVENTS</div>
                      <div className="dash-log">
                        <span className="ok">✓</span> <span>VOTE_CAST</span> · user_4821 · 14:32:01<br />
                        <span className="ok">✓</span> <span>TOKEN_GEN</span> · user_4820 · 14:31:58<br />
                        <span className="warn">⚡</span> <span>RATE_LIMIT</span> · user_4799 · 14:30:12<br />
                        <span className="ok">✓</span> <span>OTP_VERIFY</span> · user_4818 · 14:29:44
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hero-badge">
              <div className="badge-dot"></div>
              <div className="badge-text"><strong>3 elections</strong> running live right now</div>
            </div>
          </div>
        </section>

        {/* S2 PROBLEMS */}
        <section id="problems">
          <div className="reveal">
            <div className="section-label">The Problem</div>
            <h2 className="section-title">Why Traditional Election<br />Systems Fall Short</h2>
          </div>
          <div className="problems-grid">
            {[
              { icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /><line x1="3" y1="3" x2="21" y2="21" /></>, title: 'Lack of Transparency', desc: 'Voters have no visibility into how votes are recorded, counted, or verified — eroding trust in outcomes.' },
              { icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" /></>, title: 'Difficult User Management', desc: 'Managing voter eligibility, enrollment, and participation manually is error-prone and time-consuming.', delay: '0.05s' },
              { icon: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><line x1="7" y1="10" x2="17" y2="10" /></>, title: 'No Audit Visibility', desc: 'Without a centralized audit trail, tracing irregularities or investigating disputes is virtually impossible.', delay: '0.1s' },
              { icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /></>, title: 'Manual Verification', desc: 'Paper-based or spreadsheet-driven processes introduce human error and slow down result declaration.', delay: '0.15s' },
              { icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />, title: 'Limited Monitoring', desc: 'No real-time view of participation, system health, or operational status during active elections.', delay: '0.2s' },
              { icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>, title: 'Poor Reporting', desc: 'Generating meaningful post-election documentation requires manual effort with inconsistent results.', delay: '0.25s' },
            ].map((card, i) => (
              <div key={i} className="problem-card reveal" style={card.delay ? { transitionDelay: card.delay } : undefined}>
                <div className="problem-icon"><svg viewBox="0 0 24 24">{card.icon}</svg></div>
                <div className="problem-title">{card.title}</div>
                <div className="problem-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* S3 SOLUTION */}
        <section id="solution">
          <div className="reveal">
            <div className="section-label">The Solution</div>
            <h2 className="section-title">Introducing VoteGuard</h2>
            <p className="section-desc">VoteGuard transforms election management by combining secure voting, audit intelligence, reporting systems, user management, election monitoring, and infrastructure awareness into a unified platform.</p>
          </div>
          <div className="solution-visual reveal" style={{ transitionDelay: '0.1s' }}>
            <div className="solution-header">
              <div className="sol-dot" style={{ background: '#c0392b' }}></div>
              <div className="sol-dot" style={{ background: '#d4a843' }}></div>
              <div className="sol-dot" style={{ background: '#27ae60' }}></div>
              <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text3)' }}>VoteGuard — Unified Platform</span>
            </div>
            <div className="solution-body">
              <div className="sol-sidebar">
                {['Secure Voting', 'Audit Intelligence', 'Reporting Engine', 'User Management', 'Monitoring', 'Infrastructure'].map((item, i) => (
                  <div key={i} className={`sol-item${i === 0 ? ' active' : ''}`}>
                    <span className="sol-item-dot"></span>{item}
                  </div>
                ))}
              </div>
              <div className="sol-main">
                <div className="sol-big-stat">
                  <div className="sol-stat-box"><div className="sol-stat-num">100%</div><div className="sol-stat-lbl">Anonymous Voting</div></div>
                  <div className="sol-stat-box"><div className="sol-stat-num">∞</div><div className="sol-stat-lbl">Audit Events Tracked</div></div>
                  <div className="sol-stat-box"><div className="sol-stat-num">Real‑Time</div><div className="sol-stat-lbl">Monitoring</div></div>
                </div>
                <div className="sol-ring-wrap">
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#4a9d8f" strokeWidth="8" strokeDasharray="180 34" strokeLinecap="round" transform="rotate(-90 40 40)" />
                    <text x="40" y="44" textAnchor="middle" fill="#f0efe8" fontSize="14" fontFamily="DM Sans">94%</text>
                  </svg>
                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500, marginBottom: '4px' }}>Voter Participation Rate</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Average across active elections this month</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* S4 HOW IT WORKS */}
        <section id="how">
          <div className="reveal">
            <div className="section-label">Workflow</div>
            <h2 className="section-title">How VoteGuard Works</h2>
          </div>
          <div className="how-timeline">
            {[
              { num: '01', title: 'User Login', desc: "Voters authenticate with their institutional credentials to begin the secure voting process." },
              { num: '02', title: 'OTP Verification', desc: "A one-time password is dispatched and verified, confirming the voter's identity beyond doubt." },
              { num: '03', title: 'Eligibility Validation', desc: "The system checks voter eligibility against registered rolls before granting access to the ballot." },
              { num: '04', title: 'Token Generation', desc: "A cryptographic voting token is generated — unique, single-use, and untraceable back to the voter." },
              { num: '05', title: 'Anonymous Vote Submission', desc: "The vote is cast using the anonymous token. Identity and choice are permanently separated." },
              { num: '06', title: 'Audit Tracking', desc: "Every action is timestamped and logged to the audit engine in real time, without exception." },
              { num: '07', title: 'Result Processing', desc: "Votes are tallied automatically with full integrity checks and consistency validation." },
              { num: '08', title: 'Verification & Reporting', desc: "Results are verified, audit reports generated, and documentation exported for institutional records." },
            ].map((step, i) => (
              <div key={i} className="how-step reveal" style={i > 0 ? { transitionDelay: `${i * 0.05}s` } : undefined}>
                {i % 2 === 0 ? (
                  <>
                    <div className="how-content">
                      <div className="how-step-num">STEP {step.num}</div>
                      <div className="how-step-title">{step.title}</div>
                      <div className="how-step-desc">{step.desc}</div>
                    </div>
                    <div className="how-node">{step.num}</div>
                    <div className="how-empty"></div>
                  </>
                ) : (
                  <>
                    <div className="how-empty"></div>
                    <div className="how-node">{step.num}</div>
                    <div className="how-content">
                      <div className="how-step-num">STEP {step.num}</div>
                      <div className="how-step-title">{step.title}</div>
                      <div className="how-step-desc">{step.desc}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* S5 FEATURES */}
        <section id="features">
          <div className="reveal">
            <div className="section-label">Core Features</div>
            <h2 className="section-title">Built for Modern<br />Election Governance</h2>
          </div>
          <div className="features-grid">
            {[
              { icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, title: 'Secure Authentication', desc: 'Multi-factor authentication with OTP verification ensures only eligible voters access the platform.' },
              { icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><path d="M9 11l-2 10 5-3 5 3-2-10" /></>, title: 'Anonymous Voting', desc: 'Protect voter identity while preserving complete election integrity through cryptographic token separation.', delay: '0.05s' },
              { icon: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M7 8h10M7 12h4" /></>, title: 'Audit Dashboard', desc: 'Monitor election progress and user activity through a centralized, searchable audit system.', delay: '0.1s' },
              { icon: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>, title: 'Election Management', desc: 'Create, configure, start, pause, stop, and monitor elections from one administrative interface.', delay: '0.15s' },
              { icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>, title: 'User Management', desc: 'Manage voter eligibility, enrollment, roles, and participation status at scale with precision.', delay: '0.2s' },
              { icon: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>, title: 'Results Analytics', desc: 'View participation trends, vote distribution, candidate performance, and election outcomes in rich detail.', delay: '0.25s' },
              { icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>, title: 'Reports & Exports', desc: 'Generate structured election reports, audit documentation, and exportable data packages instantly.', delay: '0.3s' },
              { icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />, title: 'System Health Monitoring', desc: 'Monitor application, database, network, and infrastructure status with live operational awareness.', delay: '0.35s' },
              { icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>, title: 'Alert System', desc: 'Receive real-time operational alerts and system notifications to stay ahead of any platform events.', delay: '0.4s' },
            ].map((card, i) => (
              <div key={i} className="feat-card reveal" style={card.delay ? { transitionDelay: card.delay } : undefined}>
                <div className="feat-icon"><svg viewBox="0 0 24 24">{card.icon}</svg></div>
                <div className="feat-title">{card.title}</div>
                <div className="feat-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* S6 AUDIT */}
        <section id="audit">
          <div className="audit-layout">
            <div className="reveal">
              <div className="section-label">Audit Intelligence</div>
              <h2 className="section-title">Every Action.<br />Every Event.<br />Fully Traceable.</h2>
              <p className="section-desc">VoteGuard includes an integrated audit architecture that tracks election activity, participation flow, administrative actions, and operational events — creating an immutable governance record.</p>
              <div className="audit-pills">
                <div className="audit-pill">Transparency</div>
                <div className="audit-pill">Accountability</div>
                <div className="audit-pill">Operational Visibility</div>
              </div>
            </div>
            <div className="audit-visual reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="audit-visual-head">
                <span>AUDIT LOG STREAM</span>
                <div className="audit-live"><div className="audit-live-dot"></div><span>Live</span></div>
              </div>
              <div className="audit-logs">
                <span className="ts">14:32:01</span> <span className="ev">VOTE_CAST</span>      <span className="user">user_4821</span>  → election_05<br />
                <span className="ts">14:31:58</span> <span className="ev">TOKEN_GEN</span>     <span className="user">user_4820</span>  → election_05<br />
                <span className="ts">14:31:55</span> <span className="ev">OTP_VERIFY</span>    <span className="user">user_4820</span>  → success<br />
                <span className="ts">14:31:30</span> <span className="ev">ELIGIBILITY</span>   <span className="user">user_4819</span>  → validated<br />
                <span className="ts">14:30:12</span> <span className="ev">RATE_LIMIT</span>    <span className="user">user_4799</span>  → blocked<br />
                <span className="ts">14:29:44</span> <span className="ev">OTP_VERIFY</span>    <span className="user">user_4818</span>  → success<br />
                <span className="ts">14:29:01</span> <span className="ev">ELECTION_START</span> <span className="user">admin</span>       → election_05<br />
                <span className="ts">14:28:40</span> <span className="ev">CONFIG_UPDATE</span> <span className="user">admin</span>       → saved<br />
              </div>
            </div>
          </div>
        </section>

        {/* S7 ADMIN */}
        <section id="admin">
          <div className="admin-layout">
            <div className="reveal">
              <div className="section-label">Admin Control Center</div>
              <h2 className="section-title">Powerful Administrative Governance</h2>
              <div className="admin-features">
                {[
                  { icon: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>, title: 'Election Management', desc: 'Create, configure, and control every election lifecycle' },
                  { icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>, title: 'User Management', desc: 'Manage eligibility, roles, and participation' },
                  { icon: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>, title: 'Results Analytics', desc: 'Live charts, outcomes, and participation data' },
                  { icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />, title: 'System Health & Alerts', desc: 'Full infrastructure observability in one view' },
                ].map((feat, i) => (
                  <div key={i} className="admin-feat">
                    <div className="admin-feat-icon"><svg viewBox="0 0 24 24">{feat.icon}</svg></div>
                    <div><div className="admin-feat-title">{feat.title}</div><div className="admin-feat-desc">{feat.desc}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-dash reveal" style={{ transitionDelay: '0.1s' }}>
              <div className="admin-dash-top">
                <div className="dash-dot"></div><div className="dash-dot"></div><div className="dash-dot"></div>
                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text3)' }}>Admin Control Center</span>
              </div>
              <div className="admin-dash-body">
                <div className="admin-grid">
                  {[
                    { label: 'Total Voters', value: '3,021', trend: '↑ 12 new today' },
                    { label: 'Elections Run', value: '47', trend: '3 active now' },
                    { label: 'Avg. Turnout', value: '91%', trend: '↑ 4% from last' },
                    { label: 'Audit Events', value: '142k', trend: 'All logged' },
                  ].map((tile, i) => (
                    <div key={i} className="admin-tile">
                      <div className="admin-tile-label">{tile.label}</div>
                      <div className="admin-tile-value">{tile.value}</div>
                      <div className="admin-tile-trend">{tile.trend}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.06em', marginBottom: '10px' }}>SYSTEM STATUS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { name: 'Application', status: 'Healthy', color: 'teal' },
                      { name: 'Database', status: 'Online', color: 'teal' },
                      { name: 'Audit Engine', status: 'Active', color: 'teal' },
                      { name: 'OTP Service', status: 'Degraded', color: 'gold' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text2)' }}>{item.name}</span>
                        <span style={{
                          color: `var(--${item.color})`,
                          fontSize: '10px',
                          background: item.color === 'teal' ? 'var(--teal2)' : 'var(--gold2)',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* S8 SECURITY */}
        <section id="security">
          <div className="reveal">
            <div className="section-label">Security</div>
            <h2 className="section-title">Security Built Into<br />Every Layer</h2>
          </div>
          <div className="security-grid">
            {[
              { icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, title: 'OTP Authentication', desc: 'Every login requires time-limited one-time password verification before access is granted.' },
              { icon: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>, title: 'SQL Injection Protection', desc: 'All inputs are parameterized and sanitized against database injection and query manipulation attacks.', delay: '0.05s' },
              { icon: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />, title: 'Token Validation', desc: 'Cryptographic voting tokens are single-use, time-bound, and verified on every request.', delay: '0.1s' },
              { icon: <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>, title: 'Progressive Rate Limiting', desc: 'Escalating rate limits detect and block brute-force, enumeration, and abuse attempts automatically.', delay: '0.15s' },
              { icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, title: 'Secure Sessions', desc: 'HTTPOnly, SameSite cookies with session rotation and expiry enforcement prevent session hijacking.', delay: '0.2s' },
              { icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>, title: 'Audit Monitoring', desc: 'Continuous audit event monitoring detects anomalies and unauthorized access patterns in real time.', delay: '0.25s' },
            ].map((card, i) => (
              <div key={i} className="sec-card reveal" style={card.delay ? { transitionDelay: card.delay } : undefined}>
                <div className="sec-shield"><svg viewBox="0 0 24 24">{card.icon}</svg></div>
                <div className="sec-title">{card.title}</div>
                <div className="sec-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* S9 COMPARISON */}
        <section id="comparison">
          <div className="reveal">
            <div className="section-label">Why VoteGuard</div>
            <h2 className="section-title">More Than a Voting System</h2>
          </div>
          <div className="comp-table-wrap reveal" style={{ transitionDelay: '0.1s' }}>
            <table>
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Traditional Platform</th>
                  <th>VoteGuard</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Anonymous Voting', <span className="cross">✕</span>, <span className="check">✓ Cryptographic separation</span>],
                  ['Audit Tracking', <span className="partial">Partial</span>, <span className="check">✓ Full event log</span>],
                  ['Election Monitoring', <span className="cross">✕</span>, <span className="check">✓ Live dashboard</span>],
                  ['Real-Time Visibility', <span className="cross">✕</span>, <span className="check">✓ Instant updates</span>],
                  ['Reports & Exports', <span className="partial">Manual</span>, <span className="check">✓ Automated generation</span>],
                  ['User Management', <span className="partial">Basic</span>, <span className="check">✓ Role-based access</span>],
                  ['Infrastructure Monitoring', <span className="cross">✕</span>, <span className="check">✓ Full stack health</span>],
                  ['Alert System', <span className="cross">✕</span>, <span className="check">✓ Real-time notifications</span>],
                  ['Administrative Governance', <span className="partial">Limited</span>, <span className="check">✓ Centralized control</span>],
                ].map(([cap, trad, vg], i) => (
                  <tr key={i}><td>{cap}</td><td>{trad}</td><td>{vg}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* S10 USE CASES */}
        <section id="usecases">
          <div className="reveal">
            <div className="section-label">Use Cases</div>
            <h2 className="section-title">Who Is VoteGuard For?</h2>
          </div>
          <div className="use-grid">
            {[
              { icon: '🏛', title: 'Colleges', desc: 'Student body elections with full audit trail and transparency.' },
              { icon: '🎓', title: 'Universities', desc: 'Faculty, senate, and departmental governance elections.', delay: '0.05s' },
              { icon: '🗳', title: 'Student Councils', desc: 'Representative elections with anonymous voting and real-time results.', delay: '0.1s' },
              { icon: '📋', title: 'Department Elections', desc: 'Internal departmental polls and position voting at scale.', delay: '0.15s' },
              { icon: '🏢', title: 'Institutional Committees', desc: 'Board and committee decisions with documented audit records.', delay: '0.2s' },
              { icon: '🌐', title: 'Organizational Elections', desc: 'NGOs, associations, and professional bodies managing member votes.', delay: '0.25s' },
            ].map((card, i) => (
              <div key={i} className="use-card reveal" style={card.delay ? { transitionDelay: card.delay } : undefined}>
                <div className="use-icon">{card.icon}</div>
                <div className="use-title">{card.title}</div>
                <div className="use-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* S11 PHILOSOPHY */}
        <section id="philosophy">
          <div className="reveal">
            <div className="section-label">Philosophy</div>
            <h2 className="section-title">Designed for Trust,<br />Transparency, and Simplicity</h2>
          </div>
          <div className="philosophy-pillars">
            <div className="pillar reveal">
              <div className="pillar-num">01</div>
              <div className="pillar-icon">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M18 3L4 9v9c0 8.3 6 15.6 14 17 8-1.4 14-8.7 14-17V9L18 3z" stroke="#d4a843" strokeWidth="1.5" fill="none" /></svg>
              </div>
              <div className="pillar-title">Security</div>
              <div className="pillar-desc">Every layer of VoteGuard is designed with security as the foundation — from authentication to database to session management.</div>
            </div>
            <div className="pillar reveal" style={{ transitionDelay: '0.08s' }}>
              <div className="pillar-num">02</div>
              <div className="pillar-icon">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="14" stroke="#4a9d8f" strokeWidth="1.5" /><circle cx="18" cy="18" r="6" stroke="#4a9d8f" strokeWidth="1.5" /><line x1="4" y1="18" x2="12" y2="18" stroke="#4a9d8f" strokeWidth="1.5" /><line x1="24" y1="18" x2="32" y2="18" stroke="#4a9d8f" strokeWidth="1.5" /><line x1="18" y1="4" x2="18" y2="12" stroke="#4a9d8f" strokeWidth="1.5" /><line x1="18" y1="24" x2="18" y2="32" stroke="#4a9d8f" strokeWidth="1.5" /></svg>
              </div>
              <div className="pillar-title">Transparency</div>
              <div className="pillar-desc">Full audit visibility into every election event, every action, and every outcome — building institutional trust.</div>
            </div>
            <div className="pillar reveal" style={{ transitionDelay: '0.16s' }}>
              <div className="pillar-num">03</div>
              <div className="pillar-icon">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="5" y="5" width="26" height="26" rx="6" stroke="#c8c0b0" strokeWidth="1.5" /><line x1="12" y1="18" x2="24" y2="18" stroke="#c8c0b0" strokeWidth="1.5" /><line x1="18" y1="12" x2="18" y2="24" stroke="#c8c0b0" strokeWidth="1.5" /></svg>
              </div>
              <div className="pillar-title">Governance</div>
              <div className="pillar-desc">Administrative controls designed for institutional responsibility — with the power to manage at scale and the clarity to govern with confidence.</div>
            </div>
          </div>
        </section>

        {/* S12 CTA */}
        <section id="cta">
          <div className="reveal">
            <div className="section-label">Get Started</div>
            <h2 className="section-title">Ready to Run Your<br />Next Election?</h2>
            <p className="section-desc">Create secure, transparent, and manageable elections using VoteGuard. Trusted by institutions. Engineered for governance.</p>
            <div className="cta-btns">
              <button className="btn-primary" onClick={() => navigate('/portal')}>Go to Login</button>
              <button className="btn-secondary">Contact Administrator</button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="landing-footer">
          <div className="footer-top">
            <div>
              <a href="#" className="nav-logo" style={{ marginBottom: '12px', display: 'inline-flex' }} onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>
                <div className="nav-logo-mark">
                  <span></span><span></span><span></span><span></span>
                </div>
                <span className="nav-wordmark">VoteGuard</span>
              </a>
              <div className="footer-brand-desc">Secure Election Governance Platform for colleges, institutions, and organizations.</div>
            </div>
            <div>
              <div className="footer-col-title">Product</div>
              <ul className="footer-links">
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); scrollTo('solution'); }}>About</a></li>
                <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
                <li><a href="#security" onClick={(e) => { e.preventDefault(); scrollTo('security'); }}>Security</a></li>
                <li><a href="#how" onClick={(e) => { e.preventDefault(); scrollTo('how'); }}>How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Platform</div>
              <ul className="footer-links">
                <li><a href="#audit" onClick={(e) => { e.preventDefault(); scrollTo('audit'); }}>Audit</a></li>
                <li><a href="#admin" onClick={(e) => { e.preventDefault(); scrollTo('admin'); }}>Admin</a></li>
                <li><a href="#comparison" onClick={(e) => { e.preventDefault(); scrollTo('comparison'); }}>Comparison</a></li>
                <li><a href="#usecases" onClick={(e) => { e.preventDefault(); scrollTo('usecases'); }}>Use Cases</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Resources</div>
              <ul className="footer-links">
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Reference</a></li>
                <li><a href="#">Changelog</a></li>
                <li><a href="#">Status</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Legal</div>
              <ul className="footer-links">
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-copy">© 2025 VoteGuard. All rights reserved.</span>
            <span className="footer-copy">Secure Election Governance Platform</span>
          </div>
        </footer>
      </div>
    </>
  );
}
