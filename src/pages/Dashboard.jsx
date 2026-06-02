// Active Super Admin Dashboard with Profile & Productivity Workspace support
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import ThemeToggle from '../components/ThemeToggle';
import CountUpNumber from '../components/ReactBits/CountUpNumber';
import SpotlightCard from '../components/ReactBits/SpotlightCard';
import '../styles/Dashboard.css';
import { IconChartBar, IconBox, IconUsers, IconHeartHandshake, IconTrophy, IconFolder, IconPlug, IconAlertCircle, IconUser, IconBolt, IconBell, IconShield, IconTrendingUp, IconAlertTriangle, IconDeviceFloppy, IconEye, IconPlayerPause, IconPlayerPlay, IconLockOpen, IconPackage, IconInbox, IconCamera, IconPencil, IconRefresh, IconSearch, IconFileDescription, IconScale, IconPlus, IconArchive, IconPin, IconCircleCheck } from '@tabler/icons-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Dashboard'); // Navigation Tabs
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const navigate = useNavigate();

  // Clock ticking effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState('');

  // Notifications Bell State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'critical', text: 'ECE Rep Election Tie Imbalance Identified.', ts: '5 mins ago', read: false },
    { id: 2, type: 'warning', text: 'SMS Delivery Relay Latency high (1.4s).', ts: '15 mins ago', read: false },
    { id: 3, type: 'info', text: 'System backup synchronized successfully.', ts: '25 mins ago', read: true },
    { id: 4, type: 'info', text: 'Student Council President template updated.', ts: '1 hour ago', read: true },
  ]);

  // Active Alerts state (Tab 8 Null-State triggers fallback when length is 0)
  const [activeAlerts] = useState([]);
  const [resolvedAlerts] = useState([
    { id: 'ALT101', title: 'Database connection pool usage spike', severity: 'warning', date: '2026-06-02 11:15', duration: '14 mins', resolution: 'Auto-scaled connection pools' },
    { id: 'ALT102', title: 'Email API provider connection timeout', severity: 'critical', date: '2026-06-02 09:22', duration: '3 mins', resolution: 'Switched to primary backup mail route' },
    { id: 'ALT103', title: 'Voter verification API rate-limit alert', severity: 'warning', date: '2026-06-01 16:40', duration: '30s', resolution: 'Throttled requests dynamically' }
  ]);

  // Elections State
  const [elections, setElections] = useState([
    { 
      id: 'ELC001', 
      name: 'Student Council President 2026', 
      description: 'Annual election for the college student council president position.',
      start: '2026-06-01', 
      end: '2026-06-03 16:00', 
      type: 'Public',
      status: 'Running', 
      voters: 2500, 
      votesCast: 1420,
      draw: false,
      rules: { branch: 'ALL', rollRange: '1-200', laterals: true },
      candidates: ['CAND001', 'CAND002']
    },
    { 
      id: 'ELC002', 
      name: 'CSE Senate Representative Poll', 
      description: 'Departmental vote for the Computer Science & Engineering Senate representative.',
      start: '2026-06-01', 
      end: '2026-06-02 14:00', 
      type: 'Private',
      accessCode: 'VG-ACCESS-CR26',
      status: 'Running', 
      voters: 350, 
      votesCast: 290,
      draw: false,
      rules: { branch: 'CSE', rollRange: '1-64', laterals: true },
      candidates: ['CAND003', 'CAND004']
    },
    { 
      id: 'ELC003', 
      name: 'Alumni Association Board Selection', 
      description: 'Global poll for alumni board selection.',
      start: '2026-05-15', 
      end: '2026-05-17 18:00', 
      type: 'Public',
      status: 'Completed', 
      voters: 3101, 
      votesCast: 2822,
      draw: false,
      rules: { branch: 'ALL', rollRange: 'ALL', laterals: false },
      candidates: []
    },
    { 
      id: 'ELC004', 
      name: 'ECE Department Rep 2026', 
      description: 'Electronics & Communication Engineering department representative vote.',
      start: '2026-06-01', 
      end: '2026-06-02 12:00', 
      type: 'Public',
      status: 'Completed', 
      voters: 500, 
      votesCast: 240,
      draw: true, // Deadlocked poll for tie-break actions
      rules: { branch: 'ECE', rollRange: '1-100', laterals: true },
      candidates: ['CAND005', 'CAND006']
    }
  ]);

  // Candidates State (Dedicated Tab 3)
  const [candidates, setCandidates] = useState([
    { id: 'CAND001', name: 'Aarav Mehta', dept: 'CSE', rollNo: '21CS001', manifesto: 'Empowering students through open source and tech workspace transparency.', electionId: 'ELC001', votes: 820 },
    { id: 'CAND002', name: 'Priya Sharma', dept: 'CSE', rollNo: '21CS042', manifesto: 'Fostering inclusivity and cross-department innovation.', electionId: 'ELC001', votes: 600 },
    { id: 'CAND003', name: 'Vikram Aditya', dept: 'IT', rollNo: '21IT054', manifesto: 'Streamlining campus infrastructure and network capabilities.', electionId: 'ELC002', votes: 200 },
    { id: 'CAND004', name: 'Ananya Iyer', dept: 'CSE', rollNo: '21CS102', manifesto: 'Improving student wellness and direct representation platforms.', electionId: 'ELC002', votes: 90 },
    { id: 'CAND005', name: 'Rohan Verma', dept: 'ECE', rollNo: '22EC015', manifesto: 'Strengthening robotics and automation facilities.', electionId: 'ELC004', votes: 120 },
    { id: 'CAND006', name: 'Aditya Nair', dept: 'ME', rollNo: '23ME089', manifesto: 'Developing green energy projects on campus.', electionId: 'ELC004', votes: 120 }
  ]);

  // Users / Voters state with multi-ID mapping
  const [voters, setVoters] = useState([
    { roll: '21CS001', name: 'Aarav Mehta', dept: 'CSE', userCreatedId: 'aarav_mehta', systemId: 'SYS-VOT-9982', status: 'Voted', eligible: true },
    { roll: '21CS042', name: 'Priya Sharma', dept: 'CSE', userCreatedId: 'priya_s', systemId: 'SYS-VOT-1049', status: 'Token Dispatched - Not Voted', eligible: true },
    { roll: '22EC015', name: 'Rohan Verma', dept: 'ECE', userCreatedId: 'rohan_v', systemId: 'SYS-VOT-4932', status: 'Registered', eligible: true },
    { roll: '23ME089', name: 'Aditya Nair', dept: 'ME', userCreatedId: 'aditya_n', systemId: 'SYS-VOT-8821', status: 'Registered', eligible: true },
    { roll: '21CS102', name: 'Ananya Iyer', dept: 'CSE', userCreatedId: 'ananya_i', systemId: 'SYS-VOT-3042', status: 'Voted', eligible: true },
    { roll: '22EC144', name: 'Kabir Kapoor', dept: 'ECE', userCreatedId: 'kabir_k', systemId: 'SYS-VOT-1040', status: 'Registered', eligible: true },
    { roll: '23EE005', name: 'Sneha Patel', dept: 'EE', userCreatedId: 'sneha_p', systemId: 'SYS-VOT-2041', status: 'Registered', eligible: false },
    { roll: '21IT054', name: 'Vikram Singh', dept: 'IT', userCreatedId: 'vikram_s', systemId: 'SYS-VOT-4903', status: 'Voted', eligible: true },
  ]);

  // Selected Voters for Bulk Actions
  const [selectedVoters, setSelectedVoters] = useState([]);

  // Audit Logs (with severity rating and stripped raw tokens)
  const [logs, setLogs] = useState([
    { ts: '14:28:40', ev: 'CONFIG_UPDATE', usr: 'admin', desc: 'saved configuration setup', status: 'ok', level: 'INFO' },
    { ts: '14:29:01', ev: 'ELECTION_START', usr: 'admin', desc: 'activated election ELC002', status: 'ok', level: 'INFO' },
    { ts: '14:29:44', ev: 'OTP_VERIFY', usr: '21CS001', desc: 'MFA verified (email channel)', status: 'ok', level: 'INFO' },
    { ts: '14:30:12', ev: 'RATE_LIMIT', usr: '23EE005', desc: 'Repeated verification failure (lockout active)', status: 'warn', level: 'WARNING' },
    { ts: '14:31:30', ev: 'ELIGIBILITY', usr: '22EC015', desc: 'Eligibility check completed', status: 'ok', level: 'INFO' },
    { ts: '14:31:55', ev: 'OTP_VERIFY', usr: '21IT054', desc: 'MFA verified (SMS channel)', status: 'ok', level: 'INFO' },
    { ts: '14:31:58', ev: 'TOKEN_GEN', usr: '21IT054', desc: 'Token Generated = TRUE (Token value stripped for security)', status: 'ok', level: 'INFO' },
    { ts: '14:32:01', ev: 'VOTE_CAST', usr: '21IT054', desc: 'Committing secure anonymous ballot', status: 'ok', level: 'INFO' },
    { ts: '14:32:15', ev: 'BACKUP_SYNC', usr: 'system', desc: 'Database sync delay detected (14 mins)', status: 'warn', level: 'WARNING' },
    { ts: '14:33:02', ev: 'ELECTION_TIE', usr: 'system', desc: 'Tie Imbalance Identified in ELC004 (ECE)', status: 'err', level: 'CRITICAL' },
  ]);

  // Security Integrity Monitor State
  const [securityStats, setSecurityStats] = useState({
    duplicateAttempts: 0,
    invalidTokens: 3,
    rateLimitedUsers: 2,
    blockedRequests: 15
  });

  // --- PROFILE & PRODUCTIVITY WORKSPACE STATES (SECTION 1-9) ---
  const [adminBio, setAdminBio] = useState(() => {
    const saved = localStorage.getItem('vg_admin_bio');
    return saved !== null ? saved : 'Responsible for election governance, system health observation, and platform operations security within the institution. Managing audit records and whitelists.';
  });
  
  const [adminNotes, setAdminNotes] = useState(() => {
    const saved = localStorage.getItem('vg_admin_notes');
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'CR Election Eligibility Review', text: 'Remember to review CSE election eligibility list and double-check for lateral entry category entries.', pinned: true, archived: false, date: '2026-06-02 10:30' },
      { id: 2, title: 'Department Roll Overrides', text: 'Follow up with ECE department coordinator regarding missing lateral roll numbers.', pinned: false, archived: false, date: '2026-06-02 09:15' },
      { id: 3, title: 'Pre-Closure Audit Compile', text: 'Generate final cryptographic audit report before Student Council election closes at 16:00.', pinned: false, archived: false, date: '2026-06-01 15:45' }
    ];
  });

  const [adminTasks, setAdminTasks] = useState(() => {
    const saved = localStorage.getItem('vg_admin_tasks');
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'Review CSE Roll Overrides', priority: 'High', deadline: '2026-06-02', completed: false },
      { id: 2, title: 'Generate ELC003 Archive', priority: 'Medium', deadline: '2026-06-03', completed: true },
      { id: 3, title: 'Inspect ECE Deadlock Tie-break', priority: 'Critical', deadline: '2026-06-02', completed: false },
      { id: 4, title: 'Perform Backup Sync check', priority: 'Low', deadline: '2026-06-04', completed: false }
    ];
  });

  const [adminEmail, setAdminEmail] = useState(() => {
    return localStorage.getItem('vg_admin_email') || 'hariharsha@voteguard.org';
  });
  
  const [adminPhone, setAdminPhone] = useState(() => {
    return localStorage.getItem('vg_admin_phone') || '+91 98765 43210';
  });

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(false);
  const [notifPush, setNotifPush] = useState(true);

  const [adminPassCurrent, setAdminPassCurrent] = useState('');
  const [adminPassNew, setAdminPassNew] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');

  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [showArchivedNotes, setShowArchivedNotes] = useState(false);

  const [noteTitleInput, setNoteTitleInput] = useState('');
  const [noteTextInput, setNoteTextInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskPriorityInput, setTaskPriorityInput] = useState('Medium');
  const [taskDeadlineInput, setTaskDeadlineInput] = useState('2026-06-02');
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('vg_admin_bio', adminBio);
  }, [adminBio]);

  useEffect(() => {
    localStorage.setItem('vg_admin_notes', JSON.stringify(adminNotes));
  }, [adminNotes]);

  useEffect(() => {
    localStorage.setItem('vg_admin_tasks', JSON.stringify(adminTasks));
  }, [adminTasks]);

  useEffect(() => {
    localStorage.setItem('vg_admin_email', adminEmail);
  }, [adminEmail]);

  useEffect(() => {
    localStorage.setItem('vg_admin_phone', adminPhone);
  }, [adminPhone]);

  // Election templates state (CR election, Student senate, etc)
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [electionTemplates, setElectionTemplates] = useState([
    { id: 'T_CR', name: 'CR Election Template', description: 'Class Representative vote with standard 1-64 CSE roll index.', rules: { branch: 'CSE', rollRange: '1-64', laterals: true } },
    { id: 'T_DEPT', name: 'Department Representative Template', description: 'Department wide election template.', rules: { branch: 'ECE', rollRange: '1-100', laterals: true } },
    { id: 'T_CLUB', name: 'Club President Template', description: 'Presidential poll for societies.', rules: { branch: 'ALL', rollRange: 'ALL', laterals: false } },
    { id: 'T_SENATE', name: 'Student Senate Template', description: 'College-wide student senate election structure.', rules: { branch: 'ALL', rollRange: '1-200', laterals: true } }
  ]);

  // Form states for adding election
  const [newElName, setNewElName] = useState('');
  const [newElDesc, setNewElDesc] = useState('');
  const [newElStart, setNewElStart] = useState('2026-06-02');
  const [newElEnd, setNewElEnd] = useState('2026-06-04 17:00');
  const [newElType, setNewElType] = useState('Public');
  const [newElAccessCode, setNewElAccessCode] = useState('');
  const [newElBranch, setNewElBranch] = useState('ALL');
  const [newElRange, setNewElRange] = useState('1-100');
  const [newElLaterals, setNewElLaterals] = useState(true);

  // Excel Override Simulator States
  const [excelInputEligible, setExcelInputEligible] = useState('');
  const [excelInputIneligible, setExcelInputIneligible] = useState('');
  const [excelValidationLogs, setExcelValidationLogs] = useState([]);
  const [excelSuccess, setExcelSuccess] = useState(null);

  // Voter Preview Mode Modal State
  const [previewElection, setPreviewElection] = useState(null);

  // Token recovery exception states (secure resend workflow)
  const [tokenRecoveryUser, setTokenRecoveryUser] = useState(null);
  const [recoveryStatusText, setRecoveryStatusText] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryFinished, setRecoveryFinished] = useState(false);

  // Candidate Form States
  const [candName, setCandName] = useState('');
  const [candDept, setCandDept] = useState('CSE');
  const [candRoll, setCandRoll] = useState('');
  const [candManifesto, setCandManifesto] = useState('');
  const [candElectionId, setCandElectionId] = useState('ELC001');
  const [editCandId, setEditCandId] = useState(null);

  // Search results/filtered logs state
  const [displayedLogsCount, setDisplayedLogsCount] = useState(15);
  const [auditTimeFilterFrom, setAuditTimeFilterFrom] = useState('');
  const [auditTimeFilterTo, setAuditTimeFilterTo] = useState('');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState('ALL');

  // PDF download progress simulator state
  const [exportingElectionId, setExportingElectionId] = useState(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [signedPdfData, setSignedPdfData] = useState(null);

  // Results Inspection state
  const [inspectedElection, setInspectedElection] = useState(null);

  // Security Lockout / Progressive Throttling Cockpit Simulator
  const [simulatedIp, setSimulatedIp] = useState('192.168.1.144');
  const [simulatedFailures, setSimulatedFailures] = useState(0);
  const [simulatedCooldown, setSimulatedCooldown] = useState(0);
  const [simulatedStatus, setSimulatedStatus] = useState('Clean (Zero Delay)');

  const logEndRef = useRef(null);

  // Cooldown timer simulator for security cockpit
  useEffect(() => {
    if (simulatedCooldown > 0) {
      const lockInterval = setInterval(() => {
        setSimulatedCooldown(prev => {
          if (prev <= 1) {
            clearInterval(lockInterval);
            setSimulatedStatus('Unlocked (Rate Limiting reset)');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(lockInterval);
    }
  }, [simulatedCooldown]);

  // Live Audit Log Stream Effect
  useEffect(() => {
    const events = ['VOTE_CAST', 'TOKEN_GEN', 'OTP_VERIFY', 'ELIGIBILITY', 'RATE_LIMIT', 'LOGIN_ATTEMPT'];
    const users = ['21CS001', '21CS102', '21IT054', '22EC144', '23ME089', 'admin'];
    const descriptions = [
      'Token Generated = TRUE (Token value stripped for security)',
      'MFA verified (email channel)',
      'Eligibility check approved',
      'Voter validation success',
      'Repeated verification failure (lockout active)',
      'Unauthorized access attempt blocked'
    ];

    const interval = setInterval(() => {
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
      
      let status = 'ok';
      let level = 'INFO';
      if (randomEvent === 'RATE_LIMIT' || randomDesc.includes('failure')) {
        status = 'warn';
        level = 'WARNING';
      }
      if (randomDesc.includes('blocked') || randomDesc.includes('Unauthorized')) {
        status = 'err';
        level = 'CRITICAL';
      }

      const newLog = {
        ts: new Date().toLocaleTimeString(),
        ev: randomEvent,
        usr: randomUser,
        desc: randomDesc,
        status: status,
        level: level
      };

      setLogs((prevLogs) => {
        return [newLog, ...prevLogs].slice(0, 100); // Add at top, keep last 100
      });

      // Periodically update Integrity counts dynamically
      if (level === 'WARNING') {
        setSecurityStats(prev => ({
          ...prev,
          invalidTokens: prev.invalidTokens + 1,
          rateLimitedUsers: prev.rateLimitedUsers + 1
        }));
      } else if (level === 'CRITICAL') {
        setSecurityStats(prev => ({
          ...prev,
          blockedRequests: prev.blockedRequests + 1
        }));
      }
    }, 9000);

    return () => clearInterval(interval);
  }, []);

  const addAuditLog = (ev, usr, desc, level = 'INFO', status = 'ok') => {
    const newLog = {
      ts: new Date().toLocaleTimeString(),
      ev,
      usr,
      desc,
      status,
      level
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Election actions
  const toggleElectionStatus = (id) => {
    setElections(prev =>
      prev.map(el => {
        if (el.id === id) {
          const nextStatus = el.status === 'Running' ? 'Paused' : 'Running';
          addAuditLog('ELECTION_STATE', 'admin', `Updated ${el.name} status to ${nextStatus}`, 'INFO', 'ok');
          return { ...el, status: nextStatus };
        }
        return el;
      })
    );
  };

  const handleEmergencyLock = (id) => {
    setElections(prev =>
      prev.map(el => {
        if (el.id === id) {
          addAuditLog('EMERGENCY_LOCK', 'admin', `EMERGENCY LOCK ACTIVATED ON ${el.name} - HALTING VOTES`, 'CRITICAL', 'err');
          setNotifications(prevNotif => [
            { id: Date.now(), type: 'critical', text: `EMERGENCY LOCK applied on ${el.name}`, ts: 'Just now', read: false },
            ...prevNotif
          ]);
          return { ...el, status: 'Emergency_Locked' };
        }
        return el;
      })
    );
    setSecurityStats(prev => ({ ...prev, blockedRequests: prev.blockedRequests + 5 }));
  };

  const stopElection = (id) => {
    if (window.confirm('Are you sure you want to stop this election permanently? This action is immutable.')) {
      setElections(prev =>
        prev.map(el => {
          if (el.id === id) {
            addAuditLog('ELECTION_STOP', 'admin', `Archived & Stopped ${el.name} permanently`, 'INFO', 'ok');
            return { ...el, status: 'Completed' };
          }
          return el;
        })
      );
    }
  };

  const handleArchiveElection = (id) => {
    setElections(prev =>
      prev.map(el => {
        if (el.id === id) {
          addAuditLog('ELECTION_ARCHIVE', 'admin', `Archived ${el.name} successfully`, 'INFO', 'ok');
          return { ...el, status: 'Archived' };
        }
        return el;
      })
    );
  };

  // Template loaders
  const handleLoadTemplate = (id) => {
    const t = electionTemplates.find(x => x.id === id);
    if (!t) return;
    setNewElName(t.name);
    setNewElDesc(t.description);
    setNewElBranch(t.rules.branch);
    setNewElRange(t.rules.rollRange);
    setNewElLaterals(t.rules.laterals);
    setSelectedTemplate(id);
    alert(`Loaded election settings template: ${t.name}`);
  };

  const handleSaveAsTemplate = () => {
    if (!newElName) {
      alert('Configure election parameters first before saving as template.');
      return;
    }
    const tId = `T_CUST_${Date.now()}`;
    const newTemplate = {
      id: tId,
      name: `${newElName} Template`,
      description: `Custom template saved from active configuration.`,
      rules: { branch: newElBranch, rollRange: newElRange, laterals: newElLaterals }
    };
    setElectionTemplates(prev => [...prev, newTemplate]);
    addAuditLog('TEMPLATE_SAVE', 'admin', `Saved ${newElName} as a loadable template`, 'INFO', 'ok');
    alert(`Successfully saved active configuration as: ${newElName} Template`);
  };

  // Handle New Election Creation
  const handleCreateElection = (e) => {
    e.preventDefault();
    if (!newElName.trim()) {
      alert('Election Name is required.');
      return;
    }
    const newId = `ELC${String(elections.length + 1).padStart(3, '0')}`;
    const newElection = {
      id: newId,
      name: newElName,
      description: newElDesc,
      start: newElStart,
      end: newElEnd,
      type: newElType,
      accessCode: newElType === 'Private' ? (newElAccessCode || 'VG-ACCESS-CODE') : '',
      status: 'Configured',
      voters: 100,
      votesCast: 0,
      draw: false,
      rules: { branch: newElBranch, rollRange: newElRange, laterals: newElLaterals },
      candidates: []
    };
    setElections(prev => [...prev, newElection]);
    addAuditLog('ELECTION_CREATE', 'admin', `Created election ${newElName} (${newId})`, 'INFO', 'ok');
    alert(`New election "${newElName}" successfully created and configured!`);
    
    setNewElName('');
    setNewElDesc('');
    setNewElAccessCode('');
    setSelectedTemplate('');
  };

  // Candidate setup
  const handleCandidateSubmit = (e) => {
    e.preventDefault();
    if (!candName.trim() || !candRoll.trim()) {
      alert('Please fill out Candidate Name and Student Roll Number.');
      return;
    }

    if (editCandId) {
      setCandidates(prev => prev.map(c => {
        if (c.id === editCandId) {
          addAuditLog('CANDIDATE_EDIT', 'admin', `Modified candidate details: ${candName}`, 'INFO', 'ok');
          return { ...c, name: candName, dept: candDept, rollNo: candRoll, manifesto: candManifesto, electionId: candElectionId };
        }
        return c;
      }));
      setEditCandId(null);
    } else {
      const newCandId = `CAND${String(candidates.length + 1).padStart(3, '0')}`;
      const newCandidate = {
        id: newCandId,
        name: candName,
        dept: candDept,
        rollNo: candRoll,
        manifesto: candManifesto,
        electionId: candElectionId,
        votes: 0
      };
      setCandidates(prev => [...prev, newCandidate]);
      setElections(prev => prev.map(el => {
        if (el.id === candElectionId) {
          return { ...el, candidates: [...el.candidates, newCandId] };
        }
        return el;
      }));
      addAuditLog('CANDIDATE_CREATE', 'admin', `Assigned new candidate ${candName} to election ${candElectionId}`, 'INFO', 'ok');
    }

    setCandName('');
    setCandRoll('');
    setCandManifesto('');
  };

  const handleEditCandidateClick = (c) => {
    setEditCandId(c.id);
    setCandName(c.name);
    setCandDept(c.dept);
    setCandRoll(c.rollNo);
    setCandManifesto(c.manifesto);
    setCandElectionId(c.electionId);
  };

  const handleDeleteCandidate = (id, electionId) => {
    if (window.confirm('Delete this candidate profile?')) {
      setCandidates(prev => prev.filter(c => c.id !== id));
      setElections(prev => prev.map(el => {
        if (el.id === electionId) {
          return { ...el, candidates: el.candidates.filter(x => x !== id) };
        }
        return el;
      }));
      addAuditLog('CANDIDATE_DELETE', 'admin', `Removed candidate profile ${id}`, 'INFO', 'ok');
    }
  };

  // Excel validation parser simulator
  const handleExcelValidation = () => {
    if (!excelInputEligible.trim() && !excelInputIneligible.trim()) {
      alert('Please enter roll numbers to check.');
      return;
    }
    const eligibleList = excelInputEligible.split(',').map(x => x.trim()).filter(Boolean);
    const ineligibleList = excelInputIneligible.split(',').map(x => x.trim()).filter(Boolean);
    
    setExcelValidationLogs(['[14:26:01] Initializing Structural Excel Parser Validation Engine...', '[14:26:02] Reading input columns...']);
    setExcelSuccess('checking');

    setTimeout(() => {
      let logsBuffer = [
        `[14:26:02] Column A parsed successfully: ${eligibleList.length} roll entries detected.`,
        `[14:26:02] Column B parsed successfully: ${ineligibleList.length} roll entries detected.`
      ];

      const duplicates = eligibleList.filter(x => ineligibleList.includes(x));
      let overlapDetected = false;
      if (duplicates.length > 0) {
        overlapDetected = true;
        logsBuffer.push(`[14:26:03] ✕ CRITICAL DUPLICATION DETECTED: Roll number(s) [${duplicates.join(', ')}] found in BOTH eligible and ineligible columns.`);
      }

      const rollRegex = /^[0-9]{2}[A-Z]{2}[0-9]{3}$/; 
      const malformed = [...eligibleList, ...ineligibleList].filter(x => !rollRegex.test(x));
      if (malformed.length > 0) {
        logsBuffer.push(`[14:26:03] ✕ MALFORMED IDENTIFIER WARNING: Row entries [${malformed.join(', ')}] do not conform to regex formatting [YYDEPTNNN].`);
      }

      if (overlapDetected) {
        logsBuffer.push(`[14:26:04] Ingestion aborted. Clean up file conflicts.`);
        setExcelValidationLogs(logsBuffer);
        setExcelSuccess(false);
        addAuditLog('EXCEL_INGEST', 'admin', 'Ingestion failed: Duplicate entries in spreadsheet', 'WARNING', 'warn');
      } else {
        logsBuffer.push(`[14:26:04] ✓ Success: Spreadsheet structure verified. 0 duplicates found.`);
        logsBuffer.push(`[14:26:04] Ineligible blacklist locks applied to ${ineligibleList.length} users.`);
        logsBuffer.push(`[14:26:04] Whitelist overrides injected for ${eligibleList.length} users.`);
        setExcelValidationLogs(logsBuffer);
        setExcelSuccess(true);
        addAuditLog('EXCEL_INGEST', 'admin', `Ingested eligibility spreadsheets overrides (${eligibleList.length} whitelist, ${ineligibleList.length} blacklist)`, 'INFO', 'ok');

        setVoters(prev => prev.map(v => {
          if (eligibleList.includes(v.roll)) return { ...v, eligible: true };
          if (ineligibleList.includes(v.roll)) return { ...v, eligible: false };
          return v;
        }));
      }
    }, 1500);
  };

  // Secure Invalidate & Resend token flow
  const triggerResendToken = (v) => {
    setTokenRecoveryUser(v);
    setIsRecovering(true);
    setRecoveryFinished(false);
    setRecoveryStatusText('Initializing connection to secure security keystore...');

    setTimeout(() => setRecoveryStatusText('Invalidating old token key reference in ledger...'), 800);
    setTimeout(() => setRecoveryStatusText('Writing Admin Token Invalidation Log (Token value hidden for privacy)...'), 1500);
    setTimeout(() => setRecoveryStatusText('Generating new secure token key vector (ECDSA)...'), 2200);
    setTimeout(() => setRecoveryStatusText('Dispatching secure token directly to voter\'s registered device...'), 3000);
    setTimeout(() => {
      setIsRecovering(false);
      setRecoveryFinished(true);
      addAuditLog('TOKEN_RECOVERY', 'admin', `Invalidated & securely resent token to user ${v.roll} (Privacy protected: cleartext token suppressed)`, 'INFO', 'ok');
      
      setSecurityStats(prev => ({ ...prev, duplicateAttempts: prev.duplicateAttempts + 1 }));
    }, 3800);
  };

  // Tie-Breaking Draw Actions
  const handleDeclareJointWinners = (electionId) => {
    setElections(prev => prev.map(el => {
      if (el.id === electionId) {
        addAuditLog('TIE_BREAK', 'admin', `Joint Winners declared for ECE Representative election (ELC004)`, 'INFO', 'ok');
        return { ...el, status: 'Completed', draw: false, jointWinner: true };
      }
      return el;
    }));
    setInspectedElection(null);
    alert('Executive override: Declared Joint Winners. Combined victory configuration exported to records.');
  };

  const handleReopenElection = (electionId) => {
    setElections(prev => prev.map(el => {
      if (el.id === electionId) {
        addAuditLog('TIE_BREAK', 'admin', `Re-opened election ELC004. Resetted counters, flushed previous tokens and initialized fresh window.`, 'WARNING', 'warn');
        return { ...el, status: 'Running', draw: false, votesCast: 0, jointWinner: false };
      }
      return el;
    }));
    setCandidates(prev => prev.map(c => {
      if (c.electionId === electionId) return { ...c, votes: 0 };
      return c;
    }));
    setInspectedElection(null);
    alert('Executive override: Target election re-opened. Vote counts reset, previous tokens flushed, and secondary voting window initialized.');
  };

  // --- WORKSPACE DIARY LOGIC (SECTION 4) ---
  const handleAddOrEditNote = (e) => {
    e.preventDefault();
    if (!noteTitleInput.trim()) {
      alert('Note Title is required.');
      return;
    }

    if (editingNoteId) {
      setAdminNotes(prev => prev.map(n => {
        if (n.id === editingNoteId) {
          return { ...n, title: noteTitleInput, text: noteTextInput };
        }
        return n;
      }));
      addAuditLog('NOTE_EDIT', 'admin', `Edited admin note: ${noteTitleInput}`);
      setEditingNoteId(null);
    } else {
      const newNote = {
        id: Date.now(),
        title: noteTitleInput,
        text: noteTextInput,
        pinned: false,
        archived: false,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };
      setAdminNotes(prev => [newNote, ...prev]);
      addAuditLog('NOTE_CREATE', 'admin', `Created admin note: ${noteTitleInput}`);
    }

    setNoteTitleInput('');
    setNoteTextInput('');
    setShowNoteModal(false);
  };

  const handleTogglePinNote = (id) => {
    setAdminNotes(prev => prev.map(n => {
      if (n.id === id) {
        const nextPin = !n.pinned;
        addAuditLog('NOTE_PIN', 'admin', `${nextPin ? 'Pinned' : 'Unpinned'} admin note: ${n.title}`);
        return { ...n, pinned: nextPin };
      }
      return n;
    }));
  };

  const handleToggleArchiveNote = (id) => {
    setAdminNotes(prev => prev.map(n => {
      if (n.id === id) {
        const nextArchive = !n.archived;
        addAuditLog('NOTE_ARCHIVE', 'admin', `${nextArchive ? 'Archived' : 'Restored'} admin note: ${n.title}`);
        return { ...n, archived: nextArchive };
      }
      return n;
    }));
  };

  const handleDeleteAdminNote = (id) => {
    const noteToDelete = adminNotes.find(n => n.id === id);
    if (window.confirm(`Delete note "${noteToDelete?.title}" permanently?`)) {
      setAdminNotes(prev => prev.filter(n => n.id !== id));
      addAuditLog('NOTE_DELETE', 'admin', `Deleted admin note: ${noteToDelete?.title}`);
    }
  };

  // --- WORKSPACE TASK LOGIC (SECTION 5) ---
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!taskTitleInput.trim()) {
      alert('Task Title is required.');
      return;
    }

    const newTask = {
      id: Date.now(),
      title: taskTitleInput,
      priority: taskPriorityInput,
      deadline: taskDeadlineInput,
      completed: false
    };

    setAdminTasks(prev => [...prev, newTask]);
    addAuditLog('TASK_CREATE', 'admin', `Created task: ${taskTitleInput}`);
    
    setTaskTitleInput('');
    setTaskPriorityInput('Medium');
    setShowTaskForm(false);
  };

  const handleToggleTaskCompleted = (id) => {
    setAdminTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        addAuditLog('TASK_UPDATE', 'admin', `${nextCompleted ? 'Completed' : 'Re-opened'} task: ${t.title}`);
        return { ...t, completed: nextCompleted };
      }
      return t;
    }));
  };

  const handleDeleteTask = (id) => {
    const taskToDelete = adminTasks.find(t => t.id === id);
    setAdminTasks(prev => prev.filter(t => t.id !== id));
    addAuditLog('TASK_DELETE', 'admin', `Deleted task: ${taskToDelete?.title}`);
  };

  // --- WORKSPACE PASSWORD SETTINGS (SECTION 8) ---
  const handleUpdatePassword = (e) => {
    e.preventDefault();
    if (!adminPassCurrent || !adminPassNew || !adminPassConfirm) {
      alert('Please fill out all password fields.');
      return;
    }
    if (adminPassNew !== adminPassConfirm) {
      alert('New passwords do not match.');
      return;
    }
    addAuditLog('PASSWORD_CHANGE', 'admin', 'Super Admin password successfully updated', 'INFO', 'ok');
    alert('Security Settings: Password updated successfully (Simulated).');
    setAdminPassCurrent('');
    setAdminPassNew('');
    setAdminPassConfirm('');
  };

  // Bulk User Actions
  const handleBulkAction = (action) => {
    if (selectedVoters.length === 0) {
      alert('Select at least one voter first.');
      return;
    }

    setVoters(prev => prev.map(v => {
      if (selectedVoters.includes(v.roll)) {
        if (action === 'approve') return { ...v, eligible: true };
        if (action === 'restrict') return { ...v, eligible: false };
        if (action === 'reset') return { ...v, status: 'Registered' };
      }
      return v;
    }));

    addAuditLog('BULK_ACTION', 'admin', `Performed bulk override action [${action}] on ${selectedVoters.length} records`, 'INFO', 'ok');
    alert(`Applied action "${action}" to ${selectedVoters.length} users successfully.`);
    setSelectedVoters([]);
  };

  const toggleSelectVoter = (roll) => {
    setSelectedVoters(prev => 
      prev.includes(roll) ? prev.filter(r => r !== roll) : [...prev, roll]
    );
  };

  const handleSelectAllVoters = () => {
    if (selectedVoters.length === voters.length) {
      setSelectedVoters([]);
    } else {
      setSelectedVoters(voters.map(v => v.roll));
    }
  };

  // Trigger manual security lockout test in cockpit
  const handleTriggerSimulatedLockout = () => {
    const nextAttempts = simulatedFailures + 1;
    setSimulatedFailures(nextAttempts);

    if (nextAttempts >= 5) {
      const cooldownSecs = 30 + (nextAttempts - 5) * 30;
      setSimulatedCooldown(cooldownSecs);
      setSimulatedStatus(`Locked (Cooldown Active: ${cooldownSecs}s)`);
      addAuditLog('RATE_LIMIT_TEST', 'admin', `Progressive Lockout triggered for IP ${simulatedIp} - locked for ${cooldownSecs}s`, 'WARNING', 'warn');
    } else {
      setSimulatedStatus(`Throttle count: ${nextAttempts}/5 attempts`);
    }
  };

  // PDF report compiler simulation
  const handleExportPdfReport = (elId) => {
    setExportingElectionId(elId);
    setExportProgress(0);
    setSignedPdfData(null);

    const el = elections.find(x => x.id === elId);
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setSignedPdfData({
            title: el.name,
            id: el.id,
            date: new Date().toLocaleString(),
            reportId: `VG-RPT-${el.id}-${Math.floor(Math.random() * 9000 + 1000)}`,
            votes: el.votesCast,
            voters: el.voters,
            type: el.type,
            signature: 'SUPER_ADMIN_CRYPT_SIGNED'
          });
          addAuditLog('REPORT_COMPILE', 'admin', `Compiled cryptographically signed PDF report for ${el.name} (${el.id})`, 'INFO', 'ok');
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Global search filtering logic
  const handleGlobalSearchChange = (e) => {
    const val = e.target.value;
    setGlobalSearch(val);
  };

  // Filtered lists for rendering based on search and other inputs
  const filteredElections = elections.filter(el => {
    const query = globalSearch.toLowerCase();
    return el.name.toLowerCase().includes(query) || el.id.toLowerCase().includes(query);
  });

  const filteredCandidates = candidates.filter(c => {
    const query = globalSearch.toLowerCase();
    return c.name.toLowerCase().includes(query) || c.rollNo.toLowerCase().includes(query) || c.dept.toLowerCase().includes(query);
  });

  const filteredVoters = voters.filter(v => {
    const query = globalSearch.toLowerCase();
    return v.name.toLowerCase().includes(query) || v.roll.toLowerCase().includes(query) || v.dept.toLowerCase().includes(query) || v.userCreatedId.toLowerCase().includes(query);
  });

  const filteredLogs = logs.filter(log => {
    const query = globalSearch.toLowerCase();
    const matchesSearch = log.ev.toLowerCase().includes(query) || log.usr.toLowerCase().includes(query) || log.desc.toLowerCase().includes(query);
    const matchesSeverity = auditSeverityFilter === 'ALL' || log.level === auditSeverityFilter;
    return matchesSearch && matchesSeverity;
  }).slice(0, displayedLogsCount);

  // Filter admin notes
  const filteredAdminNotes = adminNotes.filter(n => {
    const query = noteSearchQuery.toLowerCase();
    const matchesSearch = n.title.toLowerCase().includes(query) || n.text.toLowerCase().includes(query);
    const matchesArchived = n.archived === showArchivedNotes;
    return matchesSearch && matchesArchived;
  });

  const pinnedNotes = filteredAdminNotes.filter(n => n.pinned);
  const unpinnedNotes = filteredAdminNotes.filter(n => !n.pinned);

  return (
    <div className="dashboard-page">

      {/* SIDEBAR NAVIGATION */}
      <div className="dashboard-sidebar">
        <div>
          <div className="sidebar-brand">
            <LogoMark size={14} />
            <span className="sidebar-logo">VoteGuard</span>
          </div>

          <div className="sidebar-nav">
            {[
              { id: 'Dashboard', lbl: 'Dashboard', icon: <IconChartBar size={18} /> },
              { id: 'Elections', lbl: 'Election Management', icon: <IconBox size={18} /> },
              { id: 'Candidates', lbl: 'Candidate Setup', icon: <IconUsers size={18} /> },
              { id: 'Users', lbl: 'User Management', icon: <IconUsers size={18} /> },
              { id: 'Results', lbl: 'Results Analytics', icon: <IconTrophy size={18} /> },
              { id: 'Reports', lbl: 'Reports & Audits', icon: <IconFolder size={18} /> },
              { id: 'System', lbl: 'System Health', icon: <IconPlug size={18} /> },
              { id: 'Alerts', lbl: 'Alerts Terminal', icon: <IconAlertCircle size={18} /> },
              { id: 'Profile', lbl: 'Profile & Notes', icon: <IconUser size={18} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                }}
              >
                <div className="sidebar-nav-dot"></div>
                <span style={{ marginRight: '8px' }}>{tab.icon}</span>
                {tab.lbl}
              </button>
            ))}
          </div>
        </div>

        {/* BOTTOM ACTIVE ELECTIONS PANEL */}
        <div className="sidebar-active-panel">
          <div className="active-panel-title"><IconBolt size={20} /> Live Elections</div>
          {elections.filter(e => e.status === 'Running').length === 0 ? (
            <div className="active-panel-empty">No Active Elections</div>
          ) : (
            elections.filter(e => e.status === 'Running').map(el => (
              <div key={el.id} className="active-panel-card">
                <span className="active-el-name">{el.name}</span>
                <span className="active-el-time">Ends: {el.end.split(' ')[1] || '04:00 PM'}</span>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div className="admin-badge">
            <div className="admin-avatar">AD</div>
            <div className="admin-info">
              <span className="admin-name">VGADM001</span>
              <span className="admin-role">Super Administrator</span>
            </div>
          </div>
          <button className="btn-logout" onClick={() => navigate('/portal')}>Terminate Session</button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="dashboard-main">
        {/* HEADER BAR */}
        <div className="dashboard-header">
          <div className="dashboard-title-area">
            <h1 className="dashboard-title">{activeTab === 'Dashboard' ? 'Administrator Cockpit' : activeTab}</h1>
            <span className="dashboard-subtitle">VoteGuard Secure Election Governance Cockpit</span>
          </div>

          <div className="dashboard-meta">
            {/* Global Search everywhere */}
            <div className="global-search-container">
              <input 
                type="text" 
                placeholder="Search everywhere..."
                value={globalSearch}
                onChange={handleGlobalSearchChange}
                className="global-search-input"
              />
              {globalSearch && (
                <button className="clear-search-btn" onClick={() => setGlobalSearch('')}>✕</button>
              )}
            </div>

            {/* Notification Bell Dropdown */}
            <div className="notification-bell-wrapper">
              <button 
                className={`notification-bell-btn ${notifications.some(n => !n.read) ? 'unread' : ''}`}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <IconBell size={24} />
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notif-header">
                    <span>Platform Alerts</span>
                    <button className="mark-all-read" onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}>Mark all read</button>
                  </div>
                  <div className="notif-list">
                    {notifications.map(n => (
                      <div key={n.id} className={`notif-item ${n.read ? 'read' : ''} ${n.type}`}>
                        <div className="notif-dot"></div>
                        <div className="notif-body">
                          <p className="notif-text">{n.text}</p>
                          <span className="notif-time">{n.ts}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ThemeToggle />
            <div className="system-time">GMT/UTC {time}</div>
          </div>
        </div>

        {/* CORE DASHBOARD TAB VIEW */}
        {activeTab === 'Dashboard' && (
          <div className="dashboard-body animate-fade-in">
            
            {/* STAT CARDS */}
            <div className="dash-stats-grid">
              <SpotlightCard className="dash-stat-card-spotlight" spotlightColor="rgba(212, 168, 67, 0.12)">
                <div className="dash-stat-card">
                  <span className="dash-stat-label">Total Elections</span>
                  <span className="dash-stat-value">
                    <CountUpNumber to={elections.length} />
                  </span>
                  <span className="dash-stat-sub neutral">Operational life-cycles</span>
                </div>
              </SpotlightCard>
              <SpotlightCard className="dash-stat-card-spotlight" spotlightColor="rgba(74, 157, 143, 0.15)">
                <div className="dash-stat-card">
                  <span className="dash-stat-label">Running Polls</span>
                  <span className="dash-stat-value">
                    <CountUpNumber to={elections.filter(e => e.status === 'Running').length} />
                  </span>
                  <span className="dash-stat-sub positive">Live turnout tracking active</span>
                </div>
              </SpotlightCard>
              <SpotlightCard className="dash-stat-card-spotlight" spotlightColor="rgba(212, 168, 67, 0.12)">
                <div className="dash-stat-card">
                  <span className="dash-stat-label">Completed / Archived</span>
                  <span className="dash-stat-value">
                    <CountUpNumber to={elections.filter(e => e.status === 'Completed' || e.status === 'Archived').length} />
                  </span>
                  <span className="dash-stat-sub neutral">Audit traces stored</span>
                </div>
              </SpotlightCard>
            </div>

            {/* INTEGRITY MONITOR & PROGRESS HEATMAP ROW */}
            <div className="dash-analytics-row">
              {/* Integrity Monitor */}
              <SpotlightCard className="dash-chart-card-spotlight" spotlightColor="rgba(74, 157, 143, 0.12)">
                <div className="dash-chart-card">
                  <div className="dash-chart-header">
                    <span className="dash-chart-title"><IconShield size={18} /> Election Integrity Monitor</span>
                    <div className="terminal-status">
                      <div className="terminal-status-dot"></div>
                      <span>Active Security Throttling</span>
                    </div>
                  </div>
                  
                  <div className="integrity-grid">
                    <div className="integrity-tile">
                      <span className="int-lbl">Duplicate Attempts</span>
                      <span className="int-val color-green">
                        <CountUpNumber to={securityStats.duplicateAttempts} />
                      </span>
                      <span className="int-sub">Rejected entries</span>
                    </div>
                    <div className="integrity-tile">
                      <span className="int-lbl">Invalid Tokens Entry</span>
                      <span className="int-val color-gold">
                        <CountUpNumber to={securityStats.invalidTokens} />
                      </span>
                      <span className="int-sub">Token checks failed</span>
                    </div>
                    <div className="integrity-tile">
                      <span className="int-lbl">Rate-Limited Users</span>
                      <span className="int-val color-gold">
                        <CountUpNumber to={securityStats.rateLimitedUsers} />
                      </span>
                      <span className="int-sub">Lockout cooldown triggered</span>
                    </div>
                    <div className="integrity-tile">
                      <span className="int-lbl">Blocked Requests</span>
                      <span className="int-val color-red">
                        <CountUpNumber to={securityStats.blockedRequests} />
                      </span>
                      <span className="int-sub">DoS defense triggered</span>
                    </div>
                  </div>

                  <div className="security-status-msg">
                    <strong>Diagnostic Status:</strong> Firewall active. Ineligible whitelists verified.
                  </div>
                </div>
              </SpotlightCard>

              {/* Heatmap participation */}
              <SpotlightCard className="dash-chart-card-spotlight" spotlightColor="rgba(212, 168, 67, 0.12)">
                <div className="dash-chart-card">
                  <div className="dash-chart-header">
                    <span className="dash-chart-title"><IconTrendingUp size={18} /> Turnout Participation Heatmap</span>
                    <span className="heatmap-info">Busiest voting hours (Total: 1,950 votes)</span>
                  </div>

                  <div className="heatmap-bars">
                    {[
                      { hr: '09:00', v: 45 },
                      { hr: '10:00', v: 92 },
                      { hr: '11:00', v: 120 },
                      { hr: '12:00', v: 60 },
                      { hr: '13:00', v: 30 },
                      { hr: '14:00', v: 75 },
                      { hr: '15:00', v: 110 },
                      { hr: '16:00', v: 20 },
                    ].map((x, i) => (
                      <div key={i} className="heatmap-col">
                        <div className="heatmap-bar-fill" style={{ height: `${(x.v/120)*100}%` }}>
                          <span className="tooltip-val">{x.v}v</span>
                        </div>
                        <span className="heatmap-lbl">{x.hr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </div>

            {/* REAL-TIME TERMINAL AUDIT ROW */}
            <div className="dash-analytics-row" style={{ gridTemplateColumns: '1fr' }}>
              <SpotlightCard className="dash-terminal-card-spotlight" spotlightColor="rgba(255, 255, 255, 0.05)">
                <div className="dash-terminal-card">
                  <div className="dash-terminal-header">
                    <span className="dash-terminal-title">REAL-TIME AUDIT STREAM (Severity Categorized)</span>
                    <div className="terminal-status">
                      <span style={{ fontSize: '11px', color: 'var(--text2)', marginRight: '10px' }}>Showing recent active logs</span>
                      <div className="terminal-status-dot"></div>
                      <span>Active Observability</span>
                    </div>
                  </div>

                  <div className="dash-terminal-log" style={{ height: '220px' }}>
                    {filteredLogs.map((log, index) => (
                      <div key={index} className={`log-row-level ${log.level.toLowerCase()}`}>
                        <span className="ts">[{log.ts}]</span>
                        <span className={`log-severity-badge ${log.level.toLowerCase()}`}>{log.level}</span>
                        <span className="ev">{log.ev}</span>
                        <span className="user">{log.usr}</span> · {log.desc}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </SpotlightCard>
            </div>

            {/* QUICK PROFILE OVERVIEW */}
            <div className="dash-system-row">
              <SpotlightCard className="dash-control-card-spotlight" spotlightColor="rgba(212, 168, 67, 0.12)">
                <div className="dash-control-card">
                  <span className="dash-control-title">Active Operator Profile</span>
                  <div className="admin-profile-cockpit">
                    <div className="admin-avatar-lg">HH</div>
                    <div className="admin-profile-details">
                      <h3>Hari Harsha (Super Admin)</h3>
                      <p>Operator Code: <strong>@harsha_admin</strong></p>
                      <p>Assigned Role: <span className="badge-role gold">SUPER_ADMIN</span></p>
                      <p className="last-login">Last authenticated: Today at 14:12 (OTP Verified via Email)</p>
                    </div>
                  </div>
                </div>
              </SpotlightCard>

              <SpotlightCard className="dash-system-card-spotlight" spotlightColor="rgba(74, 157, 143, 0.15)">
                <div className="dash-system-card">
                  <span className="dash-control-title">Infrastructure Health Observability</span>
                  <div className="system-status-grid">
                    <div className="system-status-row">
                      <span className="sys-label">Application Platform Layer</span>
                      <span className="sys-value-badge healthy">✓ Online (12ms)</span>
                    </div>
                    <div className="system-status-row">
                      <span className="sys-label">Cryptographic Ballot Database</span>
                      <span className="sys-value-badge healthy">✓ Optimal (Pool: 48/50)</span>
                    </div>
                    <div className="system-status-row">
                      <span className="sys-label">Live Audit Trace Logger</span>
                      <span className="sys-value-badge healthy">✓ Streaming</span>
                    </div>
                    <div className="system-status-row">
                      <span className="sys-label">Two-Factor OTP Relay Service</span>
                      <span className="sys-value-badge degraded"><IconAlertTriangle size={16} /> High Latency</span>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </div>

          </div>
        )}

        {/* ELECTIONS VIEW */}
        {activeTab === 'Elections' && (
          <div className="dashboard-body animate-fade-in">
            <div className="elections-view-container">
              
              {/* Election Configuration Form */}
              <div className="users-table-card">
                <h2 className="tab-section-title">Configure &amp; Initialize New Election</h2>
                
                {/* Template loader subsystem */}
                <div className="template-selector-sub">
                  <label className="field-title">Load Configuration Template:</label>
                  <select 
                    value={selectedTemplate} 
                    onChange={(e) => handleLoadTemplate(e.target.value)}
                    className="template-select-box"
                  >
                    <option value="">-- Choose Template to Auto-Fill --</option>
                    {electionTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button className="btn-action-sm" onClick={handleSaveAsTemplate}>
                    <IconDeviceFloppy size={18} /> Save Active Config as Template
                  </button>
                </div>

                <form onSubmit={handleCreateElection} className="create-election-form">
                  <div className="form-row-grid">
                    <div className="field">
                      <label>Election Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Student Council CR Poll"
                        value={newElName}
                        onChange={(e) => setNewElName(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Access Type</label>
                      <select value={newElType} onChange={(e) => setNewElType(e.target.value)}>
                        <option value="Public">Public (Visible to all eligible)</option>
                        <option value="Private">Private (Requires Access Code)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row-grid">
                    <div className="field">
                      <label>Manifesto/Description</label>
                      <textarea 
                        rows={2}
                        placeholder="Brief summary of the election purpose..."
                        value={newElDesc}
                        onChange={(e) => setNewElDesc(e.target.value)}
                      />
                    </div>
                    {newElType === 'Private' && (
                      <div className="field">
                        <label>Access Code</label>
                        <input 
                          type="text" 
                          placeholder="e.g. VG-ACCESS-CODE"
                          value={newElAccessCode}
                          onChange={(e) => setNewElAccessCode(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-row-grid-3">
                    <div className="field">
                      <label>Eligible Branch</label>
                      <input type="text" value={newElBranch} onChange={(e) => setNewElBranch(e.target.value)} placeholder="e.g. CSE, ECE, ALL" />
                    </div>
                    <div className="field">
                      <label>Roll Range Limits</label>
                      <input type="text" value={newElRange} onChange={(e) => setNewElRange(e.target.value)} placeholder="e.g. 1-64" />
                    </div>
                    <div className="field checkbox-field">
                      <label className="checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={newElLaterals} 
                          onChange={(e) => setNewElLaterals(e.target.checked)} 
                        />
                        Include Lateral Entry Categories
                      </label>
                    </div>
                  </div>

                  <div className="form-row-grid">
                    <div className="field">
                      <label>Starts Date</label>
                      <input type="date" value={newElStart} onChange={(e) => setNewElStart(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Ends Timestamp Limit</label>
                      <input type="text" value={newElEnd} onChange={(e) => setNewElEnd(e.target.value)} placeholder="YYYY-MM-DD HH:MM" />
                    </div>
                  </div>

                  <button type="submit" className="btn-create-election">Initialize Election Registry</button>
                </form>
              </div>

              {/* Excel Eligibility Overrides Ingestion */}
              <div className="users-table-card">
                <h2 className="tab-section-title">Ingest Eligibility Overrides Pipeline (Excel Simulator)</h2>
                <p className="section-desc">Format: comma separated student roll numbers (e.g. 21CS042, 22EC144).</p>
                
                <div className="excel-uploader-grid">
                  <div className="field">
                    <label>Column A: Eligible Whitelist (Inclusions)</label>
                    <textarea 
                      rows={3} 
                      placeholder="Roll numbers to force-approve (e.g. 23ME089, 21CS001)"
                      value={excelInputEligible}
                      onChange={(e) => setExcelInputEligible(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Column B: Ineligible Blacklist (Exclusions)</label>
                    <textarea 
                      rows={3} 
                      placeholder="Roll numbers to restrict/exclude (e.g. 23EE005)"
                      value={excelInputIneligible}
                      onChange={(e) => setExcelInputIneligible(e.target.value)}
                    />
                  </div>
                </div>

                <button className="btn-action-sm gold" onClick={handleExcelValidation}>
                  Validate Spreadsheet &amp; Upload
                </button>

                {excelSuccess !== null && (
                  <div className={`excel-validation-results ${excelSuccess === 'checking' ? 'info' : excelSuccess ? 'success' : 'error'}`}>
                    <h4>Ingestion Validator Log Outcome:</h4>
                    <div className="excel-log-outputs">
                      {excelValidationLogs.map((logLine, idx) => (
                        <div key={idx} className="log-line">{logLine}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Election Lifecycle List */}
              <div className="view-action-bar" style={{ marginTop: '20px' }}>
                <h2 className="dashboard-subtitle" style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Election Lifecycle Timeline Cockpit</h2>
              </div>

              <div className="elections-list">
                {filteredElections.map((el) => (
                  <div key={el.id} className={`election-list-item status-${el.status.toLowerCase()}`}>
                    
                    <div className="election-meta-left">
                      <span className="election-item-title">{el.name}</span>
                      <span className="election-item-dates">Duration: {el.start} to {el.end} · ID: {el.id} · Type: <strong>{el.type}</strong></span>
                      
                      {/* Visual lifecycle timeline */}
                      <div className="visual-timeline-container">
                        {[
                          { key: 'Configured', lbl: 'Created' },
                          { key: 'Running', lbl: 'Activated' },
                          { key: 'Paused', lbl: 'Paused' },
                          { key: 'Emergency_Locked', lbl: 'Locked' },
                          { key: 'Completed', lbl: 'Completed' },
                          { key: 'Archived', lbl: 'Archived' }
                        ].map((node) => {
                          const isActive = el.status === node.key;
                          return (
                            <div key={node.key} className={`timeline-node ${isActive ? 'active' : ''}`}>
                              <div className="timeline-node-circle"></div>
                              <span className="timeline-node-lbl">{node.lbl}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="election-meta-center">
                      <div className="item-stat">
                        <span className="item-stat-lbl">Registered</span>
                        <span className="item-stat-val">{el.voters}</span>
                      </div>
                      <div className="item-stat">
                        <span className="item-stat-lbl">Turnout</span>
                        <span className="item-stat-val">{el.votesCast} cast</span>
                      </div>
                      <span className={`election-status-tag ${el.status.toLowerCase()}`}>
                        {el.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="election-actions">
                      <button className="btn-action-sm" onClick={() => setPreviewElection(el)}>
                        <IconEye size={18} /> Preview
                      </button>

                      {el.status === 'Running' && (
                        <>
                          <button className="btn-action-sm" onClick={() => toggleElectionStatus(el.id)}>
                            <IconPlayerPause size={18} /> Pause
                          </button>
                          <button className="btn-action-sm danger" onClick={() => handleEmergencyLock(el.id)}>
                            <IconAlertCircle size={18} /> Emergency Lock
                          </button>
                          <button className="btn-action-sm danger" onClick={() => stopElection(el.id)}>
                            ✕ Stop Poll
                          </button>
                        </>
                      )}

                      {el.status === 'Paused' && (
                        <>
                          <button className="btn-action-sm" onClick={() => toggleElectionStatus(el.id)}>
                            <IconPlayerPlay size={18} /> Resume
                          </button>
                          <button className="btn-action-sm danger" onClick={() => handleEmergencyLock(el.id)}>
                            <IconAlertCircle size={18} /> Emergency Lock
                          </button>
                          <button className="btn-action-sm danger" onClick={() => stopElection(el.id)}>
                            ✕ Stop Poll
                          </button>
                        </>
                      )}

                      {el.status === 'Emergency_Locked' && (
                        <button className="btn-action-sm" onClick={() => {
                          setElections(prev => prev.map(x => x.id === el.id ? { ...x, status: 'Running' } : x));
                          addAuditLog('EMERGENCY_UNLOCK', 'admin', `Unlocked election ${el.name}`, 'INFO', 'ok');
                        }}>
                          <IconLockOpen size={18} /> Unlock
                        </button>
                      )}

                      {el.status === 'Completed' && (
                        <>
                          <button className="btn-action-sm gold" onClick={() => handleArchiveElection(el.id)}>
                            <IconPackage size={18} /> Archive
                          </button>
                          <button className="btn-action-sm" onClick={() => {
                            setActiveTab('Reports');
                            handleExportPdfReport(el.id);
                          }}>
                            <IconInbox size={18} /> Compile Report
                          </button>
                        </>
                      )}

                      {el.status === 'Archived' && (
                        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Archived (Read Only)</span>
                      )}
                    </div>

                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* CANDIDATE MANAGEMENT TAB */}
        {activeTab === 'Candidates' && (
          <div className="dashboard-body animate-fade-in">
            <div className="users-table-card">
              <h2 className="tab-section-title">{editCandId ? 'Modify Candidate Profile' : 'Add Candidate Profile'}</h2>
              <form onSubmit={handleCandidateSubmit} className="create-election-form">
                <div className="form-row-grid">
                  <div className="field">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Priya Sharma" 
                      value={candName} 
                      onChange={(e) => setCandName(e.target.value)} 
                    />
                  </div>
                  <div className="field">
                    <label>Department</label>
                    <select value={candDept} onChange={(e) => setCandDept(e.target.value)}>
                      <option value="CSE">CSE (Computer Science)</option>
                      <option value="ECE">ECE (Electronics)</option>
                      <option value="ME">ME (Mechanical)</option>
                      <option value="EE">EE (Electrical)</option>
                      <option value="IT">IT (Information Tech)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-grid">
                  <div className="field">
                    <label>Student Roll Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 21CS042" 
                      value={candRoll} 
                      onChange={(e) => setCandRoll(e.target.value)} 
                    />
                  </div>
                  <div className="field">
                    <label>Assign to Election</label>
                    <select value={candElectionId} onChange={(e) => setCandElectionId(e.target.value)}>
                      {elections.filter(el => el.status !== 'Archived').map(el => (
                        <option key={el.id} value={el.id}>{el.name} ({el.id})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Manifesto Quote</label>
                  <textarea 
                    rows={2} 
                    placeholder="Short manifesto quote or summary..." 
                    value={candManifesto} 
                    onChange={(e) => setCandManifesto(e.target.value)} 
                  />
                </div>

                <div className="form-row-grid">
                  <div className="field">
                    <label>Candidate Profile Photo</label>
                    <div className="mock-photo-upload-box">
                      <div className="mock-upload-icon"><IconCamera size={24} /></div>
                      <span>Simulate Photo Upload Slot (Automatic Aspect Crop 1:1)</span>
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn-create-election">
                  {editCandId ? 'Update Candidate Entry' : 'Bind Candidate Entry'}
                </button>
              </form>
            </div>

            {/* Candidates Directory */}
            <div className="users-table-card" style={{ marginTop: '20px' }}>
              <h2 className="tab-section-title">Candidates Directory</h2>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>ROLL NUMBER</th>
                    <th>DEPT</th>
                    <th>ASSIGNED ELECTION</th>
                    <th>MANIFESTO</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map(c => {
                    const el = elections.find(e => e.id === c.electionId);
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td className="user-roll">{c.rollNo}</td>
                        <td>{c.dept}</td>
                        <td><span className="badge-role gold">{el ? el.name : 'Unknown Election'}</span></td>
                        <td style={{ fontSize: '11px', color: 'var(--text2)', maxWidth: '280px' }}>{c.manifesto}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn-action-sm" onClick={() => handleEditCandidateClick(c)}><IconPencil size={18} /> Edit</button>
                          <button className="btn-action-sm danger" onClick={() => handleDeleteCandidate(c.id, c.electionId)}>✕ Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text3)' }}>No candidates match search queries.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USER MANAGEMENT TAB */}
        {activeTab === 'Users' && (
          <div className="dashboard-body animate-fade-in">
            <div className="users-table-card">
              <h2 className="tab-section-title">Voter Management Cockpit</h2>
              <p className="section-desc">Search and audit voter logs. Check ineligibles and resolve token anomalies.</p>
              
              {/* Bulk Actions Controls */}
              <div className="bulk-actions-toolbar">
                <span className="selected-count-label">Selected: <strong>{selectedVoters.length}</strong></span>
                <button className="btn-action-sm" onClick={() => handleBulkAction('approve')}>✓ Bulk Approve</button>
                <button className="btn-action-sm" onClick={() => handleBulkAction('restrict')}>✕ Bulk Restrict</button>
                <button className="btn-action-sm" onClick={() => handleBulkAction('reset')}><IconRefresh size={18} /> Bulk Reset status</button>
              </div>

              <table className="dash-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedVoters.length === voters.length}
                        onChange={handleSelectAllVoters}
                      />
                    </th>
                    <th>INSTITUTIONAL ID</th>
                    <th>USER-CREATED ID</th>
                    <th>SYSTEM ID</th>
                    <th>FULL NAME</th>
                    <th>DEPT</th>
                    <th>ELIGIBLE</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.map((v) => (
                    <tr key={v.roll}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedVoters.includes(v.roll)}
                          onChange={() => toggleSelectVoter(v.roll)}
                        />
                      </td>
                      <td className="user-roll"><strong>{v.roll}</strong></td>
                      <td className="user-roll">{v.userCreatedId}</td>
                      <td className="user-roll" style={{ color: 'var(--text3)' }}>{v.systemId}</td>
                      <td>{v.name}</td>
                      <td>{v.dept}</td>
                      <td>
                        <span className={`eligibility-badge ${v.eligible ? 'yes' : 'no'}`}>
                          {v.eligible ? 'Eligible Whitelist' : 'Restricted Blacklist'}
                        </span>
                      </td>
                      <td>
                        <span className={`user-status-dot ${v.status.toLowerCase().includes('voted') ? 'voted' : 'pending'}`}></span>
                        {v.status}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {v.status === 'Token Dispatched - Not Voted' && (
                          <button className="btn-action-sm gold" onClick={() => triggerResendToken(v)}>
                            <IconRefresh size={18} /> Resend Token
                          </button>
                        )}
                        <button className="btn-action-sm" onClick={() => {
                          setVoters(prev => prev.map(x => x.roll === v.roll ? { ...x, eligible: !x.eligible } : x));
                          addAuditLog('ELIGIBILITY_OVERRIDE', 'admin', `Toggled eligibility for voter ${v.roll}`, 'INFO', 'ok');
                        }}>
                          Toggle Access
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredVoters.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text3)' }}>No voters matching your query found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTS ANALYTICS TAB */}
        {activeTab === 'Results' && (
          <div className="dashboard-body animate-fade-in">
            <h2 className="tab-section-title">Election Results Analytics (Hover to Expand)</h2>
            
            <div className="results-hover-grid">
              {elections.filter(e => e.status !== 'Archived').map(el => {
                const elCandidates = candidates.filter(c => c.electionId === el.id);
                const sortedCand = [...elCandidates].sort((a,b) => b.votes - a.votes);
                const winner = sortedCand[0];
                const totalVotes = el.votesCast;

                return (
                  <div key={el.id} className="result-expand-card">
                    <div className="result-card-header">
                      <span className="res-el-id">{el.id}</span>
                      <span className={`res-el-status ${el.status.toLowerCase()}`}>{el.status}</span>
                    </div>
                    <h3 className="res-el-title">{el.name}</h3>
                    <p className="res-el-desc">{el.description}</p>
                    
                    <div className="res-summary-mini">
                      <span>Total Votes: <strong>{totalVotes}</strong></span>
                      <span>Voters: <strong>{el.voters}</strong></span>
                    </div>

                    {el.draw && (
                      <div className="tie-warning-banner">
                        <IconAlertTriangle size={18} /> Result Confirmed: Tie Imbalance Identified
                      </div>
                    )}

                    {/* HOVER OVERLAY DETAIL PANEL */}
                    <div className="result-hover-overlay-panel">
                      <h4 className="hover-panel-title">Operational Data Stream</h4>
                      
                      {el.draw ? (
                        <div className="hover-tie-actions">
                          <p className="tie-helper-text">Two leading candidates tied with equal ballot points.</p>
                          <button className="btn-action-sm gold" onClick={() => handleDeclareJointWinners(el.id)}>
                            <IconHeartHandshake size={18} /> Declare Joint Winners
                          </button>
                          <button className="btn-action-sm danger" onClick={() => handleReopenElection(el.id)}>
                            <IconRefresh size={18} /> Re-Open Target Election
                          </button>
                        </div>
                      ) : (
                        <div className="hover-winner-info">
                          {winner ? (
                            <>
                              <div className="winner-row">
                                <div className="winner-avatar">{winner.name.split(' ').map(x=>x[0]).join('')}</div>
                                <div className="winner-meta">
                                  <span className="lbl">WINNER</span>
                                  <span className="name">{winner.name} ({winner.dept})</span>
                                </div>
                              </div>

                              <div className="top-contenders-list">
                                <span className="contenders-title">Top Candidates</span>
                                {sortedCand.slice(0, 3).map((c, i) => (
                                  <div key={c.id} className="contender-row">
                                    <span className="cand-n">{i+1}. {c.name}</span>
                                    <span className="cand-p">{totalVotes > 0 ? Math.round((c.votes/totalVotes)*100) : 0}% ({c.votes}v)</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="no-votes-registered">No candidate allocations found.</div>
                          )}
                        </div>
                      )}

                      <button className="btn-action-sm" style={{ width: '100%', marginTop: '12px' }} onClick={() => setInspectedElection(el)}>
                        <IconSearch size={18} /> Deep Inspection Report
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REPORTS & AUDITS TAB */}
        {activeTab === 'Reports' && (
          <div className="dashboard-body animate-fade-in">
            <div className="reports-section-layout">
              
              {/* SUBTAB 1: AUDIT LOG PORTAL */}
              <div className="users-table-card">
                <div className="audit-header-controls">
                  <h2 className="tab-section-title">View 1: Cryptographic Audit Logs Portal</h2>
                  
                  <div className="audit-filters-row">
                    <select value={auditSeverityFilter} onChange={(e) => setAuditSeverityFilter(e.target.value)}>
                      <option value="ALL">All Severity Levels</option>
                      <option value="INFO">INFO logs only</option>
                      <option value="WARNING">WARNING logs only</option>
                      <option value="CRITICAL">CRITICAL logs only</option>
                    </select>

                    <div className="time-filter-inputs">
                      <input 
                        type="time" 
                        value={auditTimeFilterFrom}
                        onChange={(e) => setAuditTimeFilterFrom(e.target.value)}
                      />
                      <span>to</span>
                      <input 
                        type="time" 
                        value={auditTimeFilterTo}
                        onChange={(e) => setAuditTimeFilterTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="audit-timeline-stream">
                  {filteredLogs.length === 0 ? (
                    <div className="no-logs-msg">No logs matching filter constraints.</div>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <div key={idx} className={`audit-timeline-item level-${log.level.toLowerCase()}`}>
                        <div className="timeline-item-indicator"></div>
                        <div className="timeline-item-meta">
                          <span className="log-timestamp">[{log.ts}]</span>
                          <span className={`log-severity-tag ${log.level.toLowerCase()}`}>{log.level}</span>
                          <span className="log-event-type">{log.ev}</span>
                          <span className="log-user">{log.usr}</span>
                        </div>
                        <div className="timeline-item-desc">{log.desc}</div>
                      </div>
                    ))
                  )}
                </div>

                {logs.length > displayedLogsCount && (
                  <button className="btn-action-sm gold" style={{ margin: '20px auto 0', display: 'block' }} onClick={() => setDisplayedLogsCount(prev => prev + 10)}>
                    Load older logs (Lazy Retrieval)
                  </button>
                )}
              </div>

              {/* SUBTAB 2: EXPORT ARCHIVE ENGINE */}
              <div className="users-table-card">
                <h2 className="tab-section-title">View 2: Reports Archive &amp; Export Engine</h2>
                <p className="section-desc">Download signed PDF summaries. Live results download is integrated here.</p>

                <div className="archive-export-list">
                  {elections.map((el) => (
                    <div key={el.id} className="export-row-item">
                      <div className="export-meta">
                        <span className="code">{el.id}</span>
                        <div className="export-info-text">
                          <span className="title">{el.name}</span>
                          <span className="desc">{el.description}</span>
                        </div>
                      </div>

                      <div className="export-actions-cell">
                        {exportingElectionId === el.id ? (
                          <div className="export-progress-container">
                            <div className="progress-bar-track">
                              <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }}></div>
                            </div>
                            <span>Generating report PDF: {exportProgress}%</span>
                          </div>
                        ) : (
                          <button className="btn-action-sm gold" onClick={() => handleExportPdfReport(el.id)}>
                            <IconInbox size={18} /> Export Report PDF
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* PDF Signatures display mockup */}
                {signedPdfData && (
                  <div className="pdf-signed-receipt-modal">
                    <h3><IconFileDescription size={24} /> Signed PDF Document Compiled</h3>
                    <div className="signed-receipt-details">
                      <p><strong>Report Title:</strong> {signedPdfData.title}</p>
                      <p><strong>Target ID:</strong> {signedPdfData.id}</p>
                      <p><strong>Report ID Code:</strong> <span className="code">{signedPdfData.reportId}</span></p>
                      <p><strong>Voter Turnout:</strong> {signedPdfData.votes} / {signedPdfData.voters} votes cast</p>
                      
                      <div className="signature-seal-block">
                        <div className="seal-logo"><IconShield size={48} /></div>
                        <div className="seal-text">
                          <p><strong>GENERATED BY:</strong> Super Administrator</p>
                          <p><strong>GENERATED ON:</strong> {signedPdfData.date}</p>
                          <p className="verif-status">✓ CRYPTOGRAPHICALLY SIGNED VIA ECDSA P-256</p>
                        </div>
                      </div>
                    </div>
                    <button className="btn-action-sm" onClick={() => setSignedPdfData(null)}>Close Preview</button>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

        {/* SYSTEM HEALTH TAB */}
        {activeTab === 'System' && (
          <div className="dashboard-body animate-fade-in">
            <div className="dash-system-row">
              {/* Metrics dials */}
              <div className="dash-system-card">
                <span className="dash-control-title">Gauges &amp; Metrics Telemetry</span>
                <div className="system-status-grid" style={{ marginTop: '20px' }}>
                  <div className="system-status-row">
                    <span className="sys-label">Primary API CPU Utilization</span>
                    <span className="sys-val-mono">14.2%</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Ballot Database Memory Pool</span>
                    <span className="sys-val-mono">512MB / 4096MB</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Network Transport Stream Latency</span>
                    <span className="sys-val-mono color-green">12ms (Optimal)</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Active Socket Handshakes</span>
                    <span className="sys-val-mono">244 open</span>
                  </div>
                </div>
              </div>

              {/* Backup Management Panel */}
              <div className="dash-system-card">
                <span className="dash-control-title">Backup Management &amp; Recovery</span>
                
                <div className="backup-telemetry-box">
                  <div className="backup-status-row">
                    <span className="lbl">Last Backup Sync:</span>
                    <span className="val">2026-06-02 14:00 (14 mins ago)</span>
                  </div>
                  <div className="backup-status-row">
                    <span className="lbl">Backup Storage Size:</span>
                    <span className="val">142.4 MB</span>
                  </div>
                  <div className="backup-status-row">
                    <span className="lbl">Backup Integrity:</span>
                    <span className="val color-green">✓ Validated</span>
                  </div>
                  <div className="backup-status-row">
                    <span className="lbl">Restore Test Verification:</span>
                    <span className="val color-green">✓ PASS (Restore test validated successfully in 12.5s)</span>
                  </div>
                </div>

                <button className="btn-action-sm gold" style={{ width: '100%', marginTop: '16px' }} onClick={() => {
                  alert('Triggering manual database backup... Backup sync logs updated.');
                  addAuditLog('BACKUP_MANUAL', 'admin', 'Manual database backup compiled successfully (Size: 142.8 MB)', 'INFO', 'ok');
                }}>
                  Trigger Manual Backup Sync
                </button>
              </div>
            </div>

            {/* Interactive Security Rate-Limiting Testing Cockpit */}
            <div className="users-table-card" style={{ marginTop: '20px' }}>
              <h2 className="tab-section-title">Interactive Rate-Limiting &amp; Lockout Testing Cockpit</h2>
              <p className="section-desc">Test the progressive anti-spam throttling algorithm. Locks user after 5 failures.</p>
              
              <div className="lockout-tester-grid">
                <div className="tester-panel">
                  <div className="field">
                    <label>Simulated Client IP Address</label>
                    <input 
                      type="text" 
                      value={simulatedIp} 
                      onChange={(e) => setSimulatedIp(e.target.value)} 
                    />
                  </div>
                  <div className="attempts-monitor">
                    <span>Attempts: <strong>{simulatedFailures}</strong></span>
                    {simulatedCooldown > 0 && (
                      <span className="cooldown-active-tag">Cooldown: <strong>{simulatedCooldown}s</strong></span>
                    )}
                  </div>
                  
                  <div className="tester-actions">
                    <button className="btn-action-sm danger" onClick={handleTriggerSimulatedLockout} disabled={simulatedCooldown > 0}>
                      Trigger Simulated Invalid Token Entry
                    </button>
                    <button className="btn-action-sm" onClick={() => {
                      setSimulatedFailures(0);
                      setSimulatedCooldown(0);
                      setSimulatedStatus('Clean (Zero Delay)');
                    }}>
                      Reset Cockpit Stats
                    </button>
                  </div>
                </div>

                <div className="tester-status-display">
                  <span className="lbl">Anti-Spam Engine Status:</span>
                  <div className={`status-dial ${simulatedCooldown > 0 ? 'locked' : 'unlocked'}`}>
                    {simulatedStatus}
                  </div>
                  <div className="lockout-rules-bullets">
                    <div><IconCircleCheck size={16} color="green"/> 0-5 failures: No delay block.</div>
                    <div><IconAlertCircle size={16} color="#d4a017"/> 5 failures: 30s progressive cooldown lock.</div>
                    <div><IconAlertTriangle size={16} color="#d35400"/> 6+ failures: 60s+ dynamic incremental lock.</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ALERTS TERMINAL TAB */}
        {activeTab === 'Alerts' && (
          <div className="dashboard-body animate-fade-in">
            <div className="users-table-card">
              <h2 className="tab-section-title">Incident Alerts Monitor</h2>
              
              {activeAlerts.length > 0 ? (
                <div className="active-alerts-listing">
                  {activeAlerts.map(alertItem => (
                    <div key={alertItem.id} className="active-alert-item card">
                      <h4>{alertItem.title}</h4>
                    </div>
                  ))}
                </div>
              ) : (
                /* NULL-STATE FALLBACK RULE */
                <div className="null-state-alerts-container">
                  <div className="null-state-header">
                    <div className="shield-icon"><IconShield size={48} /></div>
                    <span className="lbl">Zero Active Incidents Identified</span>
                    <p className="desc">Platform health optimal. Displaying past resolved incidents archive below for full administrative trace.</p>
                  </div>

                  <div className="resolved-alerts-archive">
                    <h3 className="archive-title">Historical Resolved Alerts Logs:</h3>
                    {resolvedAlerts.map(alertItem => (
                      <div key={alertItem.id} className={`resolved-alert-card border-${alertItem.severity}`}>
                        <div className="res-meta-left">
                          <span className={`severity-indicator ${alertItem.severity}`}>{alertItem.severity.toUpperCase()}</span>
                          <span className="title"><strong>{alertItem.title}</strong></span>
                        </div>
                        <div className="res-meta-right">
                          <span>Date: {alertItem.date}</span>
                          <span>Outage: {alertItem.duration}</span>
                          <span className="resolution">Resolved: <em>{alertItem.resolution}</em></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* PROFILE & PRODUCTIVITY WORKSPACE TAB */}
        {activeTab === 'Profile' && (
          <div className="dashboard-body animate-fade-in">
            <div className="profile-workspace-grid">
              
              {/* LEFT COLUMN: IDENTITY & QUICK WIDGETS */}
              <div className="profile-column-left">
                
                {/* SECTION 1: ADMIN PROFILE CARD */}
                <div className="profile-glass-card admin-identity-card">
                  <div className="profile-photo-area">
                    <div className="photo-circle-lg">HH</div>
                    <div className="identity-title-info">
                      <h2>Hari Harsha</h2>
                      <span className="username">@harsha_admin</span>
                      <div className="status-indicator-tag online">
                        <span className="indicator-dot"></span> Online
                      </div>
                    </div>
                  </div>

                  <div className="profile-meta-details-rows">
                    <div className="meta-row">
                      <span className="lbl">Role</span>
                      <span className="val bold gold">Super Administrator</span>
                    </div>
                    <div className="meta-row">
                      <span className="lbl">Department</span>
                      <span className="val">Election Governance Board</span>
                    </div>
                    <div className="meta-row">
                      <span className="lbl">Institution</span>
                      <span className="val">VoteGuard Central Registry</span>
                    </div>
                    <div className="meta-row">
                      <span className="lbl">Email</span>
                      <span className="val">{adminEmail}</span>
                    </div>
                    <div className="meta-row">
                      <span className="lbl">Phone</span>
                      <span className="val">{adminPhone}</span>
                    </div>
                    <div className="meta-row">
                      <span className="lbl">Account Created</span>
                      <span className="val">June 1, 2025</span>
                    </div>
                    <div className="meta-row">
                      <span className="lbl">Last Login</span>
                      <span className="val">Today at {time}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="profile-badges-chips">
                    <span className="badge-chip gold">✓ Super Administrator</span>
                    <span className="badge-chip gold">✓ Election Governance</span>
                    <span className="badge-chip gold">✓ Audit Authority</span>
                    <span className="badge-chip gold">✓ System Manager</span>
                  </div>
                </div>

                {/* SECTION 2: ADMIN STATISTICS */}
                <div className="profile-glass-card admin-stats-container">
                  <h3 className="card-section-title">Operations Metrics</h3>
                  <div className="stats-mini-grid">
                    <div className="stat-mini-tile">
                      <span className="lbl">Elections Run</span>
                      <span className="val">32</span>
                    </div>
                    <div className="stat-mini-tile">
                      <span className="lbl">Reports Created</span>
                      <span className="val">145</span>
                    </div>
                    <div className="stat-mini-tile">
                      <span className="lbl">Audit Logs</span>
                      <span className="val">1.2k</span>
                    </div>
                    <div className="stat-mini-tile">
                      <span className="lbl">Alerts Cleared</span>
                      <span className="val">42</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: ABOUT ME */}
                <div className="profile-glass-card admin-bio-card">
                  <h3 className="card-section-title">About Me</h3>
                  <textarea 
                    className="bio-textarea"
                    rows={4}
                    value={adminBio}
                    onChange={(e) => setAdminBio(e.target.value)}
                    placeholder="Describe your governance duties..."
                  />
                  <div className="bio-footer-helper">Auto-saves to browser storage</div>
                </div>

                {/* SECTION 6: QUICK REMINDERS */}
                <div className="profile-glass-card admin-reminders-card">
                  <h3 className="card-section-title">Upcoming Reminders</h3>
                  <div className="reminders-list">
                    <div className="reminder-item-row warning">
                      <div className="icon"><IconBox size={24} /></div>
                      <div className="body">
                        <strong>Student Council Poll Ends</strong>
                        <span>Election closes on 2026-06-03 at 16:00</span>
                      </div>
                    </div>
                    <div className="reminder-item-row critical">
                      <div className="icon"><IconScale size={24} /></div>
                      <div className="body">
                        <strong>Tie-break Imbalance Override</strong>
                        <span>ECE rep deadlock needs executive action declaration</span>
                      </div>
                    </div>
                    <div className="reminder-item-row healthy">
                      <div className="icon"><IconPlug size={24} /></div>
                      <div className="body">
                        <strong>System Health Audit</strong>
                        <span>SMS Gateway warning status currently monitored</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 8: PERSONAL SETTINGS */}
                <div className="profile-glass-card admin-settings-card">
                  <h3 className="card-section-title">Personal Settings Panel</h3>
                  
                  <div className="settings-section">
                    <span className="settings-subtitle">Contact Coordinates</span>
                    <div className="settings-fields-grid">
                      <div className="field">
                        <label>Email Address</label>
                        <input type="text" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Phone Number</label>
                        <input type="text" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="settings-section" style={{ marginTop: '16px' }}>
                    <span className="settings-subtitle">Platform Alert Notifications</span>
                    <div className="notification-checkboxes">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
                        Send critical alerts via Email
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={notifSms} onChange={(e) => setNotifSms(e.target.checked)} />
                        Send backup logs to SMS relay
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={notifPush} onChange={(e) => setNotifPush(e.target.checked)} />
                        Enable desktop browser push notifications
                      </label>
                    </div>
                  </div>

                  <div className="settings-section" style={{ marginTop: '16px' }}>
                    <span className="settings-subtitle">Security Key Update</span>
                    <form onSubmit={handleUpdatePassword} className="settings-password-form">
                      <div className="field">
                        <label>Current Password</label>
                        <input type="password" value={adminPassCurrent} onChange={(e) => setAdminPassCurrent(e.target.value)} placeholder="••••••••" />
                      </div>
                      <div className="field">
                        <label>New Password</label>
                        <input type="password" value={adminPassNew} onChange={(e) => setAdminPassNew(e.target.value)} placeholder="••••••••" />
                      </div>
                      <div className="field">
                        <label>Confirm Password</label>
                        <input type="password" value={adminPassConfirm} onChange={(e) => setAdminPassConfirm(e.target.value)} placeholder="••••••••" />
                      </div>
                      <button type="submit" className="btn-action-sm gold" style={{ marginTop: '8px' }}>
                        Update Security Credentials
                      </button>
                    </form>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: DIARY, TASKS, TIMELINE */}
              <div className="profile-column-right">

                {/* SECTION 7: PRODUCTIVITY SUMMARY */}
                <div className="profile-glass-card productivity-summary-card">
                  <h3 className="card-section-title">Productivity Logs</h3>
                  <div className="productivity-periods-ratios">
                    <div className="period-box">
                      <span className="lbl">TODAY</span>
                      <strong>3 Logs Compiled</strong>
                    </div>
                    <div className="period-box">
                      <span className="lbl">THIS WEEK</span>
                      <strong>2 Elections Run</strong>
                    </div>
                    <div className="period-box">
                      <span className="lbl">THIS MONTH</span>
                      <strong>14 Audit Reviews</strong>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: PERSONAL NOTES / DIARY */}
                <div className="profile-glass-card personal-diary-card">
                  <div className="diary-header">
                    <div>
                      <h3 className="card-section-title">Personal Workspace &amp; Diary</h3>
                      <p className="card-section-desc">Private notes visible only to you.</p>
                    </div>
                    
                    {/* Add note FAB inside card */}
                    <button className="fab-add-note-btn" onClick={() => {
                      setEditingNoteId(null);
                      setNoteTitleInput('');
                      setNoteTextInput('');
                      setShowNoteModal(true);
                    }}>
                      <IconPlus size={18} />
                    </button>
                  </div>

                  {/* Diary Controls */}
                  <div className="diary-toolbar">
                    <input 
                      type="text" 
                      placeholder="Search workspace notes..." 
                      value={noteSearchQuery}
                      onChange={(e) => setNoteSearchQuery(e.target.value)}
                      className="diary-search-input"
                    />
                    <button 
                      className={`btn-action-sm ${showArchivedNotes ? 'gold' : ''}`}
                      onClick={() => setShowArchivedNotes(!showArchivedNotes)}
                    >
                      {showArchivedNotes ? 'Viewing Archived' : 'View Archives'}
                    </button>
                  </div>

                  {/* Pinned Notes Section */}
                  {pinnedNotes.length > 0 && (
                    <div className="notes-subsection pinned">
                      <span className="subsection-title"><IconPin size={18}/> Pinned Notes</span>
                      <div className="notes-diary-cards-layout">
                        {pinnedNotes.map(n => (
                          <div key={n.id} className="note-diary-card pinned">
                            <div className="note-card-header">
                              <h4>{n.title}</h4>
                              <div className="note-card-actions">
                                <button title="Unpin" onClick={() => handleTogglePinNote(n.id)}><IconPin size={16} /></button>
                                <button title="Archive" onClick={() => handleToggleArchiveNote(n.id)}><IconArchive size={16} /></button>
                                <button title="Edit" onClick={() => {
                                  setEditingNoteId(n.id);
                                  setNoteTitleInput(n.title);
                                  setNoteTextInput(n.text);
                                  setShowNoteModal(true);
                                }}><IconPencil size={16} /></button>
                                <button title="Delete" className="danger" onClick={() => handleDeleteAdminNote(n.id)}>✕</button>
                              </div>
                            </div>
                            <p className="text">{n.text}</p>
                            <span className="date">{n.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active/Unpinned Notes Section */}
                  <div className="notes-subsection" style={{ marginTop: '16px' }}>
                    <span className="subsection-title">Workspace Notes</span>
                    <div className="notes-diary-cards-layout">
                      {unpinnedNotes.map(n => (
                        <div key={n.id} className="note-diary-card">
                          <div className="note-card-header">
                            <h4>{n.title}</h4>
                            <div className="note-card-actions">
                              <button title="Pin" onClick={() => handleTogglePinNote(n.id)}><IconPin size={16} /></button>
                              <button title="Archive" onClick={() => handleToggleArchiveNote(n.id)}><IconArchive size={16} /></button>
                              <button title="Edit" onClick={() => {
                                  setEditingNoteId(n.id);
                                  setNoteTitleInput(n.title);
                                  setNoteTextInput(n.text);
                                  setShowNoteModal(true);
                              }}><IconPencil size={16} /></button>
                              <button title="Delete" className="danger" onClick={() => handleDeleteAdminNote(n.id)}>✕</button>
                            </div>
                          </div>
                          <p className="text">{n.text}</p>
                          <span className="date">{n.date}</span>
                        </div>
                      ))}
                      {unpinnedNotes.length === 0 && pinnedNotes.length === 0 && (
                        <div className="notes-empty-state">No diary records match search criteria. Click the FAB button to add one.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 5: TASK MANAGEMENT */}
                <div className="profile-glass-card task-manager-card">
                  <div className="task-manager-header">
                    <h3 className="card-section-title">Task Management Checklist</h3>
                    <button className="btn-action-sm" onClick={() => setShowTaskForm(!showTaskForm)}>
                      {showTaskForm ? 'Cancel' : 'Add Task'}
                    </button>
                  </div>

                  {/* Inline Task Form */}
                  {showTaskForm && (
                    <form onSubmit={handleAddTask} className="add-task-form animate-slide-down">
                      <div className="field">
                        <label>Task Title</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Invalidate voter token..." 
                          value={taskTitleInput}
                          onChange={(e) => setTaskTitleInput(e.target.value)}
                        />
                      </div>
                      <div className="form-row-grid">
                        <div className="field">
                          <label>Priority</label>
                          <select value={taskPriorityInput} onChange={(e) => setTaskPriorityInput(e.target.value)}>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Deadline Date</label>
                          <input type="date" value={taskDeadlineInput} onChange={(e) => setTaskDeadlineInput(e.target.value)} />
                        </div>
                      </div>
                      <button type="submit" className="btn-action-sm gold" style={{ marginTop: '8px' }}>
                        Add to Task Matrix
                      </button>
                    </form>
                  )}

                  {/* Tasks List */}
                  <div className="tasks-columns-layout">
                    {/* Pending tasks */}
                    <div className="tasks-sublist">
                      <span className="sublist-title">Pending Tasks ({adminTasks.filter(t => !t.completed).length})</span>
                      <div className="tasks-rows">
                        {adminTasks.filter(t => !t.completed).map(t => (
                          <div key={t.id} className="task-row-card">
                            <div className="task-row-left">
                              <input 
                                type="checkbox" 
                                checked={t.completed} 
                                onChange={() => handleToggleTaskCompleted(t.id)} 
                                className="task-checkbox"
                              />
                              <div className="task-text-info">
                                <span className="task-title">{t.title}</span>
                                <span className="task-deadline">Limit: {t.deadline}</span>
                              </div>
                            </div>
                            <div className="task-row-right">
                              <span className={`task-priority-tag ${t.priority.toLowerCase()}`}>{t.priority}</span>
                              <button title="Delete task" className="delete-task-btn" onClick={() => handleDeleteTask(t.id)}>✕</button>
                            </div>
                          </div>
                        ))}
                        {adminTasks.filter(t => !t.completed).length === 0 && (
                          <div className="tasks-empty-msg">All tasks completed!</div>
                        )}
                      </div>
                    </div>

                    {/* Completed tasks */}
                    <div className="tasks-sublist">
                      <span className="sublist-title">Completed Tasks ({adminTasks.filter(t => t.completed).length})</span>
                      <div className="tasks-rows">
                        {adminTasks.filter(t => t.completed).map(t => (
                          <div key={t.id} className="task-row-card completed">
                            <div className="task-row-left">
                              <input 
                                type="checkbox" 
                                checked={t.completed} 
                                onChange={() => handleToggleTaskCompleted(t.id)} 
                                className="task-checkbox"
                              />
                              <div className="task-text-info">
                                <span className="task-title strike-through">{t.title}</span>
                                <span className="task-deadline">Finished</span>
                              </div>
                            </div>
                            <div className="task-row-right">
                              <span className="task-priority-tag completed">Completed</span>
                              <button title="Delete task" className="delete-task-btn" onClick={() => handleDeleteTask(t.id)}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 9: ACTIVITY HISTORY */}
                <div className="profile-glass-card activity-timeline-card">
                  <h3 className="card-section-title">Personal Session History</h3>
                  <div className="profile-activity-timeline">
                    {[
                      { ev: 'LOGIN', ts: 'Today at 14:12', desc: 'Successfully validated 2FA login session from IP 192.168.1.144.' },
                      { ev: 'EMERGENCY_LOCK', ts: 'Today at 13:02', desc: 'Activated emergency lock safety protocol on election ELC004.' },
                      { ev: 'REPORT', ts: 'Yesterday at 16:45', desc: 'Generated cryptographically signed PDF report for ELC003.' },
                      { ev: 'WHITELIST', ts: '2026-06-01 10:20', desc: 'Uploaded whitelisted override spreadsheets for lateral students.' },
                      { ev: 'CONFIG', ts: '2026-06-01 09:12', desc: 'Initialized Student Council President election template.' }
                    ].map((act, i) => (
                      <div key={i} className="profile-activity-item">
                        <div className="timeline-bullet"></div>
                        <div className="activity-body">
                          <div className="meta">
                            <span className={`act-badge ${act.ev.toLowerCase()}`}>{act.ev}</span>
                            <span className="time">{act.ts}</span>
                          </div>
                          <p className="desc">{act.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>

      {/* DIARY MODAL (ADD / EDIT NOTE FORM) */}
      {showNoteModal && (
        <div className="voter-preview-modal-overlay">
          <div className="voter-preview-modal-box recovery-box">
            <h3 className="modal-title">{editingNoteId ? 'Edit Personal Note' : 'Add Note to Workspace'}</h3>
            <form onSubmit={handleAddOrEditNote} className="create-election-form" style={{ marginTop: '16px', textAlign: 'left' }}>
              <div className="field">
                <label>Note Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. CSE election eligibility review" 
                  value={noteTitleInput}
                  onChange={(e) => setNoteTitleInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Note Text / Details</label>
                <textarea 
                  rows={4}
                  placeholder="Type note details here..."
                  value={noteTextInput}
                  onChange={(e) => setNoteTextInput(e.target.value)}
                />
              </div>
              <div className="modal-form-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn-action-sm gold" style={{ flexGrow: '1' }}>
                  {editingNoteId ? 'Update Note' : 'Save Note'}
                </button>
                <button type="button" className="btn-action-sm" style={{ flexGrow: '1' }} onClick={() => setShowNoteModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: PREVIEW AS VOTER OVERLAY MODAL */}
      {previewElection && (
        <div className="voter-preview-modal-overlay">
          <div className="voter-preview-modal-box">
            <div className="preview-modal-header">
              <span className="badge-preview">Voter Experience Preview Mode</span>
              <h3>Election Ballot Look &amp; Feel</h3>
              <button className="close-preview-btn" onClick={() => setPreviewElection(null)}>✕ Close Preview</button>
            </div>
            
            <div className="preview-modal-body">
              <div className="preview-voter-banner">
                <h4>{previewElection.name}</h4>
                <p>{previewElection.description}</p>
                <div className="preview-meta-labels">
                  <span>Type: <strong>{previewElection.type}</strong></span>
                  <span>End Limit: <strong>{previewElection.end}</strong></span>
                </div>
              </div>

              {previewElection.type === 'Private' && (
                <div className="preview-verification-box">
                  <label className="lbl-preview">Step 2: Private Access Verification check</label>
                  <input type="text" placeholder="Enter Access Code..." value={previewElection.accessCode} readOnly className="preview-readonly-input" />
                  <span className="helper">Unlocking with code: {previewElection.accessCode}</span>
                </div>
              )}

              <div className="preview-candidates-ballot">
                <span className="lbl-preview">Step 7: Candidate Selection Ballot cards</span>
                <div className="preview-candidates-grid">
                  {candidates.filter(c => c.electionId === previewElection.id).map(c => (
                    <div key={c.id} className="preview-candidate-card">
                      <div className="cand-avatar">{c.name.split(' ').map(x=>x[0]).join('')}</div>
                      <h4>{c.name}</h4>
                      <span className="dept">{c.dept} · Roll: {c.rollNo}</span>
                      <p className="manifesto">"{c.manifesto}"</p>
                      <button className="preview-select-btn" onClick={() => alert('Simulator: Candidate card selection highlighted.')}>Select Candidate</button>
                    </div>
                  ))}
                  {candidates.filter(c => c.electionId === previewElection.id).length === 0 && (
                    <div className="no-candidates-msg">No candidates bound to this election yet. Add profiles in Candidate Setup tab.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TOKEN EXCEPTION SECURE PROGRESS MODAL */}
      {tokenRecoveryUser && (
        <div className="voter-preview-modal-overlay">
          <div className="voter-preview-modal-box recovery-box">
            <h3>Token Recovery exception pipeline</h3>
            
            <div className="recovery-status-body">
              <p>Target User: <strong>{tokenRecoveryUser.name} ({tokenRecoveryUser.roll})</strong></p>
              
              {isRecovering ? (
                <div className="recovery-loader-area">
                  <div className="spinner"></div>
                  <p className="status-text">{recoveryStatusText}</p>
                </div>
              ) : recoveryFinished ? (
                <div className="recovery-success-area">
                  <div className="success-icon-badge">✓</div>
                  <h4>Cryptographic Token Reset Success</h4>
                  <p>Old token was set to VOID status. A fresh token was generated and securely dispatched directly to the voter's verified destination channel.</p>
                  <div className="secure-disclosure-warning">
                    <IconAlertTriangle size={18}/> <strong>Security Protocol:</strong> To protect voter anonymity and avoid operator coercion, the raw cleartext token was NOT exposed to the administrator interface.
                  </div>
                  <button className="btn-action-sm gold" onClick={() => setTokenRecoveryUser(null)}>Finish Recovery Process</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RESULTS INSPECTION DETAIL MODAL */}
      {inspectedElection && (
        <div className="voter-preview-modal-overlay">
          <div className="voter-preview-modal-box inspection-modal-box">
            <div className="preview-modal-header">
              <span className="badge-preview">Cryptographic Inquest Deep Audit Report</span>
              <h3>Results Analytics Deep Inspection</h3>
              <button className="close-preview-btn" onClick={() => setInspectedElection(null)}>✕ Close Report</button>
            </div>

            <div className="inspection-modal-body">
              <div className="inspection-overview-header">
                <h2>{inspectedElection.name}</h2>
                <p>Election ID: <strong>{inspectedElection.id}</strong> | Type: <strong>{inspectedElection.type}</strong></p>
                <div className="turnout-ratios-summary">
                  <div className="ratio-tile"><span>Registered voters:</span><strong>{inspectedElection.voters}</strong></div>
                  <div className="ratio-tile"><span>Votes recorded:</span><strong>{inspectedElection.votesCast}</strong></div>
                  <div className="ratio-tile"><span>Turnout index:</span><strong>{inspectedElection.voters > 0 ? Math.round((inspectedElection.votesCast / inspectedElection.voters)*100) : 0}%</strong></div>
                </div>
              </div>

              <div className="inspection-columns-layout">
                {/* Left column */}
                <div className="inspection-col-left">
                  <h4>Candidate Information Directory</h4>
                  <div className="inspection-candidates-list">
                    {candidates.filter(c => c.electionId === inspectedElection.id).map(c => (
                      <div key={c.id} className="inspect-candidate-row">
                        <div className="avatar-circle">{c.name.split(' ').map(x=>x[0]).join('')}</div>
                        <div className="meta">
                          <span className="n"><strong>{c.name}</strong></span>
                          <span className="d">{c.dept} · Roll: {c.rollNo}</span>
                          <p className="manifesto">"{c.manifesto}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right column */}
                <div className="inspection-col-right">
                  <h4>Numeric Vote Allocations</h4>
                  <div className="vote-distribution-graph">
                    {candidates.filter(c => c.electionId === inspectedElection.id).map(c => {
                      const pct = inspectedElection.votesCast > 0 ? Math.round((c.votes / inspectedElection.votesCast)*100) : 0;
                      return (
                        <div key={c.id} className="inspect-vote-bar-row">
                          <div className="bar-labels">
                            <span>{c.name}</span>
                            <span><strong>{c.votes} votes</strong> ({pct}%)</span>
                          </div>
                          <div className="inspect-bar-track">
                            <div className="inspect-bar-fill" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {inspectedElection.draw && (
                    <div className="inspection-override-actions-card">
                      <h4><IconAlertTriangle size={18}/> Imbalance Resolution Cockpit</h4>
                      <p>Equal allocations detected. High-privilege override operations are required to close the ledger.</p>
                      
                      <div className="override-action-buttons">
                        <button className="btn-action-sm gold" onClick={() => handleDeclareJointWinners(inspectedElection.id)}>
                          Declare Joint Winners
                        </button>
                        <button className="btn-action-sm danger" onClick={() => handleReopenElection(inspectedElection.id)}>
                          Re-Open Target Election Framework
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
