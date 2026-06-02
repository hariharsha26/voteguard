import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VoterNavigation from '../components/VoterNavigation';
import '../styles/VoterDashboard.css';

export default function VoterDashboard() {
  const navigate = useNavigate();

  // 1. Core Voter Information
  const [voter] = useState({
    name: 'Harsha Vardhan',
    userId: 'STU20264818',
    department: 'Computer Science & Engineering',
    rollNumber: '22CS042',
    email: 'harsha.v22@institution.edu',
    phone: '+91 98765 43210',
    electionStatus: 'Active & Eligible'
  });

  // 2. Navigation Active Tab State
  const [activeTab, setActiveTab] = useState('Home'); // 'Home' | 'My Elections' | 'Results' | 'Activity' | 'Verification' | 'Help'

  // 3. Simulated Elections Database
  const [elections, setElections] = useState([
    {
      id: 'ELC-2026-CR',
      name: 'CR Election 2026',
      description: 'Annual Class Representative Election for final year CSE students. Choose your representative to voice concerns on curriculum, infrastructure, and event scheduling.',
      start: '2026-06-02 09:00 AM',
      end: '2026-06-02 09:00 PM',
      rules: [
        'Each student is entitled to cast exactly one ballot.',
        'The ballot is completely anonymous and cryptographically hashed.',
        'Ensure you keep your generated Verification Token safe after voting.',
        'Polling ends strictly at 09:00 PM.'
      ],
      candidates: [
        {
          id: 'cand-1',
          name: 'Aarav Mehta',
          dept: 'Computer Science & Engineering',
          photo: 'AM',
          manifesto: 'Empowering students through technology, open feedback loops, and infrastructure upgrades. Let\'s build a smarter campus experience together.',
          about: 'Prior Class Rep, tech lead of the university developer club, and open-source advocate.'
        },
        {
          id: 'cand-2',
          name: 'Priya Sharma',
          dept: 'Computer Science & Engineering',
          photo: 'PS',
          manifesto: 'Fostering an inclusive campus culture, organizing industry-led skill workshops, and securing academic support grants for research.',
          about: 'Lead organizer of the women in tech cell, debater, and student senator.'
        }
      ],
      voted: false,
      voteTime: null,
      verificationToken: null,
      resultsPublic: false, // Simulated admin setting
      status: 'Active'
    },
    {
      id: 'ELC-2026-SEN',
      name: 'Senate Representative Poll',
      description: 'Departmental Senate elections to elect representatives for the Academic Council.',
      start: '2026-06-04 10:00 AM',
      end: '2026-06-05 05:00 PM',
      rules: ['Only students with CGPA > 7.0 are eligible to vote.', 'Results will be declared by the Registrar.'],
      candidates: [],
      voted: false,
      voteTime: null,
      verificationToken: null,
      resultsPublic: false,
      status: 'Upcoming'
    },
    {
      id: 'ELC-2025-ALM',
      name: 'Alumni Association Board Selection',
      description: 'Alumni-wide polling for the 2025 Board of Directors selection.',
      start: '2025-05-15 08:00 AM',
      end: '2025-05-17 08:00 PM',
      rules: ['Open to all registered graduates of 2023 and 2024 batches.'],
      candidates: [
        { name: 'Rajesh Kumar', votes: 1240, percentage: 54 },
        { name: 'Meera Patel', votes: 850, percentage: 37 },
        { name: 'Abstain/Invalid', votes: 206, percentage: 9 }
      ],
      voted: true,
      voteTime: '2025-05-16 11:24 AM',
      verificationToken: 'VG-2025-ALM-X982B',
      resultsPublic: true,
      status: 'Completed'
    }
  ]);

  // 4. Selected Election for Details View
  const [selectedElection, setSelectedElection] = useState(null);

  // 5. Active Countdown Timer (Ticks every second)
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 15, seconds: 30 });

  // 6. Interactive Voting States
  const [votingModalOpen, setVotingModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [votingStep, setVotingStep] = useState('select'); // 'select' | 'confirm' | 'otp' | 'success'
  const [otpSent, setOtpSent] = useState(false);
  const [otpInputs, setOtpInputs] = useState(['', '', '', '', '', '']);
  const [toastMessage, setToastMessage] = useState(null);

  // Session Recovery State (Tracks if the user exits mid-voting flow)
  const [sessionSaved, setSessionSaved] = useState(false);
  const [savedCandidate, setSavedCandidate] = useState(null);

  // 7. Simulated Logs / Activity Database
  const [logs, setLogs] = useState([
    { ts: '06:34:02 AM', ev: 'OTP_VERIFY', desc: 'Secure verification successful via email channel', status: 'ok', payload: { channel: 'email', verified: true, ip: '192.168.1.42', client: 'Chrome 125/Windows' } },
    { ts: '06:33:55 AM', ev: 'OTP_SEND', desc: 'Auth key dispatched to harsha.v22@institution.edu', status: 'ok', payload: { type: '2FA_Login', channel: 'SMTP_Relay', status: 'delivered' } },
    { ts: '06:32:01 AM', ev: 'SESSION_START', desc: 'Voter dashboard session initialized for roll 22CS042', status: 'ok', payload: { session_id: 'sess_99a8b712f2e041d5', auth_level: 'voter', check_integrity: 'PASS' } },
    { ts: '06:30:00 AM', ev: 'REGISTER', desc: 'Eligibility credentials pre-signed and checked by registrar ledger', status: 'ok', payload: { department: 'CSE', cohort: '2022-2026', eligibility: 'APPROVED' } }
  ]);

  // 8. Simulated Notifications State
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'Eligibility Updated', message: 'You have been cleared by the Registrar to vote in CR Election 2026.', time: '5 mins ago', read: false },
    { id: 2, type: 'Election Started', message: 'CR Election 2026 is officially live. Please cast your ballot.', time: '15 mins ago', read: false },
    { id: 3, type: 'Election Schedule Changed', message: 'Senate Representative Poll postponed by 24 hours. Check revised dates.', time: '2 hours ago', read: true },
    { id: 4, type: 'Results Published', message: 'Alumni Association Board Selection results are now public.', time: '1 day ago', read: true }
  ]);

  // 9. Help center contact state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  // 10. Selected log for cryptographic details drawer
  const [expandedLog, setExpandedLog] = useState(null);

  // Ticking effect for Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.hours === 0 && prev.minutes === 0 && prev.seconds === 0) {
          clearInterval(timer);
          return prev;
        }
        let s = prev.seconds - 1;
        let m = prev.minutes;
        let h = prev.hours;
        if (s < 0) {
          s = 59;
          m -= 1;
        }
        if (m < 0) {
          m = 59;
          h -= 1;
        }
        return { hours: h, minutes: m, seconds: s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (t) => {
    const hh = String(t.hours).padStart(2, '0');
    const mm = String(t.minutes).padStart(2, '0');
    const ss = String(t.seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // Toast notifier utility
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Logout trigger
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to end your secure voter session? All current context will be wiped.')) {
      navigate('/portal');
    }
  };

  // Notifications logic
  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    triggerToast('All notifications marked as read.');
  };

  const handleClearNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Navigating to participate from home screen status card
  const handleParticipate = () => {
    const crElection = elections.find(e => e.id === 'ELC-2026-CR');
    setSelectedElection(crElection);
    setActiveTab('My Elections');
  };

  // Copy helper
  const handleCopyText = (text, label) => {
    navigator.clipboard.writeText(text);
    triggerToast(`${label} copied to clipboard!`);
  };

  // Help ticket submission
  const handleTicketSubmit = (e) => {
    e.preventDefault();
    if (!ticketSubject || !ticketMessage) {
      alert('Please fill out all fields.');
      return;
    }
    const ticketId = `VG-SUPPORT-${Math.floor(100 + Math.random() * 900)}`;
    triggerToast(`Ticket submitted successfully! Ref: ${ticketId}`);
    setTicketSubject('');
    setTicketMessage('');
  };

  // Closing ballot mid-way: triggers session recovery setup
  const handleCloseVotingModal = () => {
    if (votingStep === 'select' || votingStep === 'confirm' || votingStep === 'otp') {
      if (selectedCandidate) {
        setSessionSaved(true);
        setSavedCandidate(selectedCandidate);
        triggerToast('Ballot progress saved. You can resume from the Dashboard.');
      }
    }
    setVotingModalOpen(false);
  };

  // Resume saved session
  const handleResumeSession = () => {
    setSelectedCandidate(savedCandidate);
    setVotingStep('confirm');
    setVotingModalOpen(true);
    setSessionSaved(false);
    setSavedCandidate(null);
  };

  // Cast ballot step triggers
  const startVoteFlow = (candidate) => {
    setSelectedCandidate(candidate);
    setVotingStep('confirm');
    setVotingModalOpen(true);
  };

  const handleOtpInputChange = (val, index) => {
    if (isNaN(val)) return;
    const newOtp = [...otpInputs];
    newOtp[index] = val;
    setOtpInputs(newOtp);

    // Focus next
    if (val !== '' && index < 5) {
      document.getElementById(`voter-otp-${index + 1}`).focus();
    }
  };

  const handleSendVotingOtp = () => {
    setOtpSent(true);
    triggerToast('Secure OTP sent to registered email.');
  };

  const handleVerifyAndCastBallot = () => {
    const enteredOtp = otpInputs.join('');
    if (enteredOtp.length < 6) {
      alert('Please enter the 6-digit OTP code.');
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const token = `VG-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Update elections state
    setElections(prev => prev.map(el => {
      if (el.id === 'ELC-2026-CR') {
        return {
          ...el,
          voted: true,
          voteTime: timestamp,
          verificationToken: token
        };
      }
      return el;
    }));

    // Update logs
    const newLogs = [
      {
        ts: timestamp,
        ev: 'VOTE_CAST',
        desc: `Ballot securely cast in CR Election 2026. Rec: Candidate-${selectedCandidate.name[0]}`,
        status: 'ok',
        payload: {
          election: 'CR Election 2026',
          voter_id: 'STU20264818',
          tx_hash: 'f0e2b81d8a4a569cb238df81c8189872e428df19ab8a8b111',
          algorithm: 'ECDSA_SHA256',
          blind_signature: 'sig_382d9fb2ea3810a9cf18',
          verification_id: token
        }
      },
      {
        ts: timestamp,
        ev: 'TOKEN_GEN',
        desc: `Cryptographic vote verification token generated for election ELC-2026-CR`,
        status: 'ok',
        payload: { token: token, issued_to_hash: 'd8a7c2b5e1', ledger_block: 28482 }
      },
      ...logs
    ];
    setLogs(newLogs);

    // Update Notifications
    setNotifications(prev => [
      { id: Date.now(), type: 'Vote Submitted', message: 'Your vote for CR Election 2026 has been successfully cast.', time: 'Just now', read: false },
      { id: Date.now() + 1, type: 'Verification Complete', message: `Verification token issued: ${token}`, time: 'Just now', read: false },
      ...prev
    ]);

    setVotingStep('success');
    setSessionSaved(false);
    setSavedCandidate(null);
  };

  // Demo Control: Toggle results public/private for testing
  const toggleCRResults = () => {
    setElections(prev => prev.map(el => {
      if (el.id === 'ELC-2026-CR') {
        const nextState = !el.resultsPublic;
        triggerToast(`CR Election results are now ${nextState ? 'PUBLIC' : 'PRIVATE'} (Simulated admin action)`);
        return { ...el, resultsPublic: nextState };
      }
      return el;
    }));
  };

  const crElection = elections.find(e => e.id === 'ELC-2026-CR');

  return (
    <div className="voter-dashboard-container">
      {/* Toast Alert notifications */}
      {toastMessage && (
        <div className="voter-toast-alert">
          <div className="toast-glow-border" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Navigation Wrapper */}
      <VoterNavigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // If we navigate to "My Elections", we clear selectedElection to show listing
          if (tab === 'My Elections') setSelectedElection(null);
        }}
        voter={voter}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onClearNotification={handleClearNotification}
        onLogout={handleLogout}
      />

      <main className="voter-main-viewport">
        
        {/* ==========================================
            TAB 1: HOME PAGE
           ========================================== */}
        {activeTab === 'Home' && (
          <div className="tab-pane-view fade-in">
            {/* Header Greetings & Info */}
            <div className="dashboard-voter-banner">
              <div className="banner-greeting">
                <span className="greeting-eyebrow">Secure Election Portal</span>
                <h1>Welcome back, <em>{voter.name}</em></h1>
                <p>Verify your details, cast your ballot, and check audited tallies securely. All actions are cryptographically signed.</p>
              </div>

              <div className="voter-quick-info-grid">
                <div className="info-stat-card">
                  <span className="info-lbl">Roll Number</span>
                  <span className="info-val">{voter.rollNumber}</span>
                </div>
                <div className="info-stat-card">
                  <span className="info-lbl">Department</span>
                  <span className="info-val truncate">{voter.department}</span>
                </div>
                <div className="info-stat-card">
                  <span className="info-lbl">System Authorization</span>
                  <span className="info-val-badge green">Authorized</span>
                </div>
              </div>
            </div>

            {/* Session Recovery Banner */}
            {sessionSaved && (
              <div className="session-recovery-banner">
                <div className="banner-sec-icon">⚠️</div>
                <div className="banner-recovery-msg">
                  <strong>Election Participation Saved:</strong> You were in the middle of casting your vote for <strong>CR Election 2026</strong>.
                </div>
                <button className="btn-resume-session" onClick={handleResumeSession}>
                  Continue Voting →
                </button>
              </div>
            )}

            <div className="home-dashboard-row">
              {/* Left Column: Election Status Widget */}
              <div className="home-column-left">
                <div className="election-widget-card">
                  <div className="widget-header">
                    <div className="live-pill">
                      <span className="live-dot" />
                      LIVE ELECTION
                    </div>
                    <span className="election-id">ID: ELC-2026-CR</span>
                  </div>

                  <h2 className="widget-election-title">CR Election 2026</h2>
                  
                  {/* Countdown Timer */}
                  <div className="widget-countdown-box">
                    <span className="countdown-label">TIME REMAINING</span>
                    <span className="countdown-timer">{formatTime(timeLeft)}</span>
                  </div>

                  {/* Vote Status Indicator */}
                  <div className="widget-status-indicator">
                    <span className="status-label">Vote Status</span>
                    {crElection.voted ? (
                      <div className="vote-status-confirmed-pill">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        <span>Vote Submitted at {crElection.voteTime}</span>
                      </div>
                    ) : (
                      <div className="vote-status-pending-pill animate-pulse">
                        <span className="status-dot-pending" />
                        <span>Pending Vote</span>
                      </div>
                    )}
                  </div>

                  {/* CTA button */}
                  {crElection.voted ? (
                    <button className="btn-widget-action voted" onClick={handleParticipate}>
                      View Election Details
                    </button>
                  ) : (
                    <button className="btn-widget-action active" onClick={handleParticipate}>
                      Participate / Vote Now →
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Recent Activity & Security */}
              <div className="home-column-right">
                {/* Recent Activity */}
                <div className="home-card-panel">
                  <div className="panel-header">
                    <h3>Recent Activity</h3>
                    <button className="panel-header-action-btn" onClick={() => setActiveTab('Activity')}>View All</button>
                  </div>
                  
                  <div className="recent-activity-list">
                    {logs.slice(0, 3).map((log, index) => (
                      <div key={index} className="activity-item-simple">
                        <div className="activity-time-lbl">[{log.ts.split(' ')[0]}]</div>
                        <div className="activity-details-col">
                          <span className="activity-event-name">{log.ev}</span>
                          <span className="activity-event-desc">{log.desc}</span>
                        </div>
                        <span className="activity-check-icon">✓</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Secure Guidelines */}
                <div className="home-card-panel bg-gradient-panel">
                  <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>Trust &amp; Secrecy Policy</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.5' }}>
                    VoteGuard ensures mathematical secrecy. Your ballot is detached from your registration token, encrypted locally, and transmitted anonymously. The system operator has no technical means of linking voter identities to cast ballots.
                  </p>
                  <div className="security-badges-wrap" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <span className="sec-tag">Blind Signatures</span>
                    <span className="sec-tag">AES-256 Ledger</span>
                    <span className="sec-tag">SHA-256 Audit</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Demo Controller Widget */}
            <div className="demo-controller-card">
              <div className="demo-header">
                <span className="demo-icon">⚙️</span>
                <strong>SIMULATOR CONTROL (DEMO UTILITY)</strong>
              </div>
              <p>Simulate administrative changes to verify responsiveness and real-time interface rendering.</p>
              <div className="demo-buttons-row">
                <button className="btn-demo-util" onClick={toggleCRResults}>
                  Toggle "CR Election 2026" Results (Currently: {crElection.resultsPublic ? 'Public' : 'Private'})
                </button>
                <button className="btn-demo-util" onClick={() => {
                  setElections(prev => prev.map(e => e.id === 'ELC-2026-CR' ? { ...e, voted: false, voteTime: null, verificationToken: null } : e));
                  setSessionSaved(false);
                  setSavedCandidate(null);
                  triggerToast('CR Election Vote Status Reset!');
                }}>
                  Reset Vote Status (Allow Re-voting)
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            TAB 2: MY ELECTIONS
           ========================================== */}
        {activeTab === 'My Elections' && (
          <div className="tab-pane-view fade-in">
            {!selectedElection ? (
              // Listing View
              <>
                <div className="page-intro-header">
                  <h1>My Elections</h1>
                  <p>Below are the election lifecycles you are registered for. Select an election to view detailed candidate profiles, manifestos, and cast your ballot.</p>
                </div>

                <div className="elections-grid-container">
                  {elections.map((elec) => (
                    <div key={elec.id} className={`election-card-item ${elec.status.toLowerCase()}`}>
                      <div className="card-badge-line">
                        <span className={`status-badge-lbl ${elec.status.toLowerCase()}`}>{elec.status}</span>
                        <span className="card-election-id">{elec.id}</span>
                      </div>

                      <h3 className="card-title-text">{elec.name}</h3>
                      <p className="card-desc-text">{elec.description.substring(0, 100)}...</p>

                      <div className="card-stats-row">
                        <div className="card-stat">
                          <span className="lbl">Start Time</span>
                          <span className="val">{elec.start.split(' ')[0]}</span>
                        </div>
                        <div className="card-stat">
                          <span className="lbl">Status</span>
                          {elec.voted ? (
                            <span className="val success">✓ Voted</span>
                          ) : elec.status === 'Active' ? (
                            <span className="val warning">Pending</span>
                          ) : (
                            <span className="val">{elec.status === 'Completed' ? 'Closed' : 'Scheduled'}</span>
                          )}
                        </div>
                      </div>

                      <button className="btn-card-details" onClick={() => setSelectedElection(elec)}>
                        View Details &amp; Candidates →
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // Details View
              <div className="election-detail-panel fade-in">
                <button className="btn-back-to-list" onClick={() => setSelectedElection(null)}>
                  ← Back to Elections
                </button>

                <div className="detail-header-block">
                  <div className="detail-meta-line">
                    <span className={`status-badge-lbl ${selectedElection.status.toLowerCase()}`}>{selectedElection.status}</span>
                    <span className="detail-election-id">ID: {selectedElection.id}</span>
                  </div>
                  <h1 className="detail-title">{selectedElection.name}</h1>
                  <p className="detail-desc">{selectedElection.description}</p>
                </div>

                <div className="detail-grid-sections">
                  {/* Left Column: Candidates list */}
                  <div className="detail-col-candidates">
                    <h2 className="section-subtitle">Candidates</h2>
                    
                    {selectedElection.candidates.length === 0 ? (
                      <div className="empty-candidates-card">
                        No candidates registered for this poll yet.
                      </div>
                    ) : (
                      <div className="candidates-list-stack">
                        {selectedElection.candidates.map((cand) => (
                          <div key={cand.id} className="candidate-profile-card">
                            <div className="cand-profile-header">
                              <div className="cand-avatar" style={{ background: 'linear-gradient(135deg, var(--teal), var(--teal3))' }}>
                                {cand.photo}
                              </div>
                              <div className="cand-identity">
                                <h3>{cand.name}</h3>
                                <span>{cand.dept}</span>
                              </div>
                            </div>
                            
                            <div className="cand-info-body">
                              <p className="cand-about"><strong>About:</strong> {cand.about}</p>
                              <div className="cand-manifesto-quote">
                                <strong>Manifesto:</strong> "{cand.manifesto}"
                              </div>
                            </div>

                            {/* Vote CTA */}
                            {selectedElection.status === 'Active' && !selectedElection.voted && (
                              <button className="btn-candidate-vote-select" onClick={() => startVoteFlow(cand)}>
                                Vote for {cand.name}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Election rules & guidelines */}
                  <div className="detail-col-rules">
                    <div className="sticky-rules-card">
                      <h3>Election Guidelines</h3>
                      <ul className="rules-list-items">
                        {selectedElection.rules.map((rule, idx) => (
                          <li key={idx}>{rule}</li>
                        ))}
                      </ul>

                      <div className="ballot-status-box-rules">
                        <h4>Your Ballot Status</h4>
                        {selectedElection.voted ? (
                          <div className="ballot-voted-info">
                            <span className="badge-voted-tick">✓ Vote Cast Successfully</span>
                            <div className="token-details-sub">
                              <span className="lbl">Token ID:</span>
                              <div className="token-copy-row">
                                <code>{selectedElection.verificationToken}</code>
                                <button className="btn-mini-copy" onClick={() => handleCopyText(selectedElection.verificationToken, 'Verification Token')}>Copy</button>
                              </div>
                            </div>
                          </div>
                        ) : selectedElection.status === 'Active' ? (
                          <div className="ballot-pending-info">
                            <span className="badge-pending-cross">❌ Ballot Pending Cast</span>
                            <p>You have not voted in this election yet. Select a candidate on the left to cast your secure ballot.</p>
                          </div>
                        ) : (
                          <div className="ballot-closed-info">
                            <span className="badge-closed-lbl">⛔ Election Closed</span>
                            <p>This election has ended. Results are available on the Results page.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECURE BALLOT VOTING DIALOG MODAL */}
            {votingModalOpen && (
              <div className="voting-modal-backdrop">
                <div className="voting-modal-card">
                  
                  {/* Step Header */}
                  <div className="modal-header">
                    <div className="secure-badge">
                      <span className="lock-icon">🔒</span>
                      <span>SECURE ANONYMOUS BALLOT</span>
                    </div>
                    <button className="btn-modal-close" onClick={handleCloseVotingModal}>×</button>
                  </div>

                  {/* Modal Body depending on Step */}
                  
                  {/* STEP 1: CONFIRM */}
                  {votingStep === 'confirm' && (
                    <div className="modal-body-step fade-in">
                      <h2 className="modal-body-title">Confirm Candidate Selection</h2>
                      <p>You are about to cast your single vote in <strong>CR Election 2026</strong> for:</p>
                      
                      <div className="selected-candidate-preview-box">
                        <div className="avatar-preview">{selectedCandidate.photo}</div>
                        <div className="identity-preview">
                          <h3>{selectedCandidate.name}</h3>
                          <span>{selectedCandidate.dept}</span>
                        </div>
                      </div>

                      <div className="cryptographic-warning-box">
                        <strong>Important Security Information:</strong>
                        <p>Upon clicking "Proceed", VoteGuard will generate an anonymous blind signature token. You will verify your identity via email OTP before submitting the ledger block. Once cast, this choice is absolute and cryptographically unlinked from your ID.</p>
                      </div>

                      <div className="modal-footer-btns">
                        <button className="btn-modal-back" onClick={() => setVotingModalOpen(false)}>Cancel</button>
                        <button className="btn-modal-proceed" onClick={handleSendVotingOtp}>Proceed &amp; Verify Identity</button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: OTP VERIFICATION */}
                  {votingStep === 'otp' && (
                    <div className="modal-body-step fade-in">
                      <h2 className="modal-body-title">Identity Verification</h2>
                      <p>A secure 6-digit one-time password has been sent to <strong>{voter.email}</strong>. Enter the verification code to cast your ballot.</p>

                      <div className="otp-digit-inputs-row">
                        {otpInputs.map((val, idx) => (
                          <input
                            key={idx}
                            id={`voter-otp-${idx}`}
                            type="text"
                            maxLength="1"
                            value={val}
                            onChange={(e) => handleOtpInputChange(e.target.value, idx)}
                            className="otp-digit-box"
                            autoComplete="off"
                          />
                        ))}
                      </div>

                      <div className="otp-modal-actions">
                        <span>Didn't receive code? <button className="btn-link-action" onClick={handleSendVotingOtp}>Resend</button></span>
                        {otpSent && <span style={{ color: 'var(--teal)', fontSize: '11px', display: 'block', marginTop: '4px' }}>✓ Verification code dispatched.</span>}
                      </div>

                      <div className="modal-footer-btns">
                        <button className="btn-modal-back" onClick={() => setVotingStep('confirm')}>Back</button>
                        <button className="btn-modal-cast" onClick={handleVerifyAndCastBallot}>Confirm &amp; Cast Ballot 🗳</button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: SUCCESS */}
                  {votingStep === 'success' && (
                    <div className="modal-body-step success-step-center fade-in">
                      <div className="success-lottie-mock-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      
                      <h2 className="modal-body-title success">Vote Successfully Cast!</h2>
                      <p>Your ballot has been cryptographically signed and written to the secure election audit log.</p>

                      <div className="success-verification-receipt-card">
                        <span className="receipt-lbl">ELECTION VERIFICATION TOKEN</span>
                        <div className="receipt-token-row">
                          <code className="receipt-token">{crElection.verificationToken}</code>
                          <button className="btn-receipt-copy" onClick={() => handleCopyText(crElection.verificationToken, 'Verification Token')}>Copy Token</button>
                        </div>
                        <p className="receipt-disclaimer">
                          This token allows you to independently audit that your ballot was successfully recorded in the audit trace, without compromising your privacy.
                        </p>
                      </div>

                      <button className="btn-modal-done" onClick={() => { setVotingModalOpen(false); setActiveTab('Home'); }}>
                        Return to Cockpit
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        )}

        {/* ==========================================
            TAB 3: RESULTS PAGE
           ========================================== */}
        {activeTab === 'Results' && (
          <div className="tab-pane-view fade-in">
            <div className="page-intro-header">
              <h1>Election Results</h1>
              <p>Explore voting results and statistical breakdowns of completed elections. Turnout metrics and blockchain tallies are made public per election configurations.</p>
            </div>

            <div className="results-stack-container">
              {/* Election 1: Active CR Election */}
              <div className="results-panel-card">
                <div className="results-header-info">
                  <div className="left-info">
                    <h3>CR Election 2026</h3>
                    <span className="results-id">ID: ELC-2026-CR</span>
                  </div>
                  <div className="right-info">
                    <span className="results-status-badge active">Active Poll</span>
                  </div>
                </div>

                <div className="results-content-box">
                  {crElection.resultsPublic ? (
                    // Simulated public live standing charts
                    <div className="live-standings-chart-block">
                      <div className="live-indicator-tag">
                        <span className="pulsing-live-dot" />
                        LIVE OUTCOME STANDINGS (PUBLIC TALLY)
                      </div>

                      <div className="standings-bars-wrap">
                        {/* Candidate A */}
                        <div className="standing-bar-row">
                          <div className="standing-cand-meta">
                            <span className="cand-name-lbl">Aarav Mehta</span>
                            <span className="cand-pct-val">58% (1,247 votes)</span>
                          </div>
                          <div className="chart-bar-container">
                            <div className="chart-bar-fill teal-fill" style={{ width: '58%' }} />
                          </div>
                        </div>

                        {/* Candidate B */}
                        <div className="standing-bar-row">
                          <div className="standing-cand-meta">
                            <span className="cand-name-lbl">Priya Sharma</span>
                            <span className="cand-pct-val">42% (903 votes)</span>
                          </div>
                          <div className="chart-bar-container">
                            <div className="chart-bar-fill" style={{ width: '42%' }} />
                          </div>
                        </div>
                      </div>

                      <p className="results-public-warning">
                        ⚠️ These standings represent the live cryptographic tally feed. Final outcomes will lock upon closing at 09:00 PM.
                      </p>
                    </div>
                  ) : (
                    // Securely locked standings
                    <div className="results-locked-state">
                      <div className="locked-shield-icon">🔒</div>
                      <h4>Results Temporarily Locked</h4>
                      <p>
                        The administrator has configured results for this election to be **Private** during the live voting period to prevent turnout bias. Visual standcharts and candidate vote breakdowns will be released once the polling window closes.
                      </p>
                      <div className="turnout-indicator-badge">
                        Current Voter Turnout: <strong>94%</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Election 2: Completed Alumni Selection */}
              <div className="results-panel-card">
                <div className="results-header-info">
                  <div className="left-info">
                    <h3>Alumni Association Board Selection</h3>
                    <span className="results-id">ID: ELC-2025-ALM</span>
                  </div>
                  <div className="right-info">
                    <span className="results-status-badge completed">Completed</span>
                  </div>
                </div>

                <div className="results-content-box">
                  <div className="live-standings-chart-block">
                    <div className="live-indicator-tag final">
                      🏆 FINAL AUDITED OUTCOMES (100% BLOCKS VERIFIED)
                    </div>

                    <div className="standings-bars-wrap">
                      {/* Candidate 1 */}
                      <div className="standing-bar-row">
                        <div className="standing-cand-meta">
                          <span className="cand-name-lbl">Rajesh Kumar (Winner)</span>
                          <span className="cand-pct-val">54% (1,240 votes)</span>
                        </div>
                        <div className="chart-bar-container">
                          <div className="chart-bar-fill gold-fill" style={{ width: '54%' }} />
                        </div>
                      </div>

                      {/* Candidate 2 */}
                      <div className="standing-bar-row">
                        <div className="standing-cand-meta">
                          <span className="cand-name-lbl">Meera Patel</span>
                          <span className="cand-pct-val">37% (850 votes)</span>
                        </div>
                        <div className="chart-bar-container">
                          <div className="chart-bar-fill" style={{ width: '37%' }} />
                        </div>
                      </div>

                      {/* Abstain */}
                      <div className="standing-bar-row">
                        <div className="standing-cand-meta">
                          <span className="cand-name-lbl">Abstain / Invalid</span>
                          <span className="cand-pct-val">9% (206 votes)</span>
                        </div>
                        <div className="chart-bar-container">
                          <div className="chart-bar-fill grey-fill" style={{ width: '9%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="completed-stats-row">
                      <div className="comp-stat-badge">Total Votes: <strong>2,296</strong></div>
                      <div className="comp-stat-badge">Turnout: <strong>91%</strong></div>
                      <div className="comp-stat-badge font-mono">Hash: a8f1b2c4d9...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: ACTIVITY (TIMELINE) PAGE
           ========================================== */}
        {activeTab === 'Activity' && (
          <div className="tab-pane-view fade-in">
            <div className="page-intro-header">
              <h1>My Activity Log</h1>
              <p>Review the complete cryptographically signed audit trace of your voter session. All activities are recorded with timestamps, event codes, and transaction hashes.</p>
            </div>

            <div className="activity-timeline-wrapper">
              <div className="timeline-trail-line" />
              
              <div className="timeline-items-stack">
                {logs.map((log, idx) => (
                  <div key={idx} className="timeline-item-card">
                    <div className="timeline-bullet-dot" />
                    
                    <div className="timeline-card-header">
                      <div className="header-meta">
                        <span className={`event-badge ${log.status}`}>{log.ev}</span>
                        <span className="event-timestamp">{log.ts}</span>
                      </div>
                      <button className="btn-toggle-payload" onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}>
                        {expandedLog === idx ? 'Hide Payload' : 'Show Payload'}
                      </button>
                    </div>

                    <p className="timeline-card-desc">{log.desc}</p>

                    {expandedLog === idx && (
                      <div className="timeline-payload-viewer fade-in">
                        <span className="payload-label">Ledger Payload JSON (Signed)</span>
                        <pre className="payload-code">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: VERIFICATION PAGE
           ========================================== */}
        {activeTab === 'Verification' && (
          <div className="tab-pane-view fade-in">
            <div className="page-intro-header">
              <h1>Election Verification</h1>
              <p>Check the registration, verification, and audit trace statuses of your votes. Use verification tokens to confirm inclusion in the blockchain tally.</p>
            </div>

            <div className="verification-cards-stack">
              {/* ELC 1: CR Election */}
              <div className="verification-status-card-box">
                <div className="verification-card-header">
                  <h3>CR Election 2026</h3>
                  <span className="elec-badge-id">ELC-2026-CR</span>
                </div>

                <div className="verification-card-body">
                  <div className="v-row">
                    <span className="v-lbl">Election:</span>
                    <span className="v-val">CR Election 2026</span>
                  </div>

                  <div className="v-row">
                    <span className="v-lbl">Verification Token:</span>
                    {crElection.voted ? (
                      <div className="token-visualizer-box">
                        <code className="token-code-text">{crElection.verificationToken}</code>
                        <button className="btn-token-copy-action" onClick={() => handleCopyText(crElection.verificationToken, 'Verification Token')}>
                          Copy Token
                        </button>
                      </div>
                    ) : (
                      <span className="v-val status-pending-text">Pending (Cast your vote first)</span>
                    )}
                  </div>

                  <div className="v-row">
                    <span className="v-lbl">Audited Status:</span>
                    {crElection.voted ? (
                      <span className="v-val status-success-text">
                        <span className="bullet-indicator-success" />
                        ✓ Vote Successfully Recorded &amp; Audited
                      </span>
                    ) : (
                      <span className="v-val status-pending-text">
                        <span className="bullet-indicator-pending" />
                        ❌ Ballot Not Cast Yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ELC 2: Alumni Selection */}
              <div className="verification-status-card-box">
                <div className="verification-card-header">
                  <h3>Alumni Association Board Selection</h3>
                  <span className="elec-badge-id">ELC-2025-ALM</span>
                </div>

                <div className="verification-card-body">
                  <div className="v-row">
                    <span className="v-lbl">Election:</span>
                    <span className="v-val">Alumni Association Board Selection</span>
                  </div>

                  <div className="v-row">
                    <span className="v-lbl">Verification Token:</span>
                    <div className="token-visualizer-box">
                      <code className="token-code-text">VG-2025-ALM-X982B</code>
                      <button className="btn-token-copy-action" onClick={() => handleCopyText('VG-2025-ALM-X982B', 'Verification Token')}>
                        Copy Token
                      </button>
                    </div>
                  </div>

                  <div className="v-row">
                    <span className="v-lbl">Audited Status:</span>
                    <span className="v-val status-success-text">
                      <span className="bullet-indicator-success" />
                      ✓ Vote Successfully Recorded &amp; Audited
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 6: HELP PAGE
           ========================================== */}
        {activeTab === 'Help' && (
          <div className="tab-pane-view fade-in">
            <div className="page-intro-header">
              <h1>Help &amp; Support Center</h1>
              <p>Browse detailed platform tutorials or contact the election audit officers. VoteGuard is open, cryptographically secure, and governed strictly by institutional rules.</p>
            </div>

            <div className="help-grid-layout">
              {/* Left Side: FAQs Accordion */}
              <div className="help-column-faqs">
                <h2 className="help-section-title">Frequently Asked Questions</h2>
                
                <div className="faq-accordion-stack">
                  <div className="faq-item-card">
                    <h4 className="faq-question">How does VoteGuard guarantee ballot secrecy?</h4>
                    <p className="faq-answer">
                      VoteGuard detaches your verified identity tokens from your cast ballot using cryptographic blind signatures. The platform records your vote in the audit ledger anonymously, meaning no database administrator can link your profile to your choice.
                    </p>
                  </div>

                  <div className="faq-item-card">
                    <h4 className="faq-question">Can I change my vote after it is submitted?</h4>
                    <p className="faq-answer">
                      No. Once written, signed, and validated into the decentralized ledger block, votes are completely immutable and cannot be edited, deleted, or re-cast.
                    </p>
                  </div>

                  <div className="faq-item-card">
                    <h4 className="faq-question">What is a Verification Token?</h4>
                    <p className="faq-answer">
                      A verification token is a unique cryptographic string generated for your ballot. It matches the block receipt on the ledger, allowing you to audit the election and verify that your vote was successfully counted in the final tally without revealing your choice.
                    </p>
                  </div>

                  <div className="faq-item-card">
                    <h4 className="faq-question">What should I do if my session expires mid-vote?</h4>
                    <p className="faq-answer">
                      If your browser reloads or your session drops, VoteGuard recovers your active state securely. Simply re-authenticate, and the dashboard will prompt you to resume your ballot entry exactly where you left off.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side: Contact Support Form */}
              <div className="help-column-support-form">
                <div className="support-contact-card">
                  <h3>Submit Support Ticket</h3>
                  <p>Encountering issues casting your ballot or validating your Roll Number? Submit a secure inquiry directly to the presiding election audit commissioner.</p>

                  <form className="support-form-element" onSubmit={handleTicketSubmit}>
                    <div className="form-field">
                      <label htmlFor="ticket-subj-inp">INQUIRY SUBJECT</label>
                      <input 
                        id="ticket-subj-inp"
                        type="text" 
                        placeholder="e.g. Verification token discrepancy" 
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="ticket-msg-inp">MESSAGE DETAILS</label>
                      <textarea 
                        id="ticket-msg-inp"
                        rows="4" 
                        placeholder="Describe the issue in details..." 
                        value={ticketMessage}
                        onChange={(e) => setTicketMessage(e.target.value)}
                        required
                      />
                    </div>

                    <button type="submit" className="btn-support-submit">
                      Dispatch Ticket Commission
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
