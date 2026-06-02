import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VoterNavigation from '../components/VoterNavigation';
import '../styles/VoterDashboard.css';
import { IconShield, IconSettings, IconBulb, IconAlertTriangle, IconLock, IconBox, IconTrophy, IconX, IconInfoCircle } from '@tabler/icons-react';

export default function VoterDashboard() {
  const navigate = useNavigate();

  // 1. Core Voter Information
  const [voter, setVoter] = useState({
    name: 'Aarav Mehta',
    userId: 'VG20260087',
    department: 'Computer Science & Engineering',
    rollNumber: '21BCE087',
    institution: 'Vidyavardhini Institute of Technology',
    year: '3rd Year',
    email: 'aarav.mehta@vit.edu',
    phone: '+91 98765 43210',
    electionStatus: 'Active & Eligible',
    memberSince: '14 Aug 2024',
    accountStatus: 'Active',
    avatarUrl: '/aarav_mehta_avatar.png'
  });

  // 2. Navigation Active Tab State
  const [activeTab, setActiveTab] = useState('Home'); // 'Home' | 'My Elections' | 'Results' | 'Activity' | 'Verification' | 'Help' | 'Profile'
  const [editingProfile, setEditingProfile] = useState(false);

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
      status: 'Active',
      type: 'Private'
    },
    {
      id: 'ELC-2026-SEN',
      name: 'Senate Representative Poll',
      description: 'Departmental Senate elections to elect representatives for the Academic Council.',
      start: '2026-06-02 10:00 AM',
      end: '2026-06-03 05:00 PM',
      rules: ['Only students with CGPA > 7.0 are eligible to vote.', 'Results will be declared by the Registrar.'],
      candidates: [
        {
          id: 'cand-s1',
          name: 'Vikram Aditya',
          dept: 'Electrical Engineering',
          photo: 'VA',
          manifesto: 'Advocating for better research lab infrastructure, library hours extension, and interdisciplinary project funding.',
          about: 'IEEE Student Branch Chair, academic topper, and roboticist.'
        },
        {
          id: 'cand-s2',
          name: 'Ananya Roy',
          dept: 'Electronics & Communication',
          photo: 'AR',
          manifesto: 'Promoting student mental wellness programs, sports facility upgrades, and annual cultural fest collaborations.',
          about: 'Vice-President of the Cultural Society, badminton captain, and student counsellor.'
        }
      ],
      voted: false,
      voteTime: null,
      verificationToken: null,
      resultsPublic: false,
      status: 'Active',
      type: 'Public'
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
      status: 'Completed',
      type: 'Private'
    }
  ]);

  // 4. Selected Election for Details View
  const [selectedElection, setSelectedElection] = useState(null);

  // 5. Active Countdown Timer (Ticks every second)
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 15, seconds: 30 });

  // 6. Guided Voting Experience States (13-Step Flow)
  const [activeWizardElection, setActiveWizardElection] = useState(null);
  const [wizardStep, setWizardStep] = useState(null); // null | 'access_code_validating' | 'access_code_invalid' | 'details' | 'eligibility_validating' | 'eligible_confirmed' | 'token_generating' | 'token_gen_complete' | 'token_entry' | 'token_verifying' | 'token_verified' | 'candidate_select' | 'vote_review' | 'submitting' | 'success'
  const [wizardLoadingMessage, setWizardLoadingMessage] = useState('');
  const [wizardLoadingProgress, setWizardLoadingProgress] = useState(0);
  const [wizardSessionId, setWizardSessionId] = useState('');
  const [wizardGeneratedToken, setWizardGeneratedToken] = useState('');
  const [wizardTokenInput, setWizardTokenInput] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Validation, Rate Limiting & Recovery States
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [tokenAttempts, setTokenAttempts] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [sessionRecovery, setSessionRecovery] = useState(null);

  // 7. Simulated Logs / Activity Database (Step 12 Setup)
  const [logs, setLogs] = useState([
    { ts: new Date().toLocaleTimeString(), ev: 'OTP_VERIFIED', desc: 'Secure two-factor verification successful via email channel', status: 'ok', payload: { channel: 'email', verified: true } },
    { ts: new Date().toLocaleTimeString(), ev: 'LOGGED_IN', desc: 'Secure voter session initialized', status: 'ok', payload: { auth_level: 'voter', check_integrity: 'PASS' } }
  ]);

  const addAuditLog = (ev, desc, payload = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [
      {
        ts: timestamp,
        ev: ev,
        desc: desc,
        status: 'ok',
        payload: payload
      },
      ...prev
    ]);
  };

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

  // Ticking effect for Token Cooldown (Rate Limiting Countdown)
  useEffect(() => {
    if (cooldownTimeLeft <= 0) return;
    const cdTimer = setInterval(() => {
      setCooldownTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(cdTimer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cdTimer);
  }, [cooldownTimeLeft]);

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
    launchVotingWizard(crElection);
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

  // Step 11 & Recovery: Closing ballot mid-way saves the state
  const handleCloseVotingModal = () => {
    if (activeWizardElection && wizardStep !== 'success') {
      setSessionRecovery({
        electionId: activeWizardElection.id,
        step: wizardStep,
        selectedCandidate: selectedCandidate,
        generatedToken: wizardGeneratedToken
      });
      addAuditLog('SESSION_SAVED', `Secure voting session saved at step: ${wizardStep}`);
      triggerToast('Election session saved. You can resume later.');
    }
    setActiveWizardElection(null);
    setWizardStep(null);
    setAccessCodeInput('');
  };

  // Resume saved session (Step 11)
  const handleResumeSession = () => {
    if (!sessionRecovery) return;
    const recoveryElec = elections.find(e => e.id === sessionRecovery.electionId);
    setActiveWizardElection(recoveryElec);
    setWizardStep(sessionRecovery.step);
    setSelectedCandidate(sessionRecovery.selectedCandidate);
    setWizardGeneratedToken(sessionRecovery.generatedToken);
    
    addAuditLog('SESSION_RESUMED', `Secure voting session resumed for ${recoveryElec.name}`);
    setSessionRecovery(null);
  };

  // Launch the Guided Voting Experience (Step 1)
  const launchVotingWizard = (election) => {
    if (election.voted) {
      triggerToast('You have already voted in this election.');
      return;
    }
    setActiveWizardElection(election);
    setSelectedCandidate(null);
    setWizardTokenInput('');
    setTokenAttempts(0);
    
    // For public elections, go straight to Details (Step 3). For private, Access Code entry is required.
    if (election.type === 'Public') {
      addAuditLog('ELECTION_JOINED', `Public election session initialized for ${election.name}`);
      setWizardStep('details');
    } else {
      setWizardStep('access_code_entry');
    }
  };

  // Step 2: Access Code Validation (Private Elections Only)
  const handleJoinPrivateElection = () => {
    if (!accessCodeInput.trim()) {
      alert('Please enter an Access Code.');
      return;
    }
    
    setWizardStep('access_code_validating');
    setWizardLoadingProgress(0);
    setWizardLoadingMessage('Searching election...');

    const messages = [
      'Searching election...',
      'Validating access code...',
      'Checking voter eligibility...',
      'Preparing election session...',
      'Access granted.'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setWizardLoadingProgress(currentStep * 20);
      if (currentStep < messages.length) {
        setWizardLoadingMessage(messages[currentStep]);
      }
      if (currentStep === 5) {
        clearInterval(interval);
        // Correct access code is VG-ACCESS-CR26
        if (accessCodeInput.trim().toUpperCase() === 'VG-ACCESS-CR26') {
          addAuditLog('ELECTION_JOINED', 'Private election ELC-2026-CR joined');
          addAuditLog('ACCESS_CODE_VERIFIED', 'Access code VG-ACCESS-CR26 successfully verified');
          
          const crElection = elections.find(e => e.id === 'ELC-2026-CR');
          setActiveWizardElection(crElection);
          setWizardStep('details');
        } else {
          setWizardStep('access_code_invalid');
        }
      }
    }, 500);
  };

  // Step 4: Eligibility Validation loading
  const startIdentityValidation = () => {
    setWizardStep('eligibility_validating');
    setWizardLoadingProgress(0);
    setWizardLoadingMessage('Verifying voter identity...');

    const messages = [
      'Verifying voter identity...',
      'Checking roll number eligibility...',
      'Validating department access...',
      'Reviewing election restrictions...',
      'Eligibility confirmed.'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setWizardLoadingProgress(currentStep * 20);
      if (currentStep < messages.length) {
        setWizardLoadingMessage(messages[currentStep]);
      }
      if (currentStep === 5) {
        clearInterval(interval);
        setWizardStep('eligible_confirmed');
      }
    }, 500);
  };

  // Step 5: Token Generation Loading
  const startTokenGeneration = () => {
    setWizardStep('token_generating');
    setWizardLoadingProgress(0);
    setWizardLoadingMessage('Creating election token...');

    const messages = [
      'Creating election token...',
      'Registering participation session...',
      'Synchronizing election records...',
      'Preparing anonymous voting channel...',
      'Generating secure voting credentials...',
      'Token generated successfully.'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setWizardLoadingProgress(currentStep * 16.6);
      if (currentStep < messages.length) {
        setWizardLoadingMessage(messages[currentStep]);
      }
      if (currentStep === 6) {
        clearInterval(interval);
        const generatedToken = `VG-CR26-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        setWizardGeneratedToken(generatedToken);
        addAuditLog('TOKEN_GENERATED', `Cryptographic voting token successfully generated`);
        setWizardStep('token_gen_complete');
      }
    }, 600);
  };

  // Step 6: Verify Token Entry Loading & Rate Limiting Checks
  const handleVerifyTokenSubmit = () => {
    if (cooldownTimeLeft > 0) {
      alert(`Token entry locked. Please wait ${cooldownTimeLeft} seconds.`);
      return;
    }
    if (!wizardTokenInput.trim()) {
      alert('Please enter your Voting Token.');
      return;
    }
    
    // Check if token matches generated token
    if (wizardTokenInput.trim().toUpperCase() !== wizardGeneratedToken.toUpperCase()) {
      const nextAttempts = tokenAttempts + 1;
      setTokenAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        const cdDuration = nextAttempts === 5 ? 30 : (nextAttempts - 3) * 30; // 30s cooldown for 5th, then 60s, etc.
        setCooldownTimeLeft(cdDuration);
        triggerToast(`Security lockout triggered. Cooldown active for ${cdDuration} seconds.`);
      } else {
        triggerToast(`Invalid Token. Failed attempt ${nextAttempts} of 5.`);
      }
      return;
    }

    setWizardStep('token_verifying');
    setWizardLoadingProgress(0);
    setWizardLoadingMessage('Validating token...');

    const messages = [
      'Validating token...',
      'Checking election records...',
      'Confirming participation authorization...',
      'Token verified successfully.'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setWizardLoadingProgress(currentStep * 25);
      if (currentStep < messages.length) {
        setWizardLoadingMessage(messages[currentStep]);
      }
      if (currentStep === 4) {
        clearInterval(interval);
        addAuditLog('TOKEN_VERIFIED', 'Anonymous voting credentials validated');
        setWizardStep('token_verified');
      }
    }, 500);
  };

  // Step 9: Final Cryptographic Vote Submission (Step 9 & 10)
  const handleFinalVoteSubmit = () => {
    setWizardStep('submitting');
    setWizardLoadingProgress(0);
    setWizardLoadingMessage('Encrypting ballot...');

    const messages = [
      'Encrypting ballot...',
      'Creating anonymous vote record...',
      'Recording election transaction...',
      'Updating audit records...',
      'Performing integrity checks...',
      'Finalizing vote...',
      'Vote successfully recorded.'
    ];

    const timestamp = new Date().toLocaleString();
    const verificationId = `VG-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setWizardLoadingProgress(currentStep * 14.3);
      if (currentStep < messages.length) {
        setWizardLoadingMessage(messages[currentStep]);
      }
      if (currentStep === 7) {
        clearInterval(interval);
        
        // Update elections state
        setElections(prev => prev.map(el => {
          if (el.id === activeWizardElection.id) {
            return {
              ...el,
              voted: true,
              voteTime: timestamp,
              verificationToken: verificationId
            };
          }
          return el;
        }));

        // Log actions to audit logs (Step 12 & 13)
        addAuditLog('VOTE_SUBMITTED', `Ballot committed to decentralized ledger trace`);
        addAuditLog('VERIFICATION_CREATED', `Verification ID created: ${verificationId}`);

        // Update Notifications
        setNotifications(prev => [
          { id: Date.now(), type: 'Vote Cast Successfully', message: `Your secure ballot for ${activeWizardElection.name} is sealed in block #28484.`, time: 'Just now', read: false },
          ...prev
        ]);

        setWizardGeneratedToken(verificationId); // Store verification code for success receipt
        setWizardStep('success');
      }
    }, 600);
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
  const eligibleCount = elections.filter(e => e.status === 'Active' || e.status === 'Scheduled').length;
  const activeCount = elections.filter(e => e.status === 'Active').length;
  const votedCount = elections.filter(e => e.voted).length;
  const pendingCount = elections.filter(e => !e.voted && e.status === 'Active').length;
  const latestActivity = logs[0] ? logs[0].desc : 'No recent activity';
  const unreadNotifsCount = notifications.filter(n => !n.read).length;

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
            {sessionRecovery && (
              <div className="session-recovery-banner">
                <div className="banner-sec-icon"><IconShield size={24} /></div>
                <div className="banner-recovery-msg">
                  <strong>Election Session Saved</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text2)' }}>
                    Continue where you left off for <strong>{elections.find(e => e.id === sessionRecovery.electionId)?.name}</strong>.
                  </p>
                </div>
                <button className="btn-resume-session" onClick={handleResumeSession}>
                  Resume Voting
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
                <span className="demo-icon"><IconSettings size={18} /></span>
                <strong>SIMULATOR CONTROL (DEMO UTILITY)</strong>
              </div>
              <p>Simulate administrative changes to verify responsiveness and real-time interface rendering.</p>
              <div className="demo-buttons-row">
                <button className="btn-demo-util" onClick={toggleCRResults}>
                  Toggle "CR Election 2026" Results (Currently: {crElection.resultsPublic ? 'Public' : 'Private'})
                </button>
                <button className="btn-demo-util" onClick={() => {
                  setElections(prev => prev.map(e => e.id === 'ELC-2026-CR' ? { ...e, voted: false, voteTime: null, verificationToken: null } : e));
                  setSessionRecovery(null);
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
            
            {/* WIZARD MODE: Active Voting Flow */}
            {activeWizardElection ? (
              <div className="guided-voting-wizard-container">
                {/* Wizard Header Progress Bar */}
                <div className="wizard-progress-header">
                  <div className="wizard-meta-row">
                    <span className="wizard-title-badge">
                      <span className="secure-shield-dot animate-pulse" />
                      SECURE ENCRYPTED VOTING WORKSPACE
                    </span>
                    <button className="btn-exit-wizard-session" onClick={handleCloseVotingModal}>
                      ✕ Exit Secure Session
                    </button>
                  </div>
                  
                  {/* Step indicators */}
                  <div className="wizard-steps-track">
                    <div className={`step-dot ${['details', 'eligibility_validating', 'eligible_confirmed', 'token_generating', 'token_gen_complete', 'token_entry', 'token_verifying', 'token_verified', 'candidate_select', 'vote_review', 'submitting', 'success'].includes(wizardStep) ? 'active' : ''}`}>1. Details</div>
                    <div className={`step-dot ${['eligibility_validating', 'eligible_confirmed', 'token_generating', 'token_gen_complete', 'token_entry', 'token_verifying', 'token_verified', 'candidate_select', 'vote_review', 'submitting', 'success'].includes(wizardStep) ? 'active' : ''}`}>2. Identity</div>
                    <div className={`step-dot ${['token_generating', 'token_gen_complete', 'token_entry', 'token_verifying', 'token_verified', 'candidate_select', 'vote_review', 'submitting', 'success'].includes(wizardStep) ? 'active' : ''}`}>3. Secure Token</div>
                    <div className={`step-dot ${['candidate_select', 'vote_review', 'submitting', 'success'].includes(wizardStep) ? 'active' : ''}`}>4. Selection</div>
                    <div className={`step-dot ${['vote_review', 'submitting', 'success'].includes(wizardStep) ? 'active' : ''}`}>5. Confirm</div>
                  </div>
                </div>

                {/* STEP 2: ACCESS CODE ENTRY (INSIDE WIZARD) */}
                {wizardStep === 'access_code_entry' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="token-icon-wrapper-circle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="key-icon-svg">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>

                    <h2>Enter Access Code</h2>
                    <p className="success-subtext">This is a private election. Please enter the invitation code provided by your administrator.</p>

                    <div className="token-input-wrapper-fields" style={{ width: '100%' }}>
                      <input
                        type="text"
                        placeholder="VG-ACCESS-XXXX"
                        value={accessCodeInput}
                        onChange={(e) => setAccessCodeInput(e.target.value)}
                        className="wizard-token-textbox font-mono"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                      <div className="admin-hint-text" style={{ marginTop: '8px' }}>
                        <IconBulb size={16} /> Admin access code: <code>VG-ACCESS-CR26</code>
                      </div>
                    </div>

                    <div className="wizard-slide-footer full-width">
                      <button className="btn-wizard-nav-back" onClick={handleCloseVotingModal}>Cancel</button>
                      <button className="btn-wizard-nav-proceed select-item" onClick={handleJoinPrivateElection}>
                        Join Election →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: ACCESS CODE VALIDATION LOADING */}
                {wizardStep === 'access_code_validating' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="premium-loader-ring">
                      <div className="progress-ring-track" />
                      <div className="progress-ring-fill" style={{ transform: `rotate(${wizardLoadingProgress * 3.6}deg)` }} />
                      <span className="progress-pct-value">{Math.round(wizardLoadingProgress)}%</span>
                    </div>

                    <h2>Validating Access Credentials</h2>
                    <p className="loading-subtext-message">{wizardLoadingMessage}</p>
                    
                    <div className="cryptographic-console-logs">
                      <span className="console-log-line font-mono">SEARCHING ELECTION REGISTRY...</span>
                      <span className="console-log-line font-mono">VERIFYING ADMIN ACCESS KEY...</span>
                    </div>
                  </div>
                )}

                {/* STEP 2: ACCESS CODE INVALID ERROR */}
                {wizardStep === 'access_code_invalid' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="error-cross-bubble" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--red2)', color: 'var(--red)', display: 'flex', alignItems: 'center', justify: 'center', border: '2px solid var(--red3)', marginBottom: '8px', boxShadow: '0 0 16px var(--red2)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: '24px', height: '24px' }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>

                    <h2>Invalid Access Code</h2>
                    <p className="error-subtext">The access code entered is not registered in the system or you are not an authorized voter for this poll.</p>

                    <div className="wizard-slide-footer full-width">
                      <button className="btn-wizard-nav-proceed center-btn error-btn" onClick={() => {
                        setAccessCodeInput('');
                        setWizardStep('access_code_entry');
                      }} style={{ background: 'var(--red)', color: 'white' }}>
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: ELECTION DETAILS PAGE */}
                {wizardStep === 'details' && (
                  <div className="wizard-slide-card fade-in">
                    <div className="wizard-slide-header">
                      <div className="slide-eyebrow">Step 1 of 5 — Election Overview</div>
                      <h2>{activeWizardElection.name}</h2>
                      <p className="type-badge-para">
                        Security Type: <span className={`type-badge ${activeWizardElection.type.toLowerCase()}`}>{activeWizardElection.type} Election</span>
                      </p>
                    </div>

                    <div className="wizard-slide-body grid-layout-details">
                      <div className="body-col-left">
                        <h3>Overview</h3>
                        <p>{activeWizardElection.description}</p>
                        
                        <div className="overview-stats-grid">
                          <div className="stat-pill">
                            <span className="lbl">Starts</span>
                            <span className="val">{activeWizardElection.start}</span>
                          </div>
                          <div className="stat-pill">
                            <span className="lbl">Ends</span>
                            <span className="val">{activeWizardElection.end}</span>
                          </div>
                          <div className="stat-pill">
                            <span className="lbl">Expected Duration</span>
                            <span className="val">~ 3 minutes</span>
                          </div>
                        </div>

                        <div className="privacy-notice-box-details">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="lock-icon-svg">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <div>
                            <strong>Privacy Notice</strong>
                            <p>Your vote remains anonymous. Your candidate selection will never appear in verification records.</p>
                          </div>
                        </div>
                      </div>

                      <div className="body-col-right">
                        <h3>Election Guidelines</h3>
                        <ul className="rules-bullet-list">
                          {(activeWizardElection.rules || [
                            'Each student is entitled to cast exactly one ballot.',
                            'The ballot is completely anonymous and cryptographically hashed.',
                            'Ensure you keep your generated Verification Token safe after voting.'
                          ]).map((rule, idx) => (
                            <li key={idx}>{rule}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Display Candidates Cards */}
                    <div className="details-candidates-section" style={{ padding: '0 30px', marginTop: '24px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: 'var(--text)' }}>Candidate Profiles</h3>
                      <div className="details-candidates-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                        {(activeWizardElection.candidates || []).map((cand) => (
                          <div key={cand.id} className="detail-candidate-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--teal), var(--teal3))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>
                                {cand.photo}
                              </div>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{cand.name}</h4>
                                <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{cand.dept}</span>
                              </div>
                            </div>
                            <div>
                              <strong style={{ fontSize: '11px', color: 'var(--text2)', display: 'block', marginBottom: '2px' }}>Manifesto Summary</strong>
                              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text2)', lineHeight: '1.4' }}>"{cand.manifesto}"</p>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                              <strong style={{ fontSize: '11px', color: 'var(--text2)', display: 'block', marginBottom: '2px' }}>About Candidate</strong>
                              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text3)', lineHeight: '1.4' }}>{cand.about}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="wizard-slide-footer" style={{ marginTop: '24px' }}>
                      <button className="btn-wizard-nav-back" onClick={handleCloseVotingModal}>Cancel</button>
                      <button className="btn-wizard-nav-proceed" onClick={startIdentityValidation}>
                        Continue to Verification →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: ELIGIBILITY VALIDATION LOADING */}
                {wizardStep === 'eligibility_validating' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="premium-loader-ring">
                      <div className="progress-ring-track" />
                      <div className="progress-ring-fill" style={{ transform: `rotate(${wizardLoadingProgress * 3.6}deg)` }} />
                      <span className="progress-pct-value">{Math.round(wizardLoadingProgress)}%</span>
                    </div>

                    <h2>Validating Voter Credentials</h2>
                    <p className="loading-subtext-message">{wizardLoadingMessage}</p>
                    
                    <div className="cryptographic-console-logs">
                      <span className="console-log-line font-mono">HASH: SHA256({voter.userId})...</span>
                      <span className="console-log-line font-mono">STATUS: FETCHING ELIGIBILITY BLOCKCHAIN LIST...</span>
                    </div>
                  </div>
                )}

                {/* STEP 4: ELIGIBILITY CONFIRMED */}
                {wizardStep === 'eligible_confirmed' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="success-check-bubble animate-bounce">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>

                    <h2>✓ Eligible To Participate</h2>
                    <p className="success-subtext">Voter identity check complete. Access to election roll confirmed.</p>

                    <div className="eligibility-details-box text-left">
                      <div className="el-row"><span className="lbl">Voter Name:</span> <span className="val">{voter.name}</span></div>
                      <div className="el-row"><span className="lbl">Authorization ID:</span> <span className="val font-mono">{voter.userId}</span></div>
                      <div className="el-row"><span className="lbl">Roll Number:</span> <span className="val font-mono">{voter.rollNumber}</span></div>
                      <div className="el-row"><span className="lbl">Eligibility Status:</span> <span className="val text-green" style={{ color: '#0ca678', fontWeight: '600' }}>✓ Confirmed & Active</span></div>
                    </div>

                    <div className="wizard-slide-footer full-width">
                      <button className="btn-wizard-nav-proceed center-btn" onClick={startTokenGeneration}>
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: TOKEN GENERATION LOADING */}
                {wizardStep === 'token_generating' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="premium-loader-ring">
                      <div className="progress-ring-track" />
                      <div className="progress-ring-fill" style={{ transform: `rotate(${wizardLoadingProgress * 3.6}deg)` }} />
                      <span className="progress-pct-value">{Math.round(wizardLoadingProgress)}%</span>
                    </div>

                    <h2>Generating Secure Voting Token</h2>
                    <p className="loading-subtext-message">{wizardLoadingMessage}</p>
                    
                    <div className="cryptographic-console-logs">
                      <span className="console-log-line font-mono">TOKEN: GEN_HMAC_SHA256(VOTE_CHANNEL)...</span>
                      <span className="console-log-line font-mono">STATE: DECOUPLING IDENTIFIERS...</span>
                    </div>
                  </div>
                )}

                {/* STEP 5: TOKEN GENERATION COMPLETION */}
                {wizardStep === 'token_gen_complete' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="session-success-shield">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shield-icon token-gen">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>

                    <h2>Election Token Generated</h2>
                    <p className="success-subtext">Copy this token. You will need to enter it on the next screen to verify authorized access.</p>

                    <div className="generated-token-showcase-box">
                      <div className="token-label">YOUR SECURITY TOKEN</div>
                      <div className="token-code-row">
                        <code className="token-code-text">{wizardGeneratedToken}</code>
                        <button className="btn-copy-token-showcase" onClick={() => {
                          navigator.clipboard.writeText(wizardGeneratedToken);
                          triggerToast('Token copied to clipboard!');
                        }}>Copy</button>
                      </div>
                      <p className="disclaimer-text"><IconAlertTriangle size={16} /> Keep this token private. It is required on the next screen to verify authorization.</p>
                    </div>

                    <div className="wizard-slide-footer full-width">
                      <button className="btn-wizard-nav-proceed center-btn" onClick={() => setWizardStep('token_entry')}>
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 6: TOKEN ENTRY FORM (WITH LOCKOUT COOLDOWN) */}
                {wizardStep === 'token_entry' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="token-icon-wrapper-circle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="key-icon-svg">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                      </svg>
                    </div>

                      <h2>Enter Voting Token</h2>
                      <p className="success-subtext">Paste the generated token below to unlock the secure voting channel.</p>

                      <div className="token-input-wrapper-fields" style={{ width: '100%' }}>
                        {cooldownTimeLeft > 0 ? (
                          <div className="cooldown-lockout-indicator" style={{ textAlign: 'center', padding: '16px', background: 'rgba(250, 82, 82, 0.08)', border: '1px solid rgba(250, 82, 82, 0.2)', borderRadius: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '24px' }}><IconLock size={24} /></span>
                            <h4 style={{ margin: '8px 0 4px', color: '#fa5252', fontSize: '14px', fontWeight: '600' }}>Security Lockout Active</h4>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text2)' }}>
                              Too many failed attempts. Retries disabled for <strong>{cooldownTimeLeft} seconds</strong>.
                            </p>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              placeholder="VG-XXXX-XXXXXX"
                              value={wizardTokenInput}
                              onChange={(e) => setWizardTokenInput(e.target.value)}
                              disabled={cooldownTimeLeft > 0}
                              className="wizard-token-textbox font-mono"
                              style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                            <button className="btn-autofill-test-token" onClick={() => setWizardTokenInput(wizardGeneratedToken)}>
                              <IconBulb size={16} /> Autofill test token ({wizardGeneratedToken})
                            </button>
                          </>
                        )}
                      </div>

                      <div className="wizard-slide-footer full-width">
                        <button className="btn-wizard-nav-back" onClick={() => setWizardStep('token_gen_complete')} disabled={cooldownTimeLeft > 0}>Back</button>
                        <button 
                          className="btn-wizard-nav-proceed select-item" 
                          onClick={handleVerifyTokenSubmit}
                          disabled={cooldownTimeLeft > 0 || !wizardTokenInput.trim()}
                        >
                          Verify Token
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 6: TOKEN VERIFYING LOADER */}
                  {wizardStep === 'token_verifying' && (
                    <div className="wizard-slide-card center-aligned fade-in">
                      <div className="premium-loader-ring">
                        <div className="progress-ring-track" />
                        <div className="progress-ring-fill" style={{ transform: `rotate(${wizardLoadingProgress * 3.6}deg)` }} />
                        <span className="progress-pct-value">{Math.round(wizardLoadingProgress)}%</span>
                      </div>

                      <h2>Verifying Credentials Token</h2>
                      <p className="loading-subtext-message">{wizardLoadingMessage}</p>
                    </div>
                  )}

                  {/* STEP 6: TOKEN VERIFIED SUCCESS */}
                  {wizardStep === 'token_verified' && (
                    <div className="wizard-slide-card center-aligned fade-in">
                      <div className="success-check-bubble animate-bounce">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>

                      <h2>✓ Token Verified</h2>
                      <p className="success-subtext">Cryptographic voting credentials have been authorized successfully.</p>

                      <div className="eligibility-details-box text-left">
                        <div className="el-row"><span className="lbl">Verified Status:</span> <span className="val text-green" style={{ color: '#0ca678', fontWeight: '600' }}>✓ Authorized Session</span></div>
                        <div className="el-row"><span className="lbl">Audit Ledger Log:</span> <span className="val font-mono">COMMITTED (Block #28483)</span></div>
                      </div>

                      <div className="wizard-slide-footer full-width">
                        <button className="btn-wizard-nav-proceed center-btn" onClick={() => setWizardStep('candidate_select')}>
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 7: CANDIDATE BALLOT SELECTION */}
                  {wizardStep === 'candidate_select' && (
                    <div className="wizard-slide-card fade-in">
                      <div className="wizard-slide-header">
                        <div className="slide-eyebrow">Step 4 of 5 — Candidate Ballot Selection</div>
                        <h2>Cast Your Ballot Selection</h2>
                        <p>Hover and select your preferred representative card. Choose carefully; your final choice is cryptographically blinded.</p>
                      </div>

                      <div className="wizard-slide-body candidate-selection-list">
                        {(activeWizardElection.candidates && activeWizardElection.candidates.length > 0
                          ? activeWizardElection.candidates
                          : [
                              {
                                id: 'cand-f1',
                                name: 'Vikram Aditya',
                                dept: 'Electrical Engineering',
                                photo: 'VA',
                                manifesto: 'Advocating for better research lab infrastructure, library hours extension, and interdisciplinary project funding.',
                                about: 'IEEE Student Branch Chair, academic topper, and roboticist.'
                              },
                              {
                                id: 'cand-f2',
                                name: 'Ananya Roy',
                                dept: 'Electronics & Communication',
                                photo: 'AR',
                                manifesto: 'Promoting student mental wellness programs, sports facility upgrades, and annual cultural fest collaborations.',
                                about: 'Vice-President of the Cultural Society, badminton captain, and student counsellor.'
                              }
                            ]
                        ).map((cand) => (
                          <div
                            key={cand.id}
                            className={`candidate-select-item-card ${selectedCandidate && selectedCandidate.id === cand.id ? 'selected-card' : ''}`}
                            onClick={() => setSelectedCandidate(cand)}
                          >
                            <div className="cand-selection-indicator-bubble">
                              <span className="dot-inner" />
                            </div>
                            
                            <div className="cand-card-top">
                              <div className="cand-large-circle-avatar" style={{ background: 'linear-gradient(135deg, var(--teal), var(--teal3))' }}>
                                {cand.photo}
                              </div>
                              <div className="cand-meta-text">
                                <h4>{cand.name}</h4>
                                <span className="dept-label-cand">{cand.dept}</span>
                              </div>
                            </div>

                            <div className="cand-card-manifesto">
                              <strong>Manifesto:</strong>
                              <p>"{cand.manifesto}"</p>
                            </div>

                            <div className="cand-card-about">
                              <strong>About:</strong>
                              <p>{cand.about}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="wizard-slide-footer sticky-footer-selection">
                        <div className="selected-meta-status">
                          {selectedCandidate ? (
                            <span>Selected Candidate: <strong>{selectedCandidate.name}</strong></span>
                          ) : (
                            <span className="warning-red">Please select a candidate to continue.</span>
                          )}
                        </div>
                        <div className="buttons-block-nav">
                          <button className="btn-wizard-nav-back" onClick={() => setWizardStep('token_verified')}>Back</button>
                          <button
                            className="btn-wizard-nav-proceed"
                            disabled={!selectedCandidate}
                            onClick={() => setWizardStep('vote_review')}
                          >
                            Continue →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 8: VOTE REVIEW */}
                  {wizardStep === 'vote_review' && (
                    <div className="wizard-slide-card fade-in">
                      <div className="wizard-slide-header">
                        <div className="slide-eyebrow">Step 5 of 5 — Review Ballot Choice</div>
                        <h2>Vote Summary Review</h2>
                        <p>Confirm the details of your ballot selection. This is the final stage before immutable blockchain recording.</p>
                      </div>

                      <div className="wizard-slide-body summary-review-layout">
                        <div className="review-main-card">
                          <div className="review-info-section border-bottom">
                            <span className="lbl">ELECTION NAME</span>
                            <h3>{activeWizardElection.name}</h3>
                          </div>

                          <div className="review-info-section border-bottom">
                            <span className="lbl">SELECTED CANDIDATE</span>
                            <div className="cand-summary-info-badge">
                              <div className="avatar-circle-summary" style={{ background: 'linear-gradient(135deg, var(--teal), var(--teal3))' }}>
                                {selectedCandidate?.photo}
                              </div>
                              <div>
                                <h4>{selectedCandidate?.name}</h4>
                                <p>{selectedCandidate?.dept}</p>
                              </div>
                            </div>
                          </div>

                          <div className="review-info-section border-bottom">
                            <span className="lbl">SUBMISSION TIME</span>
                            <span className="val" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                              {new Date().toLocaleTimeString()} (Estimated)
                            </span>
                          </div>

                          <div className="review-info-section">
                            <span className="lbl">VOTER PRIVACY ASSURANCE</span>
                            <p className="anonymity-reminder">✓ <strong>Voter Anonymity Guaranteed:</strong> Your credentials are cryptographically blinded. The platform logs verify that you voted, but do NOT register who you voted for.</p>
                          </div>
                        </div>

                        <div className="review-caution-card-warning">
                          <div className="caution-icon"><IconAlertTriangle size={24} /></div>
                          <div>
                            <strong>Critical Warning</strong>
                            <p>Once submitted, this vote cannot be changed. By clicking "Submit Vote", you authorize the final sealing of this cryptographic ballot.</p>
                          </div>
                        </div>
                      </div>

                      <div className="wizard-slide-footer">
                        <button className="btn-wizard-nav-back" onClick={() => setWizardStep('candidate_select')}>Back</button>
                        <button className="btn-wizard-nav-proceed finalize-vote-submit-btn" onClick={handleFinalVoteSubmit}>
                          Submit Vote <IconBox size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 9: VOTE SUBMISSION LOADING */}
                  {wizardStep === 'submitting' && (
                    <div className="wizard-slide-card center-aligned fullscreen-loading-overlay fade-in">
                      <div className="premium-loader-ring large-spin">
                        <div className="progress-ring-track" />
                        <div className="progress-ring-fill" style={{ transform: `rotate(${wizardLoadingProgress * 3.6}deg)` }} />
                        <span className="progress-pct-value">{Math.round(wizardLoadingProgress)}%</span>
                      </div>

                      <h2 className="glow-text">Encrypting &amp; Casting Ballot</h2>
                      <p className="loading-subtext-message">{wizardLoadingMessage}</p>

                      <div className="horizontal-progress-bar-container" style={{ width: '80%', height: '8px', background: 'var(--surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)', margin: '20px 0' }}>
                        <div className="progress-bar-fill" style={{ width: `${wizardLoadingProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--teal), var(--teal3))', transition: 'width 0.2s ease-out' }} />
                      </div>
                      
                      <div className="cryptographic-console-logs dark-logs">
                        <span className="console-log-line font-mono">SEALING BALLOT WITH RECIPIENT PUBLIC KEY...</span>
                        <span className="console-log-line font-mono">COMPUTING ECDSA SIGNATURE BLOCK...</span>
                        <span className="console-log-line font-mono">BROADCASTING LEDGER TRANSACTION CODE...</span>
                      </div>
                    </div>
                  )}

                  {/* STEP 10: SUCCESS RECEIPT */}
                  {wizardStep === 'success' && (
                    <div className="wizard-slide-card center-aligned fade-in">
                      <div className="vote-receipt-success-badge animate-pulse">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="receipt-check-svg">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>

                      <h2 className="success-glow">✓ Vote Submitted Successfully</h2>
                      <p className="success-subtext">Your vote has been cryptographically signed and committed to the ledger block.</p>

                      <div className="success-receipt-card-block" style={{ width: '100%', boxSizing: 'border-box' }}>
                        <div className="receipt-row-field">
                          <span className="label">ELECTION NAME</span>
                          <span className="value">{activeWizardElection.name}</span>
                        </div>
                        <div className="receipt-row-field">
                          <span className="label">SUBMISSION TIME</span>
                          <span className="value">{new Date().toLocaleTimeString()}</span>
                        </div>
                        <div className="receipt-row-field">
                          <span className="label">VERIFICATION ID</span>
                          <div className="code-copy-block">
                            <code className="receipt-verif-code font-mono">{wizardGeneratedToken}</code>
                            <button className="btn-copy-receipt-code" onClick={() => {
                              navigator.clipboard.writeText(wizardGeneratedToken);
                              triggerToast('Verification ID copied!');
                            }}>Copy</button>
                          </div>
                        </div>
                        <p className="receipt-audit-reminder">This Verification ID enables you to audit that your ballot was successfully recorded in the audit trace, without revealing your selection.</p>
                      </div>

                      <div className="wizard-slide-footer full-width flex-row-buttons">
                        <button className="btn-wizard-nav-back" onClick={() => {
                          navigator.clipboard.writeText(wizardGeneratedToken);
                          triggerToast('Verification ID copied!');
                        }}>Copy Verification ID</button>
                        <button className="btn-wizard-nav-proceed select-item" onClick={() => {
                          setActiveWizardElection(null);
                          setWizardStep(null);
                          setActiveTab('Activity');
                        }}>View Activity</button>
                        <button className="btn-wizard-nav-proceed" onClick={() => {
                          setActiveWizardElection(null);
                          setWizardStep(null);
                          setActiveTab('Home');
                        }}>Return Home</button>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                // Listing View (Step 1)
                <>
                  <div className="page-intro-header">
                    <h1>My Elections Dashboard</h1>
                    <p>Review active institutional polls, check election lifecycles, and cast your secure cryptographically-audited ballot.</p>
                  </div>

                  {/* Dashboard metrics summary (Step 1) */}
                  <div className="voter-dashboard-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    <div className="metric-card welcome" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Voter Identity</span>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>{voter.name}</h3>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text2)' }}>{voter.rollNumber} • CS</span>
                    </div>
                    <div className="metric-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Eligible Polls</span>
                      <span className="metric-val" style={{ fontSize: '20px', fontWeight: '750', color: 'var(--text)' }}>{eligibleCount}</span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Registered Profiles</span>
                    </div>
                    <div className="metric-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Active Channels</span>
                      <span className="metric-val text-teal" style={{ fontSize: '20px', fontWeight: '750', color: 'var(--teal)' }}>{activeCount}</span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Live Elections</span>
                    </div>
                    <div className="metric-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Voting Status</span>
                      <span className="metric-val" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', margin: '4px 0' }}>{votedCount} Cast / {pendingCount} Pending</span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Secure Ballots</span>
                    </div>
                    <div className="metric-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Recent Activity</span>
                      <span className="metric-val-activity truncate" title={latestActivity} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', margin: '4px 0' }}>{latestActivity}</span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Signed Audit Log</span>
                    </div>
                    <div className="metric-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Notifications</span>
                      <span className="metric-val text-gold" style={{ fontSize: '20px', fontWeight: '750', color: 'var(--gold)' }}>{unreadNotifsCount}</span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Unread Announcements</span>
                    </div>
                  </div>

                  <div className="elections-split-layout" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                    
                    {/* Public Elections Column */}
                    <div className="elections-public-column">
                      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'var(--text)' }}>Public Elections</h2>
                      
                      <div className="elections-grid-container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        {elections.filter(e => e.type === 'Public').map((elec) => (
                          <div key={elec.id} className={`election-card-item ${elec.status.toLowerCase()}`} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="card-badge-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className={`status-badge-lbl ${elec.status.toLowerCase()}`} style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'var(--teal2)', color: 'var(--teal)', border: '1px solid var(--teal3)' }}>{elec.status}</span>
                              <span className="card-election-id" style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{elec.id}</span>
                            </div>

                            <h3 className="card-title-text" style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{elec.name}</h3>
                            <p className="card-desc-text" style={{ margin: 0, fontSize: '12.5px', color: 'var(--text2)', lineHeight: '1.5' }}>{elec.description}</p>

                            <div className="card-stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                              <div className="card-stat" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span className="lbl" style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase' }}>Starts</span>
                                <span className="val" style={{ fontSize: '11.5px', color: 'var(--text2)' }}>{elec.start}</span>
                              </div>
                              <div className="card-stat" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span className="lbl" style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase' }}>Ends</span>
                                <span className="val" style={{ fontSize: '11.5px', color: 'var(--text2)' }}>{elec.end}</span>
                              </div>
                            </div>

                            <div className="elections-listing-actions-row" style={{ display: 'flex', gap: '12px' }}>
                              <button className="btn-card-details select-action-btn" onClick={() => setSelectedElection(elec)} style={{ flex: 1 }}>
                                View Details
                              </button>
                              {!elec.voted && elec.status === 'Active' && (
                                <button className="btn-card-details participate-action-btn" onClick={() => launchVotingWizard(elec)} style={{ flex: 1, background: 'var(--teal)', color: 'white', border: 'none' }}>
                                  Participate
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Private Elections Access Card Column */}
                    <div className="elections-private-column">
                      <div className="join-private-election-card" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                        <div className="card-shield-decor" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Join Private Election</h2>
                        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text2)', lineHeight: '1.5' }}>Enter an election access code provided by your administrator.</p>
                        
                        <div className="private-join-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                          <input
                            type="text"
                            placeholder="Access Code"
                            value={accessCodeInput}
                            onChange={(e) => setAccessCodeInput(e.target.value)}
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-mono)' }}
                          />
                          <button 
                            className="btn-join-private-submit" 
                            onClick={handleJoinPrivateElection}
                            style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer', transition: 'opacity 0.2s' }}
                            onMouseOver={(e) => e.target.style.opacity = '0.9'}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                          >
                            Join Election
                          </button>
                        </div>

                        <div className="admin-hint-text" style={{ fontSize: '11px', color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                          <IconBulb size={16} /> Private access code: <code>VG-ACCESS-CR26</code>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
            )}

            {/* Step 2 overlay popup if details is selected outside wizard */}
            {selectedElection && !activeWizardElection && (
              <div className="voting-modal-backdrop list-details-overlay-backdrop">
                <div className="voting-modal-card details-view-modal-card">
                  <div className="modal-header">
                    <div className="secure-badge">
                      <span className="lock-icon"><IconLock size={24} /></span>
                      <span>{selectedElection.type || 'Private'} Election Details</span>
                    </div>
                    <button className="btn-modal-close" onClick={() => setSelectedElection(null)}>✕</button>
                  </div>

                  <div className="modal-body-step fade-in text-left">
                    <h2 className="modal-body-title">{selectedElection.name}</h2>
                    <p className="election-overview-description">{selectedElection.description}</p>
                    
                    <div className="details-overlay-info-grid">
                      <div className="overlay-info-pill">
                        <span className="lbl">Start Date &amp; Time</span>
                        <span className="val">{selectedElection.start}</span>
                      </div>
                      <div className="overlay-info-pill">
                        <span className="lbl">End Date &amp; Time</span>
                        <span className="val">{selectedElection.end}</span>
                      </div>
                      <div className="overlay-info-pill">
                        <span className="lbl">Privacy Guarantee</span>
                        <span className="val text-green">100% Blindsig Ledger</span>
                      </div>
                    </div>

                    <div className="details-overlay-section-block">
                      <h4>Candidates</h4>
                      <div className="candidates-avatars-badges-row">
                        {(selectedElection.candidates && selectedElection.candidates.length > 0
                          ? selectedElection.candidates
                          : [
                              { name: 'Vikram Aditya', dept: 'Electrical Engineering' },
                              { name: 'Ananya Roy', dept: 'Electronics & Communication' }
                            ]
                        ).map((cand, index) => (
                          <div key={index} className="candidate-mini-avatar-badge">
                            <span className="avatar-lbl-circle">{cand.name.split(' ').map(n => n[0]).join('')}</span>
                            <div className="cand-info-lbls">
                              <strong>{cand.name}</strong>
                              <span>{cand.dept}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="details-overlay-section-block">
                      <h4>Platform Privacy Notice</h4>
                      <p className="privacy-paragraph">"Your vote remains anonymous throughout the election process. Cryptographic keys decoupled from registration assure strict anonymity and ledger transparency."</p>
                    </div>

                    <div className="modal-footer-btns">
                      <button className="btn-modal-back" onClick={() => setSelectedElection(null)}>Close</button>
                      {!selectedElection.voted && selectedElection.status === 'Active' && (
                        <button className="btn-modal-proceed select-item" onClick={() => {
                          const elec = selectedElection;
                          setSelectedElection(null);
                          launchVotingWizard(elec);
                        }}>
                          Continue to Verification
                        </button>
                      )}
                    </div>
                  </div>
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
                        <IconAlertTriangle size={18} /> These standings represent the live cryptographic tally feed. Final outcomes will lock upon closing at 09:00 PM.
                      </p>
                    </div>
                  ) : (
                    // Securely locked standings
                    <div className="results-locked-state">
                      <div className="locked-shield-icon"><IconLock size={24} /></div>
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
                      <IconTrophy size={20} /> FINAL AUDITED OUTCOMES (100% BLOCKS VERIFIED)
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
              {elections.map((elec) => (
                <div key={elec.id} className="verification-status-card-box">
                  <div className="verification-card-header">
                    <h3>{elec.name}</h3>
                    <span className="elec-badge-id">{elec.id}</span>
                  </div>

                  <div className="verification-card-body">
                    <div className="v-row">
                      <span className="v-lbl">Election:</span>
                      <span className="v-val">{elec.name}</span>
                    </div>

                    <div className="v-row">
                      <span className="v-lbl">Verification ID:</span>
                      {elec.voted ? (
                        <div className="token-visualizer-box">
                          <code className="token-code-text">{elec.verificationToken}</code>
                          <button className="btn-token-copy-action" onClick={() => handleCopyText(elec.verificationToken, 'Verification ID')}>
                            Copy ID
                          </button>
                        </div>
                      ) : (
                        <span className="v-val status-pending-text">Pending (Cast your vote first)</span>
                      )}
                    </div>

                    <div className="v-row">
                      <span className="v-lbl">Status:</span>
                      {elec.voted ? (
                        <span className="v-val status-success-text" style={{ color: '#0ca678', fontWeight: '600' }}>
                          ✓ Vote Recorded Successfully
                        </span>
                      ) : (
                        <span className="v-val status-pending-text">
                          <IconX size={18} /> Ballot Not Cast Yet
                        </span>
                      )}
                    </div>

                    {elec.voted && (
                      <div className="verification-info-note" style={{ marginTop: '14px', fontSize: '12.5px', color: 'var(--text2)', padding: '12px', background: 'var(--surface2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <IconInfoCircle size={18} /> This verification ID confirms that your vote was securely recorded in the election system. In accordance with strict cryptographic standards, your candidate selection is not revealed to preserve voter anonymity.
                      </div>
                    )}
                  </div>
                </div>
              ))}
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

        {/* ==========================================
            TAB: PROFILE PAGE
           ========================================== */}
        {activeTab === 'Profile' && (
          <div className="tab-pane-view profile-pane-view fade-in">
            {/* Header Title Block */}
            <div className="profile-header-block">
              <div className="profile-header-left">
                <h1>Voter Profile</h1>
                <p>Manage your personal information and account settings.</p>
              </div>
              <div className="profile-header-right">
                <span className="verified-voter-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="verified-badge-icon">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 11 11 13 15 9" />
                  </svg>
                  Verified Voter
                </span>
              </div>
            </div>

            {/* Profile Card Banner */}
            <div className="profile-banner-card">
              <div className="profile-avatar-group">
                <div className="profile-avatar-wrapper">
                  <img src={voter.avatarUrl || "/aarav_mehta_avatar.png"} alt={voter.name} className="profile-large-avatar" />
                  <div className="avatar-verified-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
                <div className="profile-main-meta">
                  <h2>{voter.name}</h2>
                  <div className="voter-id-display">Voter ID: <span>{voter.userId}</span></div>
                  
                  <div className="voter-quick-details-list">
                    <div className="quick-detail-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-icon">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span>{voter.email}</span>
                    </div>
                    <div className="quick-detail-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-icon">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span>{voter.phone}</span>
                    </div>
                    <div className="quick-detail-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-icon">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                      <span>{voter.department}</span>
                    </div>
                    <div className="quick-detail-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-icon">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      <span>{voter.institution}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Status Card */}
              <div className="profile-status-summary-card">
                <div className="status-summary-row border-bottom">
                  <span className="summary-label">Account Status</span>
                  <span className="summary-value active">
                    <span className="status-indicator-dot" />
                    {voter.accountStatus}
                  </span>
                </div>
                <div className="status-summary-row">
                  <span className="summary-label">Member Since</span>
                  <span className="summary-value date">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="calendar-icon">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {voter.memberSince}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="profile-stats-cards-grid">
              <div className="profile-stat-card-box">
                <div className="stat-icon-wrapper purple-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stat-svg purple-icon">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </div>
                <div className="stat-content-wrap">
                  <span className="stat-caption">Elections Participated</span>
                  <span className="stat-main-number">3</span>
                  <span className="stat-caption">Total Elections</span>
                </div>
              </div>

              <div className="profile-stat-card-box">
                <div className="stat-icon-wrapper green-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="stat-svg green-icon">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="stat-content-wrap">
                  <span className="stat-caption">Votes Cast</span>
                  <span className="stat-main-number">3</span>
                  <span className="stat-caption">Votes Submitted</span>
                </div>
              </div>

              <div className="profile-stat-card-box">
                <div className="stat-icon-wrapper blue-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stat-svg blue-icon">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 11 11 13 15 9" />
                  </svg>
                </div>
                <div className="stat-content-wrap">
                  <span className="stat-caption">Verification Status</span>
                  <span className="stat-main-string text-verified">Verified</span>
                  <span className="stat-caption text-confirmed">Identity Confirmed</span>
                </div>
              </div>

              <div className="profile-stat-card-box">
                <div className="stat-icon-wrapper orange-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stat-svg orange-icon">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="stat-content-wrap">
                  <span className="stat-caption">Last Activity</span>
                  <span className="stat-main-string">Today</span>
                  <span className="stat-caption">10:24 AM</span>
                </div>
              </div>
            </div>

            {/* Split Information Grid */}
            <div className="profile-split-details-grid">
              {/* Left Column: Personal Information */}
              <div className="profile-info-block-card">
                <div className="info-block-header">
                  <h3>Personal Information</h3>
                  <button className="btn-edit-profile-info" onClick={() => setEditingProfile(!editingProfile)}>
                    {editingProfile ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {editingProfile ? (
                  <form className="profile-edit-form" onSubmit={(e) => {
                    e.preventDefault();
                    setEditingProfile(false);
                    triggerToast('Profile updated successfully!');
                  }}>
                    <div className="edit-form-grid">
                      <div className="form-field-item">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={voter.name}
                          onChange={(e) => setVoter({ ...voter, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-item">
                        <label>Roll Number</label>
                        <input
                          type="text"
                          value={voter.rollNumber}
                          onChange={(e) => setVoter({ ...voter, rollNumber: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-item">
                        <label>Department</label>
                        <input
                          type="text"
                          value={voter.department}
                          onChange={(e) => setVoter({ ...voter, department: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-item">
                        <label>Year</label>
                        <input
                          type="text"
                          value={voter.year}
                          onChange={(e) => setVoter({ ...voter, year: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-item">
                        <label>Email</label>
                        <input
                          type="email"
                          value={voter.email}
                          onChange={(e) => setVoter({ ...voter, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-item">
                        <label>Phone Number</label>
                        <input
                          type="text"
                          value={voter.phone}
                          onChange={(e) => setVoter({ ...voter, phone: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-save-profile-edit">Save Changes</button>
                  </form>
                ) : (
                  <div className="info-display-grid">
                    <div className="info-display-item">
                      <span className="info-field-lbl">Full Name</span>
                      <span className="info-field-val">{voter.name}</span>
                    </div>
                    <div className="info-display-item">
                      <span className="info-field-lbl">Roll Number</span>
                      <span className="info-field-val">{voter.rollNumber}</span>
                    </div>
                    <div className="info-display-item">
                      <span className="info-field-lbl">Department</span>
                      <span className="info-field-val">{voter.department}</span>
                    </div>
                    <div className="info-display-item">
                      <span className="info-field-lbl">Year</span>
                      <span className="info-field-val">{voter.year}</span>
                    </div>
                    <div className="info-display-item">
                      <span className="info-field-lbl">Email</span>
                      <span className="info-field-val">{voter.email}</span>
                    </div>
                    <div className="info-display-item">
                      <span className="info-field-lbl">Phone Number</span>
                      <span className="info-field-val">{voter.phone}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Security & Verification */}
              <div className="profile-info-block-card">
                <div className="info-block-header">
                  <h3>Security &amp; Verification</h3>
                </div>
                
                <div className="security-settings-list">
                  <div className="security-setting-item">
                    <span className="setting-label-text">Email Verified</span>
                    <span className="setting-status-icon green-checkmark">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="verified-check-svg">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </div>

                  <div className="security-setting-item">
                    <span className="setting-label-text">Phone Verified</span>
                    <span className="setting-status-icon green-checkmark">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="verified-check-svg">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </div>

                  <div className="security-setting-item">
                    <span className="setting-label-text">Two-Factor Authentication</span>
                    <span className="setting-status-value status-enabled">Enabled</span>
                  </div>

                  <div className="security-setting-item">
                    <span className="setting-label-text">Last Password Change</span>
                    <span className="setting-status-value-date">12 May 2025</span>
                  </div>

                  <div className="security-setting-item">
                    <span className="setting-label-text">Account Security</span>
                    <span className="security-strength-pill strong">Strong</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Card: Recent Activity */}
            <div className="profile-recent-activity-panel">
              <div className="activity-panel-header">
                <h3>Recent Activity</h3>
              </div>
              
              <div className="profile-activity-list-items">
                {/* Item 1 */}
                <div className="profile-activity-row">
                  <div className="activity-icon-badge green-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="activity-icon-svg">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="activity-row-content">
                    <span className="activity-row-title">Voted in CR Election 2026</span>
                    <span className="activity-row-desc">Vote submitted successfully</span>
                  </div>
                  <span className="activity-row-time">Today, 10:24 AM</span>
                </div>

                {/* Item 2 */}
                <div className="profile-activity-row">
                  <div className="activity-icon-badge blue-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="activity-icon-svg">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                  <div className="activity-row-content">
                    <span className="activity-row-title">Logged in to VoteGuard</span>
                    <span className="activity-row-desc">IP: 103.21.45.67 • Chrome on Windows</span>
                  </div>
                  <span className="activity-row-time">Today, 10:15 AM</span>
                </div>

                {/* Item 3 */}
                <div className="profile-activity-row">
                  <div className="activity-icon-badge grey-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="activity-icon-svg">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div className="activity-row-content">
                    <span className="activity-row-title">Email verified</span>
                    <span className="activity-row-desc">Your email address was successfully verified</span>
                  </div>
                  <span className="activity-row-time">14 Aug 2024</span>
                </div>
              </div>

              <div className="profile-activity-footer">
                <button className="btn-view-all-activity-link" onClick={() => setActiveTab('Activity')}>
                  View All Activity 
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="arrow-right-icon">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
