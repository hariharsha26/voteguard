import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import VoterNavigation from '../components/VoterNavigation';
import SpotlightCard from '../components/ReactBits/SpotlightCard';
import CountUpNumber from '../components/ReactBits/CountUpNumber';
import '../styles/VoterDashboard.css';
import { IconShield, IconSettings, IconBulb, IconAlertTriangle, IconLock, IconBox, IconTrophy, IconX, IconInfoCircle } from '@tabler/icons-react';
import { supabase } from '../lib/supabaseClient';

export default function VoterDashboard() {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const sha256 = async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const fetchVoterData = async (userRoll) => {
    try {
      const { data: dbElections, error: elError } = await supabase
        .from('elections')
        .select('*')
        .neq('status', 'Draft')
        .order('created_at', { ascending: false });

      if (elError) throw elError;

      const { data: dbCandidates, error: candError } = await supabase
        .from('candidates')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (candError) throw candError;

      const { data: dbParticipation, error: partError } = await supabase
        .from('voter_participation')
        .select('*')
        .eq('roll_number', userRoll);

      if (partError) throw partError;

      const mappedCandidates = (dbCandidates || []).map(c => ({
        id: c.id,
        name: c.candidate_name,
        dept: c.department || '',
        photo: c.candidate_name.split(' ').map(x=>x[0]).join(''),
        manifesto: c.manifesto || '',
        about: `Voter ID roll profile candidate in ${c.department}.`
      }));

      const mappedElections = (dbElections || []).map(el => {
        const part = (dbParticipation || []).find(p => p.election_id === el.id);
        const voted = part ? part.has_voted : false;
        const verificationToken = voted ? `VG-${el.election_code}-${userRoll}` : null;

        let uiStatus = 'Active';
        if (el.status === 'Completed') uiStatus = 'Completed';
        else if (el.status === 'Paused') uiStatus = 'Paused';
        else if (el.status === 'Emergency_Stopped') uiStatus = 'Emergency_Locked';

        const elCands = mappedCandidates.filter(c => {
          const dbCand = dbCandidates.find(dbc => dbc.id === c.id);
          return dbCand && dbCand.election_id === el.id;
        });

        return {
          id: el.id,
          name: el.election_name,
          description: el.description || '',
          start: new Date(el.start_time).toLocaleString(),
          end: new Date(el.end_time).toLocaleString(),
          rules: [
            'Each student is entitled to cast exactly one ballot.',
            'The ballot is completely anonymous and cryptographically hashed.',
            'Ensure you keep your generated Verification Token safe after voting.'
          ],
          candidates: elCands,
          voted: voted,
          voteTime: voted ? 'Recorded' : null,
          verificationToken: verificationToken,
          resultsPublic: el.status === 'Completed',
          status: uiStatus,
          type: el.election_type,
          accessCode: el.access_code || ''
        };
      });

      setElections(mappedElections);
    } catch (err) {
      console.error('Failed to fetch voter dashboard data:', err);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/voter-auth');
          return;
        }

        const jwtPayload = JSON.parse(atob(session.access_token.split('.')[1]));
        const sessionId = jwtPayload.session_id;

        if (jwtPayload.app_metadata?.role !== 'voter') {
          navigate('/voter-auth');
          return;
        }

        const { data, error } = await supabase
          .from('verified_sessions')
          .select('verified')
          .eq('session_id', sessionId)
          .single();

        if (error || !data || !data.verified) {
          navigate('/voter-auth');
          return;
        }

        // Fetch real voter profile data
        const { data: profile } = await supabase
          .from('voters')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();

        if (profile) {
          setVoter({
            name: profile.full_name,
            userId: profile.roll_number,
            department: profile.department || 'General',
            rollNumber: profile.roll_number,
            institution: 'Vidyavardhini Institute of Technology',
            year: 'Voter Account',
            email: profile.email,
            phone: profile.phone_number || '',
            electionStatus: 'Active & Eligible',
            memberSince: new Date(profile.created_at).toLocaleDateString(),
            accountStatus: 'Active',
            avatarUrl: '/aarav_mehta_avatar.png'
          });
          await fetchVoterData(profile.roll_number);
        }

        setCheckingAuth(false);
      } catch (err) {
        navigate('/voter-auth');
      }
    };

    checkAuth();
  }, [navigate]);

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
  const [wizardGeneratedToken, setWizardGeneratedToken] = useState('');
  const [wizardTokenInput, setWizardTokenInput] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Validation, Rate Limiting & Recovery States
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessCodeAttempts, setAccessCodeAttempts] = useState(0);
  const [accessCodeCooldownTimeLeft, setAccessCodeCooldownTimeLeft] = useState(0);
  const [tokenAttempts, setTokenAttempts] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [sessionRecovery, setSessionRecovery] = useState(null);

  // Redesign Panel and accessibility States
  const [isLargeText, setIsLargeText] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [showHelpPopover, setShowHelpPopover] = useState(false);
  const [helpActiveSection, setHelpActiveSection] = useState('faq'); // 'faq' | 'contact' | 'report'
  const [contactFormStatus, setContactFormStatus] = useState('');
  const [unlockedPrivateElectionIds, setUnlockedPrivateElectionIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Session timeout warning UX (visual only — does not enforce real session expiry)
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState(false);
  const [sessionTimeoutSeconds, setSessionTimeoutSeconds] = useState(120);
  const [savedAgoText, setSavedAgoText] = useState('Just now');

  // Redesign wizard / verification portal state variables
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [verificationSearchToken, setVerificationSearchToken] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationError, setVerificationError] = useState(null);
  const [showCryptoDetails, setShowCryptoDetails] = useState(false);

  // 7. Simulated Logs / Activity Database (Step 12 Setup)
  const [logs, setLogs] = useState([
    { ts: new Date().toLocaleTimeString(), ev: 'OTP_VERIFIED', desc: 'Secure two-factor verification successful via email channel', status: 'ok', payload: { channel: 'email', verified: true } },
    { ts: new Date().toLocaleTimeString(), ev: 'LOGGED_IN', desc: 'Secure voter session initialized', status: 'ok', payload: { auth_level: 'voter', check_integrity: 'PASS' } }
  ]);

  const handleVerifyTokenInPortal = async () => {
    const token = verificationSearchToken.trim();
    if (!token) {
      setVerificationError('Please enter a token.');
      setVerificationResult(null);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('verify_portal_token', {
        p_token: token
      });

      if (error) throw error;

      setVerificationResult({
        electionName: 'Secure Voter Registry',
        token: token,
        status: data,
        time: new Date().toLocaleString()
      });
      setVerificationError(null);
      addAuditLog('TOKEN_VERIFIED_PORTAL', `Verified token status in portal: ${data}`);
    } catch (err) {
      console.error('Failed to verify token in portal:', err);
      setVerificationResult(null);
      setVerificationError(err.message || 'Token not found or invalid.');
    }
  };

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

  // Toast notifier utility
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Logout trigger
  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to end your secure voter session? All current context will be wiped.')) {
      try {
        await supabase.rpc('handle_logout');
        await supabase.auth.signOut();
      } catch (err) {
        // Fallback signout
        await supabase.auth.signOut();
      }
      navigate('/portal');
    }
  };

  // Step 11 & Recovery: Closing ballot mid-way saves the state
  const handleCloseVotingModal = () => {
    if (activeWizardElection && wizardStep !== 'success') {
      setSessionRecovery({
        electionId: activeWizardElection.id,
        step: wizardStep,
        selectedCandidate: selectedCandidate,
        generatedToken: wizardGeneratedToken,
        savedAt: Date.now() - 120000 // Mock 2 minutes ago initially for UI demo, then standard Date.now()
      });
      addAuditLog('SESSION_SAVED', `Secure voting session saved at step: ${wizardStep}`);
      triggerToast('Election session saved. You can resume later.');
    }
    setActiveWizardElection(null);
    setWizardStep(null);
    setAccessCodeInput('');
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

  // Session timeout warning timer (visual UX only)
  useEffect(() => {
    const warningDelay = setTimeout(() => {
      setSessionTimeoutWarning(true);
      setSessionTimeoutSeconds(120);
    }, 15 * 60 * 1000); // Show after 15 minutes of session
    return () => clearTimeout(warningDelay);
  }, []);

  // Session timeout countdown
  useEffect(() => {
    if (!sessionTimeoutWarning) return;
    if (sessionTimeoutSeconds <= 0) {
      handleLogout();
      return;
    }
    const cdTimer = setInterval(() => {
      setSessionTimeoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(cdTimer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cdTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionTimeoutWarning, sessionTimeoutSeconds]);

  // ESC key handler to close modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (activeWizardElection) {
          handleCloseVotingModal();
        } else if (showComparisonModal) {
          setShowComparisonModal(false);
        } else if (showHelpPopover) {
          setShowHelpPopover(false);
        }
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWizardElection, showComparisonModal, showHelpPopover]);

  // Scroll lock when wizard modal is open
  useEffect(() => {
    if (activeWizardElection) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activeWizardElection]);

  // Focus trapping in wizard modal for accessibility
  useEffect(() => {
    if (!activeWizardElection) return;
    const handleFocusTrap = (e) => {
      if (e.key !== 'Tab') return;
      const wizardContainer = document.querySelector('.guided-voting-wizard-container');
      if (!wizardContainer) return;
      const focusableSelectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
      const focusableElements = Array.from(wizardContainer.querySelectorAll(focusableSelectors));
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };
    
    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [activeWizardElection]);

  // Update savedAgoText whenever sessionRecovery changes
  useEffect(() => {
    if (!sessionRecovery?.savedAt) {
      const t = setTimeout(() => {
        setSavedAgoText(prev => prev === 'Just now' ? prev : 'Just now');
      }, 0);
      return () => clearTimeout(t);
    }
    const update = () => {
      const diffMs = Date.now() - sessionRecovery.savedAt;
      const diffSecs = Math.floor(diffMs / 1000);
      let text = '';
      if (diffSecs < 60) {
        text = 'Less than a minute ago';
      } else {
        const diffMins = Math.floor(diffSecs / 60);
        text = `${diffMins} Minute${diffMins > 1 ? 's' : ''} Ago`;
      }
      setSavedAgoText(prev => prev === text ? prev : text);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [sessionRecovery]);

  // Ticking effect for Cooldowns (Access Code & Token Rate Limiting Countdowns)
  useEffect(() => {
    if (cooldownTimeLeft <= 0 && accessCodeCooldownTimeLeft <= 0) return;
    const cdTimer = setInterval(() => {
      setCooldownTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
      setAccessCodeCooldownTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(cdTimer);
  }, [cooldownTimeLeft, accessCodeCooldownTimeLeft]);

  const formatTime = (t) => {
    const hh = String(t.hours).padStart(2, '0');
    const mm = String(t.minutes).padStart(2, '0');
    const ss = String(t.seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // Helper handlers moved to top of component body to prevent hoisting issues

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

  // Download Receipt helper
  const handleDownloadReceipt = (election, token) => {
    const textContent = `=======================================
         VOTEGUARD BALLOT RECEIPT
=======================================
Election ID: \t${election.id}
Verification Token: \t${token}
Timestamp: \t${new Date().toLocaleString()}
Status: \t✓ Vote Successfully Submitted
=======================================
Thank you for participating in secure
democracy. Your vote has been
cryptographically sealed on the ledger.
=======================================`;

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VoteGuard_Receipt_${election.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Receipt downloaded successfully!');
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

  const getFriendlyEventName = (ev) => {
    switch (ev) {
      case 'OTP_VERIFIED': return 'OTP Verified';
      case 'LOGGED_IN': return 'Login Verified';
      case 'SESSION_SAVED': return 'Session Saved';
      case 'SESSION_RESUMED': return 'Session Resumed';
      case 'ELECTION_JOINED': return 'Election Joined';
      case 'ACCESS_CODE_VERIFIED': return 'Access Code Verified';
      case 'TOKEN_GENERATED': return 'Token Generated';
      case 'TOKEN_VERIFIED': return 'Token Verified';
      case 'TOKEN_VERIFIED_PORTAL': return 'Token Checked in Portal';
      case 'VOTE_SUBMITTED': return 'Vote Successfully Submitted';
      case 'VERIFICATION_CREATED': return 'Verification Receipt Created';
      default: return ev;
    }
  };

  const getFriendlyStepName = (stepId) => {
    switch (stepId) {
      case 'details': return 'Election Details';
      case 'eligibility_validating':
      case 'eligible_confirmed': return 'Eligibility Verification';
      case 'token_generating':
      case 'token_gen_complete': return 'Token Request';
      case 'token_delivery': return 'Token Delivery';
      case 'token_entry':
      case 'token_verifying': return 'Token Verification';
      case 'token_verified': return 'Token Authorized';
      case 'candidate_select': return 'Candidate Selection';
      case 'vote_review': return 'Vote Review';
      case 'submitting': return 'Ballot Encryption';
      default: return 'Information Overview';
    }
  };

  const stepsList = [
    { label: 'Details', idx: 1 },
    { label: 'Eligibility', idx: 2 },
    { label: 'Token Request', idx: 3 },
    { label: 'Delivery', idx: 4 },
    { label: 'Verification', idx: 5 },
    { label: 'Selection', idx: 6 },
    { label: 'Review', idx: 7 },
    { label: 'Submit', idx: 8 },
    { label: 'Complete', idx: 9 }
  ];

  const getWizardProgressStepIndex = (step) => {
    if (['access_code_entry', 'access_code_validating', 'access_code_invalid', 'details'].includes(step)) return 1;
    if (['eligibility_validating', 'eligible_confirmed'].includes(step)) return 2;
    if (['token_generating', 'token_gen_complete'].includes(step)) return 3;
    if (step === 'token_delivery') return 4;
    if (['token_entry', 'token_verifying', 'token_verified'].includes(step)) return 5;
    if (step === 'candidate_select') return 6;
    if (step === 'vote_review') return 7;
    if (step === 'submitting') return 8;
    if (step === 'success') return 9;
    return 1;
  };

  const getParticipationStatus = (elec) => {
    if (elec.status === 'Completed') return { text: 'Completed', class: 'completed' };
    if (elec.voted) return { text: 'Vote Submitted', class: 'submitted' };
    if (sessionRecovery && sessionRecovery.electionId === elec.id) return { text: 'In Progress', class: 'in-progress' };
    return { text: 'Not Started', class: 'not-started' };
  };

  const getSavedAgo = useCallback(() => {
    return savedAgoText;
  }, [savedAgoText]);



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
    if (election.status === 'Completed') {
      triggerToast(`Voting Closed. This election is no longer accepting votes. Election Ended: ${election.end}`);
      return;
    }
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
    if (accessCodeCooldownTimeLeft > 0) {
      alert(`Access code verification locked. Please wait ${accessCodeCooldownTimeLeft} seconds.`);
      return;
    }

    if (!accessCodeInput.trim()) {
      alert('Please enter an Access Code.');
      return;
    }
    
    const correctCode = activeWizardElection?.accessCode || 'VG-ACCESS-CR26';

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
        
        if (accessCodeInput.trim().toUpperCase() === correctCode.toUpperCase()) {
          addAuditLog('ACCESS_CODE_VERIFIED', `Access code for ${activeWizardElection?.name} verified successfully`);
          setAccessCodeAttempts(0);
          
          setUnlockedPrivateElectionIds(prev => {
            if (!prev.includes(activeWizardElection.id)) {
              return [...prev, activeWizardElection.id];
            }
            return prev;
          });
          triggerToast(`Private election "${activeWizardElection.name}" unlocked!`);
          setWizardStep('details');
        } else {
          const nextAttempts = accessCodeAttempts + 1;
          setAccessCodeAttempts(nextAttempts);

          let cooldown = 0;
          if (nextAttempts >= 16) cooldown = 300;
          else if (nextAttempts >= 11) cooldown = 60;
          else if (nextAttempts >= 6) cooldown = 30;

          if (cooldown > 0) {
            setAccessCodeCooldownTimeLeft(cooldown);
            addAuditLog('ACCESS_CODE_LOCKOUT', `Multiple failed access code attempts. Cooldown ${cooldown}s active.`);
            triggerToast(`Security lockout triggered. Retry disabled for ${cooldown} seconds.`);
          }

          setWizardStep('access_code_invalid');
        }
      }
    }, 400);
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
  const startTokenGeneration = async () => {
    setWizardStep('token_generating');
    setWizardLoadingProgress(0);
    setWizardLoadingMessage('Creating election token...');

    try {
      const generatedToken = `VG-${activeWizardElection.id.substring(0, 4)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const tokenHash = await sha256(generatedToken);

      const { error: rpcError } = await supabase.rpc('request_election_token', {
        p_election_id: activeWizardElection.id,
        p_token_hash: tokenHash
      });

      if (rpcError) throw rpcError;

      setWizardGeneratedToken(generatedToken);
      addAuditLog('TOKEN_GENERATED', `Cryptographic voting token successfully generated`);
      setWizardStep('token_gen_complete');
    } catch (err) {
      console.error('Failed to generate token:', err);
      alert('Failed to request token: ' + (err.message || err.details || err));
      setWizardStep('details');
    }
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
    
    if (wizardTokenInput.trim().toUpperCase() !== wizardGeneratedToken.toUpperCase()) {
      const nextAttempts = tokenAttempts + 1;
      setTokenAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        const cdDuration = nextAttempts >= 16 ? 300 : (nextAttempts >= 11 ? 60 : 30);
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
  const handleFinalVoteSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setWizardStep('submitting');
    setWizardLoadingProgress(0);
    setWizardLoadingMessage('Encrypting ballot...');

    try {
      const { error: rpcError } = await supabase.rpc('submit_vote', {
        p_token: wizardTokenInput || wizardGeneratedToken,
        p_candidate_id: selectedCandidate.id
      });

      if (rpcError) throw rpcError;

      const timestamp = new Date().toLocaleString();
      const verificationId = wizardTokenInput || wizardGeneratedToken;

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

      addAuditLog('VOTE_SUBMITTED', `Ballot committed to decentralized ledger trace`);
      addAuditLog('VERIFICATION_CREATED', `Verification ID created: ${verificationId}`);

      setNotifications(prev => [
        { id: Date.now(), type: 'Vote Cast Successfully', message: `Your secure ballot for ${activeWizardElection.name} is sealed.`, time: 'Just now', read: false },
        ...prev
      ]);

      setWizardGeneratedToken(verificationId);
      setWizardStep('success');
    } catch (err) {
      console.error('Failed to submit vote:', err);
      alert('Failed to cast vote: ' + (err.message || err.details || err));
      setWizardStep('vote_review');
    } finally {
      setIsSubmitting(false);
    }
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

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0d1117', color: '#f0f6fc', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(74, 157, 143, 0.2)', borderTop: '3px solid #4a9d8f', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13.5px', color: 'rgba(240, 239, 232, 0.8)' }}>Verifying secure session...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`voter-dashboard-container ${isLargeText ? 'large-text' : ''} ${isHighContrast ? 'high-contrast' : ''}`}>
      {/* Session Timeout Warning Banner */}
      {sessionTimeoutWarning && (
        <div className="session-timeout-banner">
          <span className="timeout-text">
            Your session will expire in {Math.floor(sessionTimeoutSeconds / 60)}:{String(sessionTimeoutSeconds % 60).padStart(2, '0')}
          </span>
          <div className="timeout-actions">
            <button className="btn-extend" onClick={() => { setSessionTimeoutWarning(false); setSessionTimeoutSeconds(120); }}>
              Extend Session
            </button>
            <button className="btn-timeout-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      )}

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
        isLargeText={isLargeText}
        setIsLargeText={setIsLargeText}
        isHighContrast={isHighContrast}
        setIsHighContrast={setIsHighContrast}
      />

      <main className="voter-main-viewport">
        {/* Persistent Session Recovery Banner */}
        {sessionRecovery && !activeWizardElection && (
          <div className="session-recovery-banner">
            <div className="recovery-left">
              <span className="recovery-sec-icon"><IconShield size={24} /></span>
              <div className="recovery-text-group">
                <span className="recovery-title">Resume Voting Session</span>
                <span className="recovery-subtitle">
                  Election: <strong>{elections.find(e => e.id === sessionRecovery.electionId)?.name}</strong> | Progress: <strong style={{ color: 'var(--gold)' }}>{Math.round((getWizardProgressStepIndex(sessionRecovery.step) / 9) * 100)}%</strong> ({getFriendlyStepName(sessionRecovery.step)})
                </span>
                <span className="recovery-timestamp">Saved: {getSavedAgo()}</span>
              </div>
            </div>
            <button className="btn-resume-session" onClick={handleResumeSession}>
              Resume Voting
            </button>
          </div>
        )}

        {/* ==========================================
            TAB 1: HOME PAGE
           ========================================== */}
        {activeTab === 'Home' && (
          <div className="tab-pane-view fade-in">
            {/* 1. Voting Command Center Header */}
            <div className="voting-command-center-header">
              <div className="command-title-group">
                <span className="command-eyebrow">INSTITUTIONAL DIGITAL VOTING NETWORK</span>
                <h1>Voting Command Center</h1>
                <p className="welcome-voter-msg">Secure session active for <strong>{voter.name}</strong></p>
              </div>
              <div className="system-readiness-badges">
                <span className="readiness-badge verified">
                  <span className="badge-dot" /> Identity Verified
                </span>
                <span className="readiness-badge eligible">
                  <span className="badge-dot" /> Eligible To Vote
                </span>
                <span className="readiness-badge secure">
                  <span className="badge-dot" /> Secure Voting Enabled
                </span>
              </div>
            </div>

            {/* 2. Main Command Grid */}
            <div className="command-layout-grid">
              {/* Left Column: Active Election Widget */}
              <div className="command-grid-main">
                <SpotlightCard className="election-widget-card-spotlight-wrapper" spotlightColor="rgba(74, 157, 143, 0.15)">
                  <div className="election-widget-card-redesign">
                    <div className="widget-header-meta">
                      <span className="live-pill"><span className="live-dot animate-pulse" /> LIVE ELECTION</span>
                      <span className="election-id-tag">ID: ELC-2026-CR</span>
                    </div>

                    <h2 className="widget-election-title-redesign">CR Election 2026</h2>
                    <p className="widget-election-desc">Class Representative Election for Computer Science students.</p>
                    
                    {/* Countdown Timer */}
                    <div className="widget-countdown-box-redesign">
                      <span className="countdown-label">POLLING WINDOW ENDS IN</span>
                      <span className="countdown-timer-value">{formatTime(timeLeft)}</span>
                    </div>

                    {/* Vote Status Indicator & CTA */}
                    <div className="election-voted-status-section">
                      {crElection.voted ? (
                        <div className="status-locked-completed">
                          <span className="lock-check-icon">✓</span>
                          <div className="status-msg-block">
                            <strong>Vote Successfully Submitted</strong>
                            <p>This election has been completed.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="status-pending-vote">
                          <span className="pending-dot animate-pulse" />
                          <span>Ballot Submission Pending</span>
                        </div>
                      )}
                    </div>

                    <div className="widget-action-footer">
                      {crElection.voted ? (
                        <button className="btn-widget-action view-verif" onClick={() => setActiveTab('Verification')}>
                          View Verification Status
                        </button>
                      ) : (
                        <button className="btn-widget-action participate-cta" onClick={handleParticipate}>
                          Participate Now →
                        </button>
                      )}
                    </div>
                  </div>
                </SpotlightCard>

                {/* Onboarding Guide: How Voting Works */}
                <div className="onboarding-guide-card">
                  <h3>How Voting Works</h3>
                  <p className="guide-subtitle">A walk-through of the cryptographically secure and anonymous voting flow.</p>
                  
                  <div className="onboarding-steps-flow">
                    <div className="onboarding-step-card">
                      <span className="step-num">1</span>
                      <h4>Join Election</h4>
                      <p>Unlock private polls via administrator code.</p>
                    </div>
                    <div className="onboarding-step-card">
                      <span className="step-num">2</span>
                      <h4>Request Token</h4>
                      <p>Check eligibility and request secure token.</p>
                    </div>
                    <div className="onboarding-step-card">
                      <span className="step-num">3</span>
                      <h4>Receive Token</h4>
                      <p>Retrieve single-use token from email/SMS.</p>
                    </div>
                    <div className="onboarding-step-card">
                      <span className="step-num">4</span>
                      <h4>Verify Token</h4>
                      <p>Submit token to open voting session.</p>
                    </div>
                    <div className="onboarding-step-card">
                      <span className="step-num">5</span>
                      <h4>Cast Vote</h4>
                      <p>Select candidate and encrypt ballot.</p>
                    </div>
                    <div className="onboarding-step-card">
                      <span className="step-num">6</span>
                      <h4>Audit Token</h4>
                      <p>Collect verification code for receipt.</p>
                    </div>
                    <div className="onboarding-step-card">
                      <span className="step-num">7</span>
                      <h4>Confirm Count</h4>
                      <p>Verify vote registration in tally later.</p>
                    </div>
                  </div>
                  
                  {!crElection.voted && (
                    <button className="btn-start-voting-onboarding" onClick={handleParticipate}>
                      Start Voting Now
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Verification Quick-check, Mini-timeline & Trust Policy */}
              <div className="command-grid-sidebar">
                {/* Verification Status Summary */}
                <SpotlightCard className="panel-spotlight-wrapper" spotlightColor="rgba(255, 255, 255, 0.08)">
                  <div className="sidebar-quick-card">
                    <h3>Ballot Verification</h3>
                    {crElection.voted ? (
                      <div className="sidebar-verification-voted">
                        <span className="verif-check-green">✓</span>
                        <div className="verif-meta">
                          <strong>Vote Submitted Successfully</strong>
                          <span className="verif-token-code">Token: <code>{crElection.verificationToken}</code></span>
                        </div>
                        <button className="btn-sidebar-audit-link" onClick={() => setActiveTab('Verification')}>Verify Receipt →</button>
                      </div>
                    ) : (
                      <div className="sidebar-verification-pending">
                        <span className="verif-pending-amber">⏳</span>
                        <div className="verif-meta">
                          <strong>No Ballots Cast Yet</strong>
                          <p>Cast a ballot to receive your verification receipt.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </SpotlightCard>

                {/* Recent Activity Mini Timeline */}
                <SpotlightCard className="panel-spotlight-wrapper" spotlightColor="rgba(255, 255, 255, 0.08)">
                  <div className="sidebar-quick-card">
                    <div className="sidebar-card-header">
                      <h3>Live Security timeline</h3>
                      <button className="btn-sidebar-viewall" onClick={() => setActiveTab('Activity')}>View All</button>
                    </div>
                    
                    <div className="timeline-preview-list">
                      {logs.slice(0, 3).map((log, index) => (
                        <div key={index} className="timeline-preview-item">
                          <span className="timeline-preview-dot" />
                          <div className="timeline-preview-content">
                            <span className="timeline-preview-time">{log.ts}</span>
                            <span className="timeline-preview-desc">
                              {getFriendlyEventName(log.ev)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </SpotlightCard>

                {/* Trust & Secrecy Policy */}
                <SpotlightCard className="panel-spotlight-wrapper" spotlightColor="rgba(255, 255, 255, 0.08)">
                  <div className="sidebar-quick-card">
                    <h3>Trust &amp; Secrecy Assurance</h3>
                    <p className="trust-policy-intro">
                      VoteGuard protects your ballot using end-to-end cryptographic shielding to decouple voter identities from selections.
                    </p>
                    
                    <div className="trust-features-grid-redesign">
                      <div className="trust-feature-item">
                        <span className="feature-check">✓</span>
                        <div>
                          <strong>Anonymous Voting</strong>
                          <p>Your voter profile is detached from your cast ballot.</p>
                        </div>
                      </div>
                      <div className="trust-feature-item">
                        <span className="feature-check">✓</span>
                        <div>
                          <strong>One Vote Per Voter</strong>
                          <p>Single-use security credentials prevent double submissions.</p>
                        </div>
                      </div>
                      <div className="trust-feature-item">
                        <span className="feature-check">✓</span>
                        <div>
                          <strong>Vote Verification Available</strong>
                          <p>Audit tokens allow confirming the ballot is in the tally.</p>
                        </div>
                      </div>
                      <div className="trust-feature-item">
                        <span className="feature-check">✓</span>
                        <div>
                          <strong>Vote Cannot Be Modified</strong>
                          <p>Locked immediately onto the decentralized ledger.</p>
                        </div>
                      </div>
                    </div>

                    <button className="btn-toggle-crypto-specs" onClick={() => setShowCryptoDetails(!showCryptoDetails)}>
                      {showCryptoDetails ? "Hide Cryptographic Specifications" : "Review Cryptographic Audit Specifications"}
                    </button>
                    
                    {showCryptoDetails && (
                      <div className="crypto-details-panel fade-in">
                        <div className="crypto-spec-card">
                          <strong>Blind Signatures Protocol</strong>
                          <p>Blinding factors strip roll numbers and names before sealing transaction records.</p>
                        </div>
                        <div className="crypto-spec-card">
                          <strong>AES-256 Ledger Encryption</strong>
                          <p>Ballot values are encrypted using AES blocks prior to storage commits.</p>
                        </div>
                        <div className="crypto-spec-card">
                          <strong>SHA-256 Audit Trail</strong>
                          <p>Unique hashes verify database entries are unaltered.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </SpotlightCard>
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
                  
                  {/* Step indicators (Desktop) */}
                  <div className="wizard-steps-track-9 desktop-only-stepper">
                    {stepsList.map((step) => {
                      const currentIdx = getWizardProgressStepIndex(wizardStep);
                      const isActive = currentIdx === step.idx;
                      const isCompleted = currentIdx > step.idx;
                      return (
                        <div key={step.idx} className={`step-dot-9 ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                          <span className="step-num">{isCompleted ? '✓' : step.idx}</span>
                          <span className="step-lbl">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Step indicators (Mobile) */}
                  <div className="wizard-steps-track-mobile mobile-only-stepper">
                    <div className="mobile-stepper-text">
                      <span className="mobile-step-num-lbl">Step {getWizardProgressStepIndex(wizardStep)} of 9</span>
                      <strong className="mobile-step-label-lbl">{stepsList[getWizardProgressStepIndex(wizardStep) - 1]?.label}</strong>
                    </div>
                    <div className="mobile-stepper-progress-bar">
                      <div className="mobile-stepper-progress-fill" style={{ width: `${(getWizardProgressStepIndex(wizardStep) / 9) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* Persistent Election Time Awareness Banner */}
                {['details', 'eligibility_validating', 'eligible_confirmed', 'token_generating', 'token_gen_complete', 'token_delivery', 'token_entry', 'token_verifying', 'token_verified', 'candidate_select', 'vote_review', 'submitting', 'success'].includes(wizardStep) && (
                  <div className="wizard-time-awareness-banner" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    background: 'rgba(212, 168, 67, 0.08)',
                    border: '1px solid rgba(212, 168, 67, 0.2)',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '12.5px',
                    color: 'var(--text)',
                    gap: '12px',
                    marginTop: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </span>
                      <span><strong>Election Window Closes At:</strong> 26 June 2026 • 5:00 PM</span>
                    </div>
                    <div style={{ fontWeight: '700', color: 'var(--gold)' }}>
                      Election Ends In: {formatTime(timeLeft)}
                    </div>
                  </div>
                )}

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
                      {accessCodeCooldownTimeLeft > 0 ? (
                        <div className="error-state-container" style={{ minHeight: 'auto', padding: '24px 16px', border: '1px solid var(--red)' }}>
                          <div className="error-state-icon">
                            <IconLock size={22} />
                          </div>
                          <div className="error-state-title" style={{ color: 'var(--red)' }}>Security Lockout Active</div>
                          <p className="error-state-desc">Too many failed access code attempts. Retry is disabled for <strong>{accessCodeCooldownTimeLeft} seconds</strong>.</p>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            placeholder="VG-ACCESS-XXXX"
                            value={accessCodeInput}
                            onChange={(e) => setAccessCodeInput(e.target.value)}
                            className="wizard-token-textbox font-mono"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                          />
                          {accessCodeAttempts > 0 && (
                            <span style={{ color: 'var(--red)', fontSize: '12.5px', marginTop: '8px', display: 'block', fontWeight: '600', textAlign: 'left' }}>
                              ⚠️ Invalid Access Code. Attempt {accessCodeAttempts} of 5 before throttling.
                            </span>
                          )}
                          <div className="admin-hint-text" style={{ marginTop: '8px' }}>
                            <IconBulb size={16} /> Admin access code: <code>{activeWizardElection?.accessCode || 'VG-ACCESS-CR26'}</code>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="wizard-slide-footer full-width">
                      <button className="btn-wizard-nav-back" onClick={handleCloseVotingModal} disabled={accessCodeCooldownTimeLeft > 0}>Cancel</button>
                      <button 
                        className="btn-wizard-nav-proceed select-item" 
                        onClick={handleJoinPrivateElection}
                        disabled={accessCodeCooldownTimeLeft > 0 || !accessCodeInput.trim()}
                      >
                        Join Election →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: ACCESS CODE VALIDATION LOADING */}
                {wizardStep === 'access_code_validating' && (
                  <div className="wizard-slide-card center-aligned fade-in" aria-live="polite" aria-busy="true">
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
                    <div className="error-state-container" style={{ padding: '24px 16px', minHeight: 'auto' }}>
                      <div className="error-state-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </div>
                      <div className="error-state-title">Invalid Access Code</div>
                      <p className="error-state-desc">The access code entered is not registered in the system or you are not an authorized voter for this poll.</p>
                      <button className="error-state-retry" onClick={() => {
                        setAccessCodeInput('');
                        setWizardStep('access_code_entry');
                      }}>
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: ELECTION DETAILS PAGE */}
                {wizardStep === 'details' && (
                  <div className="wizard-slide-card fade-in">
                    <div className="wizard-slide-header">
                      <div className="slide-eyebrow">Step 1 of 9 — Election Details</div>
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
                        <div className="voting-rules-redesign-card">
                          <h3>Voting Rules</h3>
                          <ul className="rules-bullet-list-redesign">
                            <li>
                              <span className="rule-bullet-dot">•</span>
                              <div className="rule-text"><strong>One token = one vote</strong><p>Each voting token enables a single ballot submission.</p></div>
                            </li>
                            <li>
                              <span className="rule-bullet-dot">•</span>
                              <div className="rule-text"><strong>Votes cannot be changed</strong><p>Once cast, the ballot is sealed immutably onto the registry ledger.</p></div>
                            </li>
                            <li>
                              <span className="rule-bullet-dot">•</span>
                              <div className="rule-text"><strong>Anonymous candidate selection</strong><p>The system decouples your voter credentials from your ballot choice.</p></div>
                            </li>
                            <li>
                              <span className="rule-bullet-dot">•</span>
                              <div className="rule-text"><strong>Verification token kept private</strong><p>Keep your audit receipt code safe to confirm your vote was counted.</p></div>
                            </li>
                          </ul>
                        </div>
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
                  <div className="wizard-slide-card center-aligned fade-in" aria-live="polite" aria-busy="true">
                    <div className="premium-loader-ring">
                      <div className="progress-ring-track" />
                      <div className="progress-ring-fill" style={{ transform: `rotate(${wizardLoadingProgress * 3.6}deg)` }} />
                      <span className="progress-pct-value">{Math.round(wizardLoadingProgress)}%</span>
                    </div>

                    <h2>Validating Voter Credentials</h2>
                    <p className="loading-subtext-message">{wizardLoadingMessage}</p>

                    <div className="progressive-eligibility-checklist" style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '20px',
                      boxSizing: 'border-box',
                      textAlign: 'left',
                      marginTop: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: wizardLoadingProgress >= 20 ? 'var(--teal)' : 'var(--text3)', fontWeight: wizardLoadingProgress >= 20 ? '600' : 'normal', transition: 'color 0.3s' }}>
                        <span>{wizardLoadingProgress >= 20 ? '✓' : '●'}</span>
                        <span>Checking registration record...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: wizardLoadingProgress >= 40 ? 'var(--teal)' : 'var(--text3)', fontWeight: wizardLoadingProgress >= 40 ? '600' : 'normal', transition: 'color 0.3s' }}>
                        <span>{wizardLoadingProgress >= 40 ? '✓' : '●'}</span>
                        <span>Validating department restrictions...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: wizardLoadingProgress >= 60 ? 'var(--teal)' : 'var(--text3)', fontWeight: wizardLoadingProgress >= 60 ? '600' : 'normal', transition: 'color 0.3s' }}>
                        <span>{wizardLoadingProgress >= 60 ? '✓' : '●'}</span>
                        <span>Reviewing participation rules...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: wizardLoadingProgress >= 80 ? 'var(--teal)' : 'var(--text3)', fontWeight: wizardLoadingProgress >= 80 ? '600' : 'normal', transition: 'color 0.3s' }}>
                        <span>{wizardLoadingProgress >= 80 ? '✓' : '●'}</span>
                        <span>Checking double-voting prevention ledger...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: wizardLoadingProgress >= 100 ? 'var(--teal)' : 'var(--text3)', fontWeight: wizardLoadingProgress >= 100 ? '600' : 'normal', transition: 'color 0.3s' }}>
                        <span>{wizardLoadingProgress >= 100 ? '✓' : '●'}</span>
                        <span>Voter eligibility confirmed.</span>
                      </div>
                    </div>
                    
                    <div className="cryptographic-console-logs" style={{ marginTop: '16px', width: '100%' }}>
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

                    <div className="election-readiness-card">
                      <h3>Election Readiness Check</h3>
                      <div className="readiness-checks-grid">
                        <div className="readiness-check-item success">✓ Identity Verified</div>
                        <div className="readiness-check-item success">✓ Eligible To Vote</div>
                        <div className="readiness-check-item success">✓ Election Active</div>
                        <div className="readiness-check-item success">✓ Token Request Available</div>
                      </div>
                      <div className="readiness-status-banner-badge">Ready To Proceed</div>
                    </div>

                    <div className="eligibility-details-box text-left" style={{ marginTop: '20px' }}>
                      <div className="el-row"><span className="lbl">Voter Name:</span> <span className="val">{voter.name}</span></div>
                      <div className="el-row"><span className="lbl">Authorization ID:</span> <span className="val font-mono">{voter.userId}</span></div>
                      <div className="el-row"><span className="lbl">Roll Number:</span> <span className="val font-mono">{voter.rollNumber}</span></div>
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
                  <div className="wizard-slide-card center-aligned fade-in" aria-live="polite" aria-busy="true">
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
                      <button className="btn-wizard-nav-proceed center-btn" onClick={() => setWizardStep('token_delivery')}>
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: TOKEN DELIVERY STATUS */}
                {wizardStep === 'token_delivery' && (
                  <div className="wizard-slide-card center-aligned fade-in">
                    <div className="token-icon-wrapper-circle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" style={{ width: '32px', height: '32px' }}>
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>

                    <h2>Token Dispatched</h2>
                    <p className="success-subtext" style={{ fontSize: '13.5px', marginBottom: '16px' }}>Your secure voting token has been sent.</p>

                    <div className="token-delivery-tips-box" style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '16px',
                      boxSizing: 'border-box',
                      textAlign: 'left',
                      marginBottom: '16px'
                    }}>
                      <strong style={{ color: 'var(--text)', display: 'block', fontSize: '13px', marginBottom: '8px' }}>Please check your verified channels:</strong>
                      <div className="delivery-tip-item" style={{ fontSize: '12.5px', color: 'var(--text2)', display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <span>✓</span> <span>Inbox (aarav.mehta@vit.edu)</span>
                      </div>
                      <div className="delivery-tip-item" style={{ fontSize: '12.5px', color: 'var(--text2)', display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <span>✓</span> <span>Spam Folder / Junk Mail</span>
                      </div>
                      <div className="delivery-tip-item" style={{ fontSize: '12.5px', color: 'var(--text2)', display: 'flex', gap: '8px' }}>
                        <span>✓</span> <span>Promotions / Updates Tab</span>
                      </div>
                    </div>

                    <div className="token-safety-notice-box-redesign" style={{
                      padding: '14px',
                      background: 'rgba(255, 107, 107, 0.08)',
                      border: '1px solid rgba(255, 107, 107, 0.2)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      fontSize: '12.5px',
                      lineHeight: '1.5',
                      textAlign: 'left',
                      width: '100%',
                      boxSizing: 'border-box',
                      marginBottom: '20px'
                    }}>
                      <strong style={{ color: 'var(--red)', display: 'block', marginBottom: '4px' }}>⚠️ Security Alert</strong>
                      This token can only be used once. Anyone with access to this token can cast a ballot under your credentials. Keep it strictly private.
                    </div>

                    <div className="wizard-slide-footer full-width">
                      <button className="btn-wizard-nav-back" onClick={() => setWizardStep('token_gen_complete')}>Back</button>
                      <button className="btn-wizard-nav-proceed select-item" onClick={() => setWizardStep('token_entry')}>
                        I Have My Token →
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
                          <div className="error-state-container" style={{ minHeight: 'auto', padding: '24px 16px', border: '1px solid var(--red)' }}>
                            <div className="error-state-icon">
                              <IconLock size={22} />
                            </div>
                            <div className="error-state-title" style={{ color: 'var(--red)' }}>Security Lockout Active</div>
                            <p className="error-state-desc">Too many failed attempts. Retry is disabled for <strong>{cooldownTimeLeft} seconds</strong>.</p>
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
                            {tokenAttempts > 0 && cooldownTimeLeft <= 0 && (
                              <span style={{ color: 'var(--red)', fontSize: '12.5px', marginTop: '8px', display: 'block', fontWeight: '600', textAlign: 'left' }}>
                                ⚠️ Invalid Token. Attempt {tokenAttempts} of 5. Please try again.
                              </span>
                            )}
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
                    <div className="wizard-slide-card center-aligned fade-in" aria-live="polite" aria-busy="true">
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
                      <div className="wizard-slide-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="slide-eyebrow">Step 6 of 9 — Candidate Ballot Selection</div>
                        <h2>Cast Your Ballot Selection</h2>
                        <p>Hover and select your preferred representative card. Choose carefully; your final choice is cryptographically blinded.</p>
                        
                        <button className="btn-compare-candidates-trigger" onClick={() => setShowComparisonModal(true)} style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          alignSelf: 'flex-start',
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '14px', height: '14px', color: 'var(--teal)' }}>
                            <path d="M16 3h5v5M4 20L21 3M21 20l-7-7M3 3l7 7" />
                          </svg>
                          Compare Candidates
                        </button>
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
                            style={{ position: 'relative', cursor: 'pointer' }}
                          >
                            {selectedCandidate && selectedCandidate.id === cand.id && (
                              <div className="candidate-selected-checkmark-overlay">
                                ✓
                              </div>
                            )}

                            <div className="cand-card-top">
                              <div className="cand-large-circle-avatar">
                                {cand.photo}
                              </div>
                              <div className="cand-meta-text">
                                <h4>{cand.name}</h4>
                                <span className="cand-position-badge">Candidate for {activeWizardElection.name.replace(' Election', '')}</span>
                                <span className="dept-label-cand">{cand.dept}</span>
                              </div>
                            </div>

                            <div className="cand-card-manifesto">
                              <strong>Manifesto Summary:</strong>
                              <p>"{cand.manifesto}"</p>
                            </div>

                            <div className="cand-card-about">
                              <strong>About Candidate:</strong>
                              <p>{cand.about}</p>
                            </div>

                            <div className="cand-card-action-row">
                              <button className={`btn-select-candidate-action ${selectedCandidate && selectedCandidate.id === cand.id ? 'selected' : ''}`}>
                                {selectedCandidate && selectedCandidate.id === cand.id ? '✓ Selected' : 'Select Candidate'}
                              </button>
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
                            onClick={() => {
                              setConfirmReviewed(false);
                              setConfirmFinal(false);
                              setWizardStep('vote_review');
                            }}
                          >
                            Continue →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Candidate Comparison Modal */}
                  {showComparisonModal && (
                    <div className="voting-modal-backdrop list-details-overlay-backdrop comparison-modal-backdrop" style={{ zIndex: 2000 }}>
                      <div className="voting-modal-card comparison-modal-card" style={{ maxWidth: '800px', width: '90%' }}>
                        <div className="modal-header">
                          <div className="secure-badge">
                            <span>Candidate Comparison Grid</span>
                          </div>
                          <button className="btn-modal-close" onClick={() => setShowComparisonModal(false)}>✕</button>
                        </div>

                        <div className="modal-body-step fade-in">
                          <table className="comparison-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '12px', width: '20%', color: 'var(--text)' }}>Parameter</th>
                                {(activeWizardElection.candidates || []).map((cand) => (
                                  <th key={cand.id} style={{ padding: '12px', width: '40%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--teal), var(--teal3))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px' }}>
                                        {cand.photo}
                                      </div>
                                      <div>
                                        <strong style={{ display: 'block', color: 'var(--text)' }}>{cand.name}</strong>
                                        <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{cand.dept}</span>
                                      </div>
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text)' }}>Manifesto</td>
                                {(activeWizardElection.candidates || []).map((cand) => (
                                  <td key={cand.id} style={{ padding: '12px', color: 'var(--text2)', lineHeight: '1.4' }}>
                                    "{cand.manifesto}"
                                  </td>
                                ))}
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text)' }}>About</td>
                                {(activeWizardElection.candidates || []).map((cand) => (
                                  <td key={cand.id} style={{ padding: '12px', color: 'var(--text3)', lineHeight: '1.4' }}>
                                    {cand.about}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>

                          <div className="modal-footer-btns" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn-modal-back" onClick={() => setShowComparisonModal(false)}>Close Comparison</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 8: VOTE REVIEW */}
                  {wizardStep === 'vote_review' && (
                    <div className="wizard-slide-card fade-in">
                      <div className="wizard-slide-header">
                        <div className="slide-eyebrow">Step 7 of 9 — Review Ballot Choice</div>
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

                        <div className="review-checkboxes-container" style={{
                          marginTop: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          padding: '16px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          boxSizing: 'border-box'
                        }}>
                          <label className="custom-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: 'var(--text)' }}>
                            <input
                              type="checkbox"
                              checked={confirmReviewed}
                              onChange={(e) => setConfirmReviewed(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--teal)' }}
                            />
                            I confirm that I have reviewed my candidate selection.
                          </label>
                          <label className="custom-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: 'var(--text)' }}>
                            <input
                              type="checkbox"
                              checked={confirmFinal}
                              onChange={(e) => setConfirmFinal(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--teal)' }}
                            />
                            I understand my vote cannot be changed after submission.
                          </label>
                        </div>
                      </div>

                      <div className="wizard-slide-footer">
                        <button className="btn-wizard-nav-back" onClick={() => setWizardStep('candidate_select')}>Back</button>
                        <button 
                          className="btn-wizard-nav-proceed finalize-vote-submit-btn" 
                          onClick={handleFinalVoteSubmit}
                          disabled={!confirmReviewed || !confirmFinal}
                          style={{ opacity: (confirmReviewed && confirmFinal) ? 1 : 0.5, cursor: (confirmReviewed && confirmFinal) ? 'pointer' : 'not-allowed' }}
                        >
                          Submit Vote <IconBox size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 9: VOTE SUBMISSION LOADING */}
                  {wizardStep === 'submitting' && (
                    <div className="wizard-slide-card center-aligned fullscreen-loading-overlay fade-in" aria-live="polite" aria-busy="true">
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
                          <span className="value">{new Date().toLocaleString()}</span>
                        </div>

                        {/* Token display box */}
                        <div className="receipt-code-display-block" style={{ padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginTop: '16px' }}>
                          <span className="label" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>VERIFICATION TOKEN</span>
                          <div className="receipt-token-box-redesign" style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px', borderRadius: '6px', fontSize: '16px', fontWeight: '700', letterSpacing: '1px', color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>
                            {wizardGeneratedToken}
                          </div>
                          
                          <div className="receipt-code-actions-row" style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            <button className="btn-receipt-action-copy-redesign" style={{ flex: 1, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '600' }} onClick={() => handleCopyText(wizardGeneratedToken, 'Verification Token')}>
                              Copy Token
                            </button>
                            <button className="btn-receipt-action-download-redesign" style={{ flex: 1, padding: '10px', background: 'var(--teal)', border: 'none', color: '#07100e', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '600' }} onClick={() => handleDownloadReceipt(activeWizardElection, wizardGeneratedToken)}>
                              Download Receipt
                            </button>
                          </div>
                        </div>

                        <p className="receipt-audit-reminder" style={{ marginTop: '12px' }}>Save this token. It can later be used to verify that your vote was successfully counted. The token does NOT reveal candidate selection or voter identity.</p>
                      </div>

                      <div className="wizard-slide-footer full-width flex-row-buttons">
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

                  {/* Floating Help Shortcut during Voting */}
                  <div className="wizard-floating-help-container" style={{ position: 'absolute', bottom: '24px', right: '30px', zIndex: 100 }}>
                    <button
                      className="btn-floating-help"
                      onClick={() => setShowHelpPopover(!showHelpPopover)}
                      style={{
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        padding: '8px 14px',
                        borderRadius: '30px',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-tight)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '14px', height: '14px', color: 'var(--gold)' }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Need Help?
                    </button>

                    {showHelpPopover && (
                      <div className="help-popover-card animate-scale-up" style={{
                        position: 'absolute',
                        bottom: '44px',
                        right: 0,
                        width: '320px',
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: 'var(--shadow-soft)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        textAlign: 'left'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--text)' }}>Voter Support Centre</span>
                          <button onClick={() => setShowHelpPopover(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '14px', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div className="help-tabs-row" style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: '8px', gap: '8px' }}>
                          <button onClick={() => setHelpActiveSection('faq')} style={{ background: helpActiveSection === 'faq' ? 'var(--teal2)' : 'none', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', color: helpActiveSection === 'faq' ? 'var(--teal)' : 'var(--text3)', cursor: 'pointer', fontWeight: '600' }}>FAQs</button>
                          <button onClick={() => setHelpActiveSection('contact')} style={{ background: helpActiveSection === 'contact' ? 'var(--teal2)' : 'none', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', color: helpActiveSection === 'contact' ? 'var(--teal)' : 'var(--text3)', cursor: 'pointer', fontWeight: '600' }}>Contact Team</button>
                          <button onClick={() => setHelpActiveSection('report')} style={{ background: helpActiveSection === 'report' ? 'var(--teal2)' : 'none', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', color: helpActiveSection === 'report' ? 'var(--teal)' : 'var(--text3)', cursor: 'pointer', fontWeight: '600' }}>Token Issue</button>
                        </div>

                        <div className="help-content-pane" style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '11.5px', lineHeight: '1.4', color: 'var(--text2)' }}>
                          {helpActiveSection === 'faq' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <strong>Is my selection private?</strong>
                                <p style={{ margin: '2px 0 0 0', color: 'var(--text3)' }}>Yes, VoteGuard strips all voter identifiers before storing the encrypted vote block.</p>
                              </div>
                              <div>
                                <strong>Where do I get my token?</strong>
                                <p style={{ margin: '2px 0 0 0', color: 'var(--text3)' }}>Generate it in Step 3. It will be dispatched via Email and SMS channels.</p>
                              </div>
                              <div>
                                <strong>Can I change my vote?</strong>
                                <p style={{ margin: '2px 0 0 0', color: 'var(--text3)' }}>No, once submitted, ballots are cryptographically sealed in the ledger trace.</p>
                              </div>
                            </div>
                          )}

                          {helpActiveSection === 'contact' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {contactFormStatus ? (
                                <div style={{ color: 'var(--teal)', fontWeight: '600', padding: '8px 0' }}>{contactFormStatus}</div>
                              ) : (
                                <>
                                  <span>Send an urgent query to the election board administrators.</span>
                                  <textarea
                                    placeholder="Your message..."
                                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '6px 8px', fontSize: '11.5px', outline: 'none', resize: 'none', height: '60px', boxSizing: 'border-box' }}
                                    id="help-support-contact-msg"
                                  />
                                  <button
                                    onClick={() => {
                                      setContactFormStatus('Query dispatched successfully. An administrator will respond shortly.');
                                      setTimeout(() => setContactFormStatus(''), 4000);
                                    }}
                                    style={{ background: 'var(--teal)', border: 'none', color: 'white', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontWeight: '600' }}
                                  >
                                    Submit Ticket
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {helpActiveSection === 'report' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {contactFormStatus ? (
                                <div style={{ color: 'var(--teal)', fontWeight: '600', padding: '8px 0' }}>{contactFormStatus}</div>
                              ) : (
                                <>
                                  <span>Report a dispatch failure or invalid token code.</span>
                                  <button
                                    onClick={() => {
                                      setContactFormStatus('System check triggered. Token resent to email & phone channels.');
                                      setTimeout(() => setContactFormStatus(''), 4000);
                                    }}
                                    style={{ background: 'var(--gold)', border: 'none', color: 'black', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                  >
                                    Re-dispatch Token via Backup Channels
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

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
                    <SpotlightCard className="metric-card welcome" spotlightColor="rgba(255, 255, 255, 0.06)" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Voter Identity</span>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>{voter.name}</h3>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text2)' }}>{voter.rollNumber} • CS</span>
                    </SpotlightCard>
                    <SpotlightCard className="metric-card" spotlightColor="rgba(255, 255, 255, 0.08)" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Eligible Polls</span>
                      <span className="metric-val" style={{ fontSize: '20px', fontWeight: '750', color: 'var(--text)' }}>
                        <CountUpNumber to={eligibleCount} from={0} duration={1} />
                      </span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Registered Profiles</span>
                    </SpotlightCard>
                    <SpotlightCard className="metric-card" spotlightColor="rgba(74, 157, 143, 0.15)" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Active Channels</span>
                      <span className="metric-val text-teal" style={{ fontSize: '20px', fontWeight: '750', color: 'var(--teal)' }}>
                        <CountUpNumber to={activeCount} from={0} duration={1} />
                      </span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Live Elections</span>
                    </SpotlightCard>
                    <SpotlightCard className="metric-card" spotlightColor="rgba(255, 255, 255, 0.08)" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Voting Status</span>
                      <span className="metric-val" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', margin: '4px 0' }}>
                        <CountUpNumber to={votedCount} from={0} duration={1} /> Cast / <CountUpNumber to={pendingCount} from={0} duration={1} /> Pending
                      </span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Secure Ballots</span>
                    </SpotlightCard>
                    <SpotlightCard className="metric-card" spotlightColor="rgba(255, 255, 255, 0.08)" style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Recent Activity</span>
                      <span className="metric-val-activity truncate" title={latestActivity} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', margin: '4px 0' }}>{latestActivity}</span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Signed Audit Log</span>
                    </SpotlightCard>
                    <SpotlightCard className="metric-card" spotlightColor="rgba(212, 168, 67, 0.15)" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="metric-title" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', fontWeight: '600' }}>Notifications</span>
                      <span className="metric-val text-gold" style={{ fontSize: '20px', fontWeight: '750', color: 'var(--gold)' }}>
                        <CountUpNumber to={unreadNotifsCount} from={0} duration={1} />
                      </span>
                      <span className="metric-subtitle" style={{ fontSize: '11px', color: 'var(--text3)' }}>Unread Announcements</span>
                    </SpotlightCard>
                  </div>

                  <div className="elections-split-layout" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                    
                    {/* Public & Private Elections Column */}
                    <div className="elections-public-column">
                      <div className="elections-section">
                        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'var(--text)' }}>Public Elections</h2>
                        
                        <div className="elections-grid-container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                          {elections.filter(e => e.type === 'Public').length === 0 ? (
                            <div className="empty-state-container">
                              <div className="empty-state-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              </div>
                              <div className="empty-state-title">No Elections Available</div>
                              <p className="empty-state-desc">There are no active public elections registered on the platform at this time.</p>
                            </div>
                          ) : elections.filter(e => e.type === 'Public').map((elec) => {
                            const statusInfo = getParticipationStatus(elec);
                            return (
                              <SpotlightCard key={elec.id} className="election-card-spotlight-item-wrapper" spotlightColor="rgba(74, 157, 143, 0.12)">
                                <div className={`election-card-item ${elec.status.toLowerCase()}`} style={{ border: 'none', background: 'transparent', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                                  <div className="card-badge-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <span className={`status-badge-lbl ${elec.status.toLowerCase()}`} style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px' }}>
                                        {elec.status}
                                      </span>
                                      <span className={`status-badge-lbl participation ${statusInfo.class}`} style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px' }}>
                                        {statusInfo.text}
                                      </span>
                                    </div>
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
                                      <button className="btn-card-details participate-action-btn" onClick={() => launchVotingWizard(elec)} style={{ flex: 1, background: 'var(--teal)', color: '#07100e', border: 'none', fontWeight: '600' }}>
                                        Participate
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </SpotlightCard>
                            );
                          })}
                        </div>
                      </div>

                      <div className="elections-section" style={{ marginTop: '36px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Private Elections
                        </h2>
                        
                        <div className="elections-grid-container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                          {elections.filter(e => e.type === 'Private' && unlockedPrivateElectionIds.includes(e.id)).length === 0 ? (
                            <div className="empty-state-container" style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '8px', minHeight: '180px' }}>
                              <div className="empty-state-icon">
                                <IconLock size={20} />
                              </div>
                              <div className="empty-state-title" style={{ fontSize: '14px' }}>No Private Elections Unlocked</div>
                              <p className="empty-state-desc">Enter an access code in the sidebar panel to unlock private election access.</p>
                            </div>
                          ) : elections.filter(e => e.type === 'Private' && unlockedPrivateElectionIds.includes(e.id)).map((elec) => {
                            const statusInfo = getParticipationStatus(elec);
                            return (
                              <SpotlightCard key={elec.id} className="election-card-spotlight-item-wrapper" spotlightColor="rgba(212, 168, 67, 0.12)">
                                <div className={`election-card-item ${elec.status.toLowerCase()}`} style={{ border: 'none', background: 'transparent', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                                  <div className="card-badge-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <span className={`status-badge-lbl ${elec.status.toLowerCase()}`} style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px' }}>
                                        {elec.status}
                                      </span>
                                      <span className={`status-badge-lbl participation ${statusInfo.class}`} style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px' }}>
                                        {statusInfo.text}
                                      </span>
                                    </div>
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
                                      <button className="btn-card-details participate-action-btn" onClick={() => launchVotingWizard(elec)} style={{ flex: 1, background: 'var(--teal)', color: '#07100e', border: 'none', fontWeight: '600' }}>
                                        Participate
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </SpotlightCard>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Private Elections Access Card Column */}
                    <div className="elections-private-column">
                      <SpotlightCard className="join-private-spotlight-wrapper" spotlightColor="rgba(255, 255, 255, 0.08)">
                        <div className="join-private-election-card" style={{ border: 'none', background: 'transparent', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
                          {wizardStep === 'access_code_validating' && !activeWizardElection ? (
                            <div style={{ textAlign: 'left', padding: '10px 0' }}>
                              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700' }}>Unlocking Private Session</h3>
                              
                              <div className="validation-loading-status-list">
                                <div className={`validation-loading-step ${wizardLoadingProgress >= 20 ? 'completed' : 'active'}`}>
                                  <span className="step-bullet">{wizardLoadingProgress >= 20 ? '✓' : '●'}</span>
                                  <span>Searching Election...</span>
                                </div>
                                <div className={`validation-loading-step ${wizardLoadingProgress >= 40 ? 'completed' : wizardLoadingProgress >= 20 ? 'active' : ''}`}>
                                  <span className="step-bullet">{wizardLoadingProgress >= 40 ? '✓' : '●'}</span>
                                  <span>Validating Access Code...</span>
                                </div>
                                <div className={`validation-loading-step ${wizardLoadingProgress >= 60 ? 'completed' : wizardLoadingProgress >= 40 ? 'active' : ''}`}>
                                  <span className="step-bullet">{wizardLoadingProgress >= 60 ? '✓' : '●'}</span>
                                  <span>Checking Eligibility...</span>
                                </div>
                                <div className={`validation-loading-step ${wizardLoadingProgress >= 80 ? 'completed' : wizardLoadingProgress >= 60 ? 'active' : ''}`}>
                                  <span className="step-bullet">{wizardLoadingProgress >= 80 ? '✓' : '●'}</span>
                                  <span>Preparing Session...</span>
                                </div>
                                <div className={`validation-loading-step ${wizardLoadingProgress >= 100 ? 'completed' : wizardLoadingProgress >= 80 ? 'active' : ''}`}>
                                  <span className="step-bullet">{wizardLoadingProgress >= 100 ? '✓' : '●'}</span>
                                  <span>Access Granted</span>
                                </div>
                              </div>
                            </div>
                          ) : wizardStep === 'access_code_invalid' && !activeWizardElection ? (
                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                              <div className="error-cross-bubble" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--red2)', color: 'var(--red)', display: 'flex', alignItems: 'center', justify: 'center', border: '2px solid var(--red3)', margin: '0 auto 12px', boxShadow: '0 0 16px var(--red2)' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: '20px', height: '20px' }}>
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </div>
                              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>Invalid Access Code</h3>
                              <p style={{ fontSize: '12px', color: 'var(--text2)', margin: '4px 0 12px 0' }}>The access code entered is not registered or you are not authorized.</p>
                              <button className="btn-join-private-submit error-btn" onClick={() => { setAccessCodeInput(''); setWizardStep(null); }} style={{ background: 'var(--red)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' }}>
                                Try Again
                              </button>
                            </div>
                          ) : (
                            <>
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
                                >
                                  Join Election
                                </button>
                              </div>

                              <div className="admin-hint-text" style={{ fontSize: '11px', color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                                <IconBulb size={16} /> Private access code: <code>VG-ACCESS-CR26</code>
                              </div>
                            </>
                          )}
                        </div>
                      </SpotlightCard>
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

            {elections.length === 0 ? (
              <div className="empty-state-container">
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div className="empty-state-title">No Results Available</div>
                <p className="empty-state-desc">There are no completed or active election results to display right now.</p>
              </div>
            ) : (
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
            )}
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

            {logs.length === 0 ? (
              <div className="empty-state-container">
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div className="empty-state-title">No Audit Records Found</div>
                <p className="empty-state-desc">No secure activity has been logged for this voter profile yet.</p>
              </div>
            ) : (
              <div className="activity-timeline-wrapper">
              <div className="timeline-trail-line" />
              
              <div className="timeline-items-stack">
                {logs.map((log, idx) => (
                  <div key={idx} className="timeline-item-card">
                    <div className="timeline-bullet-dot" />
                    
                    <div className="timeline-card-header">
                      <div className="header-meta">
                        <span className={`event-badge ${log.status}`}>{getFriendlyEventName(log.ev)}</span>
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
            )}
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

            {/* Token Search Box */}
            <div className="verification-search-container" style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px',
              boxSizing: 'border-box'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Verify My Ballot Token</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text2)' }}>
                Enter your secure Voting Verification Token below to search the decentralised ledger and verify that your ballot was successfully recorded in the audit tally.
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="e.g. VG-2026-XXXXXX"
                  value={verificationSearchToken}
                  onChange={(e) => setVerificationSearchToken(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
                <button
                  onClick={handleVerifyTokenInPortal}
                  style={{
                    background: 'var(--teal)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Verify Token
                </button>
              </div>

              {verificationError && (
                <div style={{ marginTop: '16px', color: '#fa5252', fontSize: '13px', fontWeight: '600' }}>
                  ❌ {verificationError}
                </div>
              )}

              {verificationResult && (
                <div className="verification-success-card" style={{
                  marginTop: '20px',
                  background: 'var(--bg2)',
                  border: '1px solid var(--teal)',
                  borderRadius: '8px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  animation: 'tabFadeIn 0.3s ease-out'
                }}>
                  <h4 style={{ margin: 0, color: 'var(--teal)', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✓ Ballot Verification Confirmed
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text3)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Election</span>
                      <strong style={{ color: 'var(--text)' }}>{verificationResult.electionName}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text3)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Token Code</span>
                      <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{verificationResult.token}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text3)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Ledger Status</span>
                      <strong style={{ color: 'var(--teal)' }}>{verificationResult.status}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text3)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Counted Timestamp</span>
                      <strong style={{ color: 'var(--text)' }}>{verificationResult.time}</strong>
                    </div>
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    ℹ️ Cryptographic audit checks verified. To preserve voting privacy, selection payload is detached and blinded.
                  </p>
                </div>
              )}
            </div>

            {elections.length === 0 ? (
              <div className="empty-state-container">
                <div className="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <div className="empty-state-title">No Elections to Verify</div>
                <p className="empty-state-desc">There are no elections available to perform cryptographic verification checks on.</p>
              </div>
            ) : (
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
                      <span className="v-lbl">Voting Verification Token:</span>
                      {elec.voted ? (
                        <div className="token-visualizer-box">
                          <code className="token-code-text">{elec.verificationToken}</code>
                          <button className="btn-token-copy-action" onClick={() => handleCopyText(elec.verificationToken, 'Voting Verification Token')}>
                            Copy Token
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
                        <IconInfoCircle size={18} /> Save this token. It can later be used to verify that your vote was successfully counted. The token does NOT reveal candidate selection or voter identity.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
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
