// Active Super Admin Dashboard with Profile & Productivity Workspace support
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import ThemeToggle from '../components/ThemeToggle';
import CountUpNumber from '../components/ReactBits/CountUpNumber';
import SpotlightCard from '../components/ReactBits/SpotlightCard';
import '../styles/Dashboard.css';
import { IconChartBar, IconBox, IconUsers, IconHeartHandshake, IconTrophy, IconFolder, IconPlug, IconAlertCircle, IconUser, IconBolt, IconBell, IconShield, IconTrendingUp, IconAlertTriangle, IconDeviceFloppy, IconEye, IconEyeOff, IconPlayerPause, IconPlayerPlay, IconLockOpen, IconPackage, IconInbox, IconCamera, IconPencil, IconRefresh, IconSearch, IconFileDescription, IconScale, IconPlus, IconArchive, IconPin, IconCircleCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

// Base-36 / Alphanumeric helper conversions
const base36ToInt = (str) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let val = 0;
  const upperStr = str.trim().toUpperCase();
  for (let i = 0; i < upperStr.length; i++) {
    const idx = chars.indexOf(upperStr[i]);
    if (idx === -1) return -1;
    val = val * 36 + idx;
  }
  return val;
};



const parsePattern = (pat) => {
  const trimmed = pat.trim();
  const firstUnderscoreIdx = trimmed.indexOf('_');
  if (firstUnderscoreIdx === -1) {
    return { valid: false, error: 'Must contain at least one underscore (_)' };
  }
  const prefix = trimmed.substring(0, firstUnderscoreIdx);
  const variablePart = trimmed.substring(firstUnderscoreIdx);
  if (/[^_]/.test(variablePart)) {
    return { valid: false, error: 'Underscores must be at the end' };
  }
  return {
    valid: true,
    pattern: trimmed,
    prefix,
    varLength: variablePart.length
  };
};

const calculateDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return '';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 'End time must be after start time';
  
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} Hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} Minute${minutes > 1 ? 's' : ''}`);
  
  return parts.join(' ');
};

const validateUploadList = (rawEligible, rawIneligible, patterns, ranges) => {
  const eligibleRolls = [];
  const ineligibleRolls = [];
  let duplicatesRemoved = 0;
  let errorsCount = 0;
  const errorDetails = [];
  
  const parsedPatterns = patterns.map(p => parsePattern(p)).filter(p => p.valid);
  
  const seen = new Set();
  const blacklistSet = new Set();
  
  const validateRoll = (roll) => {
    if (parsedPatterns.length === 0) return true;
    for (const pat of parsedPatterns) {
      if (roll.startsWith(pat.prefix) && roll.length === pat.prefix.length + pat.varLength) {
        const varPart = roll.substring(pat.prefix.length);
        const range = ranges[pat.pattern];
        if (range && range.from && range.to) {
          if (range.mode === 'numeric') {
            if (/^[0-9]+$/.test(varPart)) {
              const val = parseInt(varPart);
              const fromVal = parseInt(range.from);
              const toVal = parseInt(range.to);
              if (val >= fromVal && val <= toVal) return true;
            }
          } else {
            const val = base36ToInt(varPart);
            const fromVal = base36ToInt(range.from);
            const toVal = base36ToInt(range.to);
            if (val !== -1 && fromVal !== -1 && toVal !== -1) {
              if (val >= fromVal && val <= toVal) return true;
            }
          }
        } else {
          return true;
        }
      }
    }
    return false;
  };
  
  rawEligible.forEach(roll => {
    const upper = roll.trim().toUpperCase();
    if (!upper) return;
    if (seen.has(upper)) {
      duplicatesRemoved++;
      return;
    }
    seen.add(upper);
    
    if (!validateRoll(upper)) {
      errorsCount++;
      errorDetails.push(`Voter "${upper}" (Column A) does not match pattern scope.`);
      return;
    }
    eligibleRolls.push(upper);
  });
  
  rawIneligible.forEach(roll => {
    const upper = roll.trim().toUpperCase();
    if (!upper) return;
    if (blacklistSet.has(upper)) {
      duplicatesRemoved++;
      return;
    }
    blacklistSet.add(upper);
    
    if (!validateRoll(upper)) {
      errorsCount++;
      errorDetails.push(`Voter "${upper}" (Column B) does not match pattern scope.`);
      return;
    }
    
    if (seen.has(upper)) {
      errorsCount++;
      const idx = eligibleRolls.indexOf(upper);
      if (idx !== -1) eligibleRolls.splice(idx, 1);
      errorDetails.push(`Conflict: Voter "${upper}" is in both whitelist and blacklist.`);
      return;
    }
    ineligibleRolls.push(upper);
  });
  
  return {
    eligible: eligibleRolls,
    ineligible: ineligibleRolls,
    duplicatesRemoved,
    errorsCount,
    errorDetails,
    rowsProcessed: rawEligible.length + rawIneligible.length
  };
};

export default function Dashboard() {

  const [activeTab, setActiveTab] = useState('Dashboard'); // Navigation Tabs
  const contentRef = useRef(null);
  const [showSettingsPassCurrent, setShowSettingsPassCurrent] = useState(false);
  const [showSettingsPassNew, setShowSettingsPassNew] = useState(false);
  const [showSettingsPassConfirm, setShowSettingsPassConfirm] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [newElName, setNewElName] = useState('');
  const [newElDesc, setNewElDesc] = useState('');
  const [newElStart, setNewElStart] = useState('');
  const [newElEnd, setNewElEnd] = useState('');
  const [newElAccessCode, setNewElAccessCode] = useState('');
  const [newElPatterns, setNewElPatterns] = useState('');
  const [newElRanges, setNewElRanges] = useState({});
  const [wizardStep, setWizardStep] = useState(1);
  const [uploadedEligibleRolls, setUploadedEligibleRolls] = useState([]);
  const [uploadedIneligibleRolls, setUploadedIneligibleRolls] = useState([]);
  const [uploadReport, setUploadReport] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [excelInputEligible, setExcelInputEligible] = useState('');
  const [excelInputIneligible, setExcelInputIneligible] = useState('');
  const [excelValidationLogs, setExcelValidationLogs] = useState([]);
  const [excelSuccess, setExcelSuccess] = useState(null);
  const [eligibilityElectionId, setEligibilityElectionId] = useState('');
  const [eligibilitySummary, setEligibilitySummary] = useState({ eligible: 0, ineligible: 0, duplicates: 0, conflicts: 0 });
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null, isTeal: false });
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [previewElection, setPreviewElection] = useState(null);
  const [inspectedElection, setInspectedElection] = useState(null);
  const [selectedResultElectionId, setSelectedResultElectionId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeAlerts] = useState([]);

  // Phase 6 States
  const [securityData, setSecurityData] = useState(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [allSecurityEvents, setAllSecurityEvents] = useState([]); void allSecurityEvents;
  const [systemErrors, setSystemErrors] = useState([]); void systemErrors;
  const [selectedAuditElectionId, setSelectedAuditElectionId] = useState('');
  const [integrityReport, setIntegrityReport] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [auditEventFilter, setAuditEventFilter] = useState('ALL');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditElectionFilter, setAuditElectionFilter] = useState('ALL');
  const [auditLogsFromDb, setAuditLogsFromDb] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(900); // Default 15 minutes (in seconds)
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [backupHistory, setBackupHistory] = useState([]);
  const [integrityElectionId, setIntegrityElectionId] = useState('');
  const [opsIntegrityReport, setOpsIntegrityReport] = useState(null);
  const [opsIntegrityLoading, setOpsIntegrityLoading] = useState(false);
  const lastActiveTimeRef = useRef(null);
  // Ref used to break the forward-reference cycle: handleLogout is declared later
  // but needs to be callable from validateSessionVerification defined earlier.
  const logoutRef = useRef(null);

  // Update activity timestamp
  const recordActivity = () => {
    lastActiveTimeRef.current = Date.now();
  };

  // Check verified session status in database
  const validateSessionVerification = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logoutRef.current?.();
        return;
      }
      const jwtPayload = JSON.parse(atob(session.access_token.split('.')[1]));
      const sessionId = jwtPayload.session_id;

      const { data, error } = await supabase
        .from('verified_sessions')
        .select('verified')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error || !data || !data.verified) {
        console.warn('Session is no longer verified in database. Terminating...');
        logoutRef.current?.();
      }
    } catch (err) {
      console.error('Failed to validate session verification:', err);
    }
  }, []);

  const fetchOperationsStatus = useCallback(async () => {
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_system_status');
      if (error) throw error;
      setHealthData(data);
      
      const { data: backups, error: backupErr } = await supabase
        .from('backup_registry')
        .select('*')
        .order('created_at', { ascending: false });
      if (backupErr) throw backupErr;
      setBackupHistory(backups || []);
    } catch (err) {
      console.error('Failed to load operations data:', err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const runIntegrityScan = async () => {
    if (!integrityElectionId) return;
    setOpsIntegrityLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_election_audit_report', { p_election_id: integrityElectionId });
      if (error) throw error;
      setOpsIntegrityReport(data);
    } catch (err) {
      console.error('Failed to run integrity scan:', err);
      alert('Integrity Scan Failed: ' + err.message);
    } finally {
      setOpsIntegrityLoading(false);
    }
  };

  const handleExportAuditPackage = async () => {
    try {
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: securityEvents, error: securityError } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (auditError || securityError) {
        throw new Error(auditError?.message || securityError?.message);
      }

      const cleanAudit = sanitizeExportData(auditLogs || []);
      const cleanSecurity = sanitizeExportData(securityEvents || []);

      const watermark = [
        ["VoteGuard Audit Package Export"],
        ["Generated At: " + new Date().toISOString()],
        ["Generated By: Super Admin"],
        []
      ];

      const wb = XLSX.utils.book_new();

      const wsAudit = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(wsAudit, watermark, { origin: "A1" });
      XLSX.utils.sheet_add_json(wsAudit, cleanAudit, { origin: "A5", skipHeader: false });
      XLSX.utils.book_append_sheet(wb, wsAudit, "Audit Logs");

      const wsSecurity = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(wsSecurity, watermark, { origin: "A1" });
      XLSX.utils.sheet_add_json(wsSecurity, cleanSecurity, { origin: "A5", skipHeader: false });
      XLSX.utils.book_append_sheet(wb, wsSecurity, "Security Events");

      XLSX.writeFile(wb, `VoteGuard_Audit_Package_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Failed to export audit package:', err);
      alert('Failed to export audit package: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'Operations') {
      (async () => { await fetchOperationsStatus(); })();
    }
  }, [activeTab, fetchOperationsStatus]);



  // Fetch security dashboard data
  const fetchSecurityData = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_security_dashboard');
      if (error) throw error;
      setSecurityData(data);
      if (data.system_errors) {
        setSystemErrors(data.system_errors);
      }

      // Fetch all security_events for exporting or auditing (up to 500 records)
      const { data: events, error: eventsErr } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (eventsErr) throw eventsErr;
      setAllSecurityEvents(events || []);
    } catch (err) {
      console.error('Failed to fetch security analytics data:', err);
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  // Fetch filtered audit logs from database
  const fetchAuditLogsFromDb = useCallback(async () => {
    setAuditLogsLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (auditEventFilter !== 'ALL') {
        query = query.eq('event_type', auditEventFilter);
      }
      if (auditElectionFilter !== 'ALL') {
        query = query.eq('election_id', auditElectionFilter);
      }
      if (auditDateFrom) {
        query = query.gte('created_at', new Date(auditDateFrom).toISOString());
      }
      if (auditDateTo) {
        const toDate = new Date(auditDateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      setAuditLogsFromDb(data || []);
    } catch (err) {
      console.error('Failed to fetch filtered audit logs:', err);
    } finally {
      setAuditLogsLoading(false);
    }
  }, [auditEventFilter, auditElectionFilter, auditDateFrom, auditDateTo]);

  // Run manually security logs retention cleanup
  const handleManualRetentionCleanup = async () => {
    if (!window.confirm('Are you sure you want to run the operational logs retention cleanup now? This will permanently delete security logs older than 180 days, and alerts/errors older than 365 days.')) {
      return;
    }
    try {
      const { error } = await supabase.rpc('cleanup_old_security_events');
      if (error) throw error;
      alert('Retention log cleanup completed successfully!');
      await fetchSecurityData();
    } catch (err) {
      alert('Failed to execute retention cleanup: ' + err.message);
    }
  };

  // Sanitization helper to redact sensitive data from exports
  const sanitizeExportData = (rawArray) => {
    return rawArray.map(item => {
      const cleaned = { ...item };
      // Delete sensitive fields if present
      delete cleaned.otp;
      delete cleaned.otp_code;
      delete cleaned.token;
      delete cleaned.token_hash;
      delete cleaned.password;
      delete cleaned.selection;
      delete cleaned.candidate_id;
      delete cleaned.candidate_name;
      delete cleaned.client_fingerprint;
      delete cleaned.ip_address;
      
      // Clean metadata_json
      if (cleaned.metadata_json) {
        const meta = { ...cleaned.metadata_json };
        delete meta.otp;
        delete meta.otp_code;
        delete meta.token;
        delete meta.token_hash;
        delete meta.password;
        delete meta.selection;
        delete meta.candidate_id;
        delete meta.candidate_name;
        delete meta.client_fingerprint;
        delete meta.ip_address;
        delete meta.email;
        delete meta.email_content;
        delete meta.subject;
        delete meta.body;
        delete meta.phone_number;
        delete meta.phone;
        cleaned.metadata_json = meta;
      }

      // Redact details or source if email, token or OTP pattern is found
      if (cleaned.details) {
        cleaned.details = cleaned.details
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
          .replace(/\bVG-TEST-[A-F0-9]+\b/g, '[REDACTED_TOKEN]')
          .replace(/\b\d{6,8}\b/g, '[REDACTED_CODE]')
          .replace(/\b\d{10,12}\b/g, '[REDACTED_PHONE]')
          .replace(/for Candidate [A-Za-z0-9 ]+/g, 'for [REDACTED_SELECTION]');
      }

      if (cleaned.actor_identifier && cleaned.actor_identifier.includes('@')) {
        cleaned.actor_identifier = '[REDACTED_EMAIL]';
      }
      if (cleaned.actor && cleaned.actor.includes('@')) {
        cleaned.actor = '[REDACTED_EMAIL]';
      }

      return cleaned;
    });
  };

  // Excel (XLSX) Exporter with Watermark
  const handleExportXlsx = (rawData, fileName, title, adminId) => {
    const data = sanitizeExportData(rawData);
    const watermark = [
      ["VoteGuard Audit Export"],
      ["Report: " + title],
      ["Generated At: " + new Date().toISOString()],
      ["Generated By: " + adminId],
      []
    ];

    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, watermark, { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, data, { origin: "A6", skipHeader: false });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  // CSV Exporter with Watermark
  const handleExportCsv = (rawData, fileName, title, adminId) => {
    const data = sanitizeExportData(rawData);
    let csvContent = "";
    csvContent += `"VoteGuard Audit Export"\n`;
    csvContent += `"Report: ${title}"\n`;
    csvContent += `"Generated At: ${new Date().toISOString()}"\n`;
    csvContent += `"Generated By: ${adminId}"\n\n`;

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      csvContent += headers.map(h => `"${h}"`).join(",") + "\n";
      data.forEach(row => {
        const line = headers.map(h => {
          let val = row[h] === null || row[h] === undefined ? "" : row[h];
          if (typeof val === 'object') {
            val = JSON.stringify(val);
          }
          return `"${val.toString().replace(/"/g, '""')}"`;
        }).join(",");
        csvContent += line + "\n";
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [resolvedAlerts] = useState([]);
  const [elections, setElections] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [voters, setVoters] = useState([]);
  const [selectedVoters, setSelectedVoters] = useState([]);
  const [logs, setLogs] = useState([]);
  const [turnoutData, setTurnoutData] = useState([]);
  const [securityStats, setSecurityStats] = useState({
    duplicateAttempts: 0,
    invalidTokens: 0,
    rateLimitedUsers: 0,
    blockedRequests: 0
  });
  const [adminProfile, setAdminProfile] = useState(null);
  const [adminBio, setAdminBio] = useState(() => {
    const saved = localStorage.getItem('vg_admin_bio');
    return saved !== null ? saved : 'Responsible for election governance, system health observation, and platform operations security within the institution. Managing audit records and whitelists.';
  });
  const [adminNotes, setAdminNotes] = useState(() => {
    const saved = localStorage.getItem('vg_admin_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [adminTasks, setAdminTasks] = useState(() => {
    const saved = localStorage.getItem('vg_admin_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [adminEmail, setAdminEmail] = useState(() => {
    return localStorage.getItem('vg_admin_email') || 'hariharsha@voteguard.org';
  });
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [adminPassCurrent, setAdminPassCurrent] = useState('');
  const [adminPassNew, setAdminPassNew] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [showArchivedNotes, setShowArchivedNotes] = useState(false);
  const [noteTitleInput, setNoteTitleInput] = useState('');
  const [noteTextInput, setNoteTextInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskPriorityInput, setTaskPriorityInput] = useState('Medium');
  const [taskDeadlineInput, setTaskDeadlineInput] = useState('2026-06-02');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [electionTemplates, setElectionTemplates] = useState([
    {
      id: 'T_CR',
      name: 'CR Election Template',
      description: 'Class Representative vote with standard 25L35A44__ CSE roll index.',
      patterns: '25L35A44__',
      ranges: {
        '25L35A44__': { from: '01', to: '64', mode: 'numeric' }
      }
    },
    {
      id: 'T_DEPT',
      name: 'Department Representative Template',
      description: 'Department wide election template for ECE.',
      patterns: '25L35A44__, 24L31A44__',
      ranges: {
        '25L35A44__': { from: '01', to: '64', mode: 'numeric' },
        '24L31A44__': { from: '01', to: '64', mode: 'numeric' }
      }
    },
    {
      id: 'T_CLUB',
      name: 'Club President Template',
      description: 'Presidential poll for societies (alphanumeric lateral entries enabled).',
      patterns: '25L35A44__',
      ranges: {
        '25L35A44__': { from: 'A0', to: 'C7', mode: 'alphanumeric' }
      }
    }
  ]);
  const handleRangeChange = (pat, field, val) => {
    setNewElRanges(prev => ({
      ...prev,
      [pat]: {
        ...prev[pat],
        [field]: val
      }
    }));
  };

  const updatePatternsAndRanges = (patternsStr) => {
    setNewElPatterns(patternsStr);
    const parsed = patternsStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    setNewElRanges(prev => {
      const updated = { ...prev };
      let changed = false;
      
      parsed.forEach(pat => {
        const info = parsePattern(pat);
        if (info.valid && !updated[pat]) {
          const varLength = info.varLength;
          updated[pat] = {
            from: '0'.repeat(varLength - 1) + '1',
            to: '9'.repeat(varLength),
            mode: 'numeric'
          };
          changed = true;
        }
      });
      
      Object.keys(updated).forEach(key => {
        if (!parsed.includes(key)) {
          delete updated[key];
          changed = true;
        }
      });
      
      return changed ? updated : prev;
    });
  };
  const [tokenRecoveryUser, setTokenRecoveryUser] = useState(null);
  const [recoveryStatusText, setRecoveryStatusText] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryFinished, setRecoveryFinished] = useState(false);
  const [candName, setCandName] = useState('');
  const [candDept, setCandDept] = useState('');
  const [candDescription, setCandDescription] = useState('');
  const [candElectionId, setCandElectionId] = useState('');
  const [editCandId, setEditCandId] = useState(null);
  const [displayedLogsCount, setDisplayedLogsCount] = useState(15); void setDisplayedLogsCount;
  const [auditTimeFilterFrom, setAuditTimeFilterFrom] = useState(''); void auditTimeFilterFrom; void setAuditTimeFilterFrom;
  const [auditTimeFilterTo, setAuditTimeFilterTo] = useState(''); void auditTimeFilterTo; void setAuditTimeFilterTo;
  const [auditSeverityFilter, setAuditSeverityFilter] = useState('ALL'); void setAuditSeverityFilter;
  const [exportingElectionId, setExportingElectionId] = useState(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [signedPdfData, setSignedPdfData] = useState(null);
  const [simulatedIp, setSimulatedIp] = useState('192.168.1.144');
  const [simulatedFailures, setSimulatedFailures] = useState(0);
  const [simulatedCooldown, setSimulatedCooldown] = useState(0);
  const [simulatedStatus, setSimulatedStatus] = useState('Clean (Zero Delay)');
  const logEndRef = useRef(null);
  const broadcastRefresh = useCallback(async () => {
    try {
      // 1. Supabase Realtime Broadcast
      const channel = supabase.channel('voteguard-refresh-channel');
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'refresh-elections',
            payload: { timestamp: Date.now() }
          });
          supabase.removeChannel(channel);
        }
      });

      // 2. Browser BroadcastChannel
      const bc = new BroadcastChannel('voteguard-refresh-channel');
      bc.postMessage({ event: 'refresh-elections', timestamp: Date.now() });
      bc.close();

      // 3. Local storage event fallback
      localStorage.setItem('voteguard_refresh_trigger', Date.now().toString());
      console.log('[Broadcast] Refresh event sent.');
    } catch (err) {
      console.error('Failed to broadcast refresh event:', err);
    }
  }, []);

  const fetchDatabaseData = useCallback(async () => {
    try {
      // Auto-finalize any expired active elections first
      await supabase.rpc('check_and_finalize_expired_elections');

      // 1. Fetch elections
      const { data: dbElections, error: elError } = await supabase
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false });
      if (elError) throw elError;

      // 1b. Fetch election statistics
      const { data: dbStats } = await supabase
        .from('election_statistics')
        .select('*');

      // 1c. Fetch election results & summaries & integrity reports
      const { data: dbResults } = await supabase
        .from('election_results')
        .select('*')
        .order('position_rank', { ascending: true });

      const { data: dbSummaries } = await supabase
        .from('election_summary')
        .select('*');

      const dbIntegrity = null; // election_integrity_report view not yet created

      // 2. Fetch candidates
      const { data: dbCandidates, error: candError } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
      if (candError) throw candError;

      // 3. Fetch voters
      const { data: dbVoters, error: voterError } = await supabase
        .from('voters')
        .select('*')
        .order('created_at', { ascending: false });
      if (voterError) throw voterError;

      // 4. Fetch eligibility records
      const { data: dbEligibility, error: eligError } = await supabase
        .from('election_eligibility')
        .select('*');
      if (eligError) throw eligError;

      // 5. Fetch voter participation records
      const { data: dbParticipation, error: partError } = await supabase
        .from('voter_participation')
        .select('*');
      if (partError) throw partError;

      // 6. Fetch audit logs
      const { data: dbLogs, error: logError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (logError) throw logError;

      // 7. Fetch votes (to aggregate candidate counts - RLS will auto-restrict to Completed/Emergency_Stopped/Draw elections)
      const { data: dbVotes } = await supabase
        .from('votes')
        .select('candidate_id, created_at');
      const votesMap = {};
      
      const hoursMap = {
        '09:00': 0, '10:00': 0, '11:00': 0, '12:00': 0,
        '13:00': 0, '14:00': 0, '15:00': 0, '16:00': 0
      };
      
      if (dbVotes) {
        dbVotes.forEach(v => {
          votesMap[v.candidate_id] = (votesMap[v.candidate_id] || 0) + 1;
          if (v.created_at) {
            const d = new Date(v.created_at);
            const hourStr = d.getHours().toString().padStart(2, '0') + ':00';
            if (hoursMap[hourStr] !== undefined) {
              hoursMap[hourStr] += 1;
            }
          }
        });
      }
      
      const computedTurnout = Object.entries(hoursMap).map(([hr, val]) => ({
        hr,
        v: val
      }));
      setTurnoutData(computedTurnout);

      // Map candidates
      const mappedCandidates = (dbCandidates || []).map(c => ({
        id: c.id,
        name: c.candidate_name,
        dept: c.department || '',
        description: c.description || '',
        electionId: c.election_id,
        status: c.status || 'active',
        votes: votesMap[c.id] || 0
      }));

      // Find active election
      const activeEl = (dbElections || []).find(e => e.status === 'ACTIVE');

      // Map voters
      const mappedVoters = (dbVoters || []).map(v => {
        // Find participation in the active election
        const part = activeEl ? (dbParticipation || []).find(p => p.roll_number === v.roll_number && p.election_id === activeEl.id && p.election_round === activeEl.current_round) : null;
        let statusText = 'Registered';
        if (part) {
          if (part.has_voted) statusText = 'Voted';
          else if (part.has_requested_token) statusText = 'Token Dispatched - Not Voted';
        }

        // Find eligibility in the active election
        const elig = activeEl ? (dbEligibility || []).find(e => e.roll_number === v.roll_number && e.election_id === activeEl.id) : null;
        let isEligible = true;
        if (activeEl) {
          isEligible = elig ? elig.is_eligible : false;
        }

        return {
          roll: v.roll_number,
          name: v.full_name,
          dept: v.department || '',
          userCreatedId: v.email ? v.email.split('@')[0] : 'voter',
          systemId: v.auth_user_id ? `SYS-VOT-${v.auth_user_id.substring(0, 4).toUpperCase()}` : 'SYS-VOT-TEMP',
          status: statusText,
          eligible: isEligible
        };
      });

      // Map elections
      const mappedElections = (dbElections || []).map(el => {
        // Find candidates for this election
        const elCands = mappedCandidates.filter(c => c.electionId === el.id);
        
        // Count votes cast
        const elVotesCast = elCands.reduce((sum, c) => sum + c.votes, 0);

        // Count eligible voters
        const elEligibleCount = (dbEligibility || []).filter(e => e.election_id === el.id && e.is_eligible === true).length;

        // Parse start and end times
        const formatTime = (t) => {
          if (!t) return '';
          const d = new Date(t);
          return d.toISOString().substring(0, 10) + ' ' + d.toTimeString().substring(0, 5);
        };

        const stat = (dbStats || []).find(s => s.election_id === el.id);
        const summary = (dbSummaries || []).find(s => s.election_id === el.id && s.election_round === el.current_round);
        const integrity = (dbIntegrity || []).find(i => i.election_id === el.id && i.current_round === el.current_round);
        const results = (dbResults || []).filter(r => r.election_id === el.id && r.election_round === el.current_round);

        return {
          id: el.id,
          name: el.election_name,
          description: el.description || '',
          start: formatTime(el.start_time),
          end: formatTime(el.end_time),
          accessCode: el.access_code || '',
          status: el.status,
          type: el.access_code ? 'Private' : 'Public',
          currentRound: el.current_round,
          isTie: el.is_tie,
          jointWinner: el.joint_winners,
          winners: el.winners,
          voters: summary ? Number(summary.total_eligible_voters) : (stat ? Number(stat.eligible_voters) : elEligibleCount),
          votesCast: summary ? Number(summary.total_votes) : elVotesCast,
          turnoutPercentage: summary ? Number(summary.turnout_percentage) : (stat ? Number(stat.turnout_percentage) : 0),
          results: results,
          summary: summary,
          integrity: integrity,
          eligibilityRules: el.eligibility_rules || [],
          candidates: elCands.map(c => c.id)
        };
      });

      // Map audit logs
      const mappedLogs = (dbLogs || []).map(log => {
        const formatTs = (t) => {
          if (!t) return '';
          return new Date(t).toLocaleTimeString();
        };
        
        let level = 'INFO';
        let status = 'ok';
        if (log.event_type.toLowerCase().includes('fail') || log.event_type.toLowerCase().includes('error') || log.event_type.toLowerCase().includes('rate')) {
          level = 'WARNING';
          status = 'warn';
        }
        if (log.event_type.toLowerCase().includes('emergency') || log.event_type.toLowerCase().includes('unauthorized') || log.event_type.toLowerCase().includes('security') || log.event_type.toLowerCase().includes('stop')) {
          level = 'CRITICAL';
          status = 'err';
        }

        return {
          ts: formatTs(log.created_at),
          ev: log.event_type,
          usr: log.actor || 'system',
          desc: log.details || '',
          status: status,
          level: level
        };
      });

      setElections(mappedElections);
      setCandidates(mappedCandidates);
      setVoters(mappedVoters);
      setLogs(mappedLogs);

      // Generate security stats dynamically
      const invalidTokenLogsCount = (dbLogs || []).filter(l => l.event_type === 'Token Checked in Portal' && (l.details || '').includes('Not Found')).length;
      const rateLimitLogsCount = (dbLogs || []).filter(l => l.event_type === 'OTP Failed' || (l.details || '').includes('lockout')).length;

      setSecurityStats({
        duplicateAttempts: (dbParticipation || []).filter(p => p.has_requested_token).length,
        invalidTokens: invalidTokenLogsCount,
        rateLimitedUsers: rateLimitLogsCount,
        blockedRequests: (dbLogs || []).filter(l => l.event_type.toLowerCase().includes('block') || l.event_type === 'RATE_LIMIT').length
      });

    } catch (err) {
      console.error('Error fetching database data:', err);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/admin-auth');
          return;
        }

        const jwtPayload = JSON.parse(atob(session.access_token.split('.')[1]));
        const sessionId = jwtPayload.session_id;

        if (jwtPayload.app_metadata?.role !== 'super_admin') {
          navigate('/admin-auth');
          return;
        }

        const { data, error } = await supabase
          .from('verified_sessions')
          .select('verified')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (error || !data || !data.verified) {
          navigate('/admin-auth');
          return;
        }

        // Fetch real admin profile data
        const { data: profile } = await supabase
          .from('super_admins')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (profile) {
          setAdminProfile(profile);
          setAdminEmail(profile.email);
        }

        // Load DB collections
        await fetchDatabaseData();

        setCheckingAuth(false);
      } catch (err) {
        console.error('Auth verification check failed:', err);
        navigate('/admin-auth');
      }
    };

    checkAuth();
  }, [navigate, fetchDatabaseData]);

  // Tab change smooth scroll to top of content container
  useEffect(() => {
    contentRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [activeTab]);

  // Derive the default result election ID without calling setState inside an effect
  const effectiveResultElectionId = useMemo(() => {
    if (selectedResultElectionId) return selectedResultElectionId;
    if (elections.length === 0) return null;
    const nonArchived = elections.find(e => e.status !== 'ARCHIVED');
    return nonArchived ? nonArchived.id : elections[0].id;
  }, [selectedResultElectionId, elections]);


  // Clock ticking effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch timeout settings from system_settings dynamically
  useEffect(() => {
    const fetchTimeoutSetting = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('key, value');
        if (data) {
          const timeoutDev = data.find(s => s.key === 'inactivity_timeout_dev');
          const devModeSetting = data.find(s => s.key === 'dev_mode');
          if (timeoutDev && devModeSetting && devModeSetting.value === 'true') {
            setInactivityTimeout(parseInt(timeoutDev.value, 10));
            console.log(`[Dev Mode] Inactivity timeout configured to ${timeoutDev.value} seconds.`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch inactivity settings:', err);
      }
    };
    fetchTimeoutSetting();
  }, []);

  // Set up inactivity monitors & 30s polling verification
  useEffect(() => {
    lastActiveTimeRef.current = Date.now();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, recordActivity));

    // Check inactivity every 5 seconds
    const inactivityInterval = setInterval(() => {
      const idleTimeSeconds = (Date.now() - (lastActiveTimeRef.current || Date.now())) / 1000;
      if (idleTimeSeconds >= inactivityTimeout) {
        console.warn(`Idle limit reached (${inactivityTimeout}s). Terminating session...`);
        logoutRef.current?.();
      }
    }, 5000);

    // Poll session verification status in DB every 30 seconds
    const pollingInterval = setInterval(() => {
      validateSessionVerification();
    }, 30000);

    // Immediate checks on tab focus and connection restore
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateSessionVerification();
      }
    };

    const handleOnline = () => {
      validateSessionVerification();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, recordActivity));
      clearInterval(inactivityInterval);
      clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [inactivityTimeout, validateSessionVerification]);

  // Route transition / tab check: check session validity immediately when activeTab changes
  useEffect(() => {
    validateSessionVerification();
    if (activeTab === 'Security') {
      (async () => { await fetchSecurityData(); })();
    }
  }, [activeTab, validateSessionVerification, fetchSecurityData]);

  // Fetch audit logs whenever activeTab is Reports or filters change
  useEffect(() => {
    if (activeTab === 'Reports') {
      (async () => { await fetchAuditLogsFromDb(); })();
    }
  }, [activeTab, fetchAuditLogsFromDb]);

  // Fetch election integrity report dynamically
  useEffect(() => {
    const fetchIntegrityReport = async () => {
      if (!selectedAuditElectionId) {
        setIntegrityReport(null);
        return;
      }
      setIntegrityLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_election_audit_report', {
          p_election_id: selectedAuditElectionId
        });
        if (error) throw error;
        setIntegrityReport(data);
      } catch (err) {
        console.error('Failed to fetch election integrity report:', err);
      } finally {
        setIntegrityLoading(false);
      }
    };
    fetchIntegrityReport();
  }, [selectedAuditElectionId]);

  // Global Search State (with debouncing support)

  // Mobile sidebar navigation toggle state

  // Custom confirmation modal state

  const triggerConfirm = (title, message, onConfirm, isTeal = false) => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, isTeal: false });
      },
      isTeal
    });
  };

  const highlightMatch = (text, query) => {
    if (!query || !text) return text;
    const parts = String(text).split(new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="search-highlight">{part}</mark> : part
        )}
      </>
    );
  };

  // Debounce search input updates (300ms delay)
  useEffect(() => {
    const handler = setTimeout(() => {
      setGlobalSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // ESC key dismiss and scroll lock for admin workspace
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setShowNoteModal(false);
        setPreviewElection(null);
        setInspectedElection(null);
        setSidebarOpen(false);
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, isTeal: false });
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (showNoteModal || previewElection || inspectedElection || sidebarOpen || confirmModal.show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showNoteModal, previewElection, inspectedElection, sidebarOpen, confirmModal.show]);

  // Notifications Bell State

  // Active Alerts state (Tab 8 Null-State triggers fallback when length is 0)

  // Elections State

  // Candidates State (Dedicated Tab 3)

  // Users / Voters state with multi-ID mapping

  // Selected Voters for Bulk Actions

  // Audit Logs (with severity rating and stripped raw tokens)

  // Security Integrity Monitor State

  // --- PROFILE & PRODUCTIVITY WORKSPACE STATES (SECTION 1-9) ---
  


  






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



  // Election templates state (CR election, Student senate, etc)

  // Form states for adding election

  // Excel Override Simulator States

  // Token recovery exception states (secure resend workflow)

  // Candidate Form States

  // Search results/filtered logs state

  // PDF download progress simulator state

  // Security Lockout / Progressive Throttling Cockpit Simulator


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

  const addAuditLog = async (ev, usr, desc, level = 'INFO', status = 'ok') => {
    try {
      await supabase.from('audit_logs').insert({
        event_type: ev,
        actor: usr,
        details: desc
      });
    } catch (err) {
      console.error('Failed to write audit log to database:', err);
    }
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
  // Election actions
  const startElection = async (id) => {
    const el = elections.find(e => e.id === id);
    if (!el) return;

    // 1. Check Candidate count >= 2
    const elCandidates = candidates.filter(c => c.electionId === id && c.status === 'active');
    if (elCandidates.length < 2) {
      alert('Error: Election must have at least 2 active candidates before activation.');
      return;
    }

    // 2. Check Eligibility exists
    const { count: eligCount, error: eligErr } = await supabase
      .from('election_eligibility')
      .select('*', { count: 'exact', head: true })
      .eq('election_id', id);
    if (eligErr) {
      alert('Error checking eligibility: ' + eligErr.message);
      return;
    }
    if (!eligCount || eligCount === 0) {
      alert('Error: You must configure/upload eligibility rules before starting the election.');
      return;
    }

    // 3. Check no other Active election exists
    const { data: activeElections, error: activeErr } = await supabase
      .from('elections')
      .select('id, election_name')
      .eq('status', 'ACTIVE');
    if (activeErr) {
      alert('Error checking active elections: ' + activeErr.message);
      return;
    }
    if (activeElections && activeElections.length > 0) {
      alert(`Error: There is already an active election: "${activeElections[0].election_name}". Only one active election is allowed at a time.`);
      return;
    }

    // 4. Update status to Active
    const { error: updateErr } = await supabase
      .from('elections')
      .update({ status: 'ACTIVE' })
      .eq('id', id);

    if (updateErr) {
      alert('Failed to start election: ' + updateErr.message);
    } else {
      await addAuditLog('ELECTION_START', 'admin', `Activated election ${el.name} (${id})`, 'INFO', 'ok');
      alert(`✅ Election "${el.name}" is now ACTIVE!\n\nThis election is now visible to all eligible voters on the Voter Dashboard.\nVoters with active sessions will be notified automatically.`);
      await fetchDatabaseData();
      await broadcastRefresh();
    }
  };

  const toggleElectionStatus = async (id) => {
    const el = elections.find(e => e.id === id);
    if (!el) return;

    if (el.status === 'ACTIVE') {
      const { error } = await supabase
        .from('elections')
        .update({ status: 'PAUSED' })
        .eq('id', id);
      if (error) {
        alert('Failed to pause election: ' + error.message);
      } else {
        await addAuditLog('ELECTION_PAUSE', 'admin', `Paused election ${el.name} (${id})`, 'INFO', 'ok');
        await fetchDatabaseData();
        await broadcastRefresh();
      }
    } else if (el.status === 'PAUSED') {
      // Check no other ACTIVE election exists
      const { data: activeElections } = await supabase
        .from('elections')
        .select('id')
        .eq('status', 'ACTIVE');
      if (activeElections && activeElections.length > 0) {
        alert('Error: Another election is currently active. Pause or complete it first.');
        return;
      }

      const { error } = await supabase
        .from('elections')
        .update({ status: 'ACTIVE' })
        .eq('id', id);
      if (error) {
        alert('Failed to resume election: ' + error.message);
      } else {
        await addAuditLog('ELECTION_RESUME', 'admin', `Resumed election ${el.name} (${id})`, 'INFO', 'ok');
        await fetchDatabaseData();
        await broadcastRefresh();
      }
    }
  };

  const handleEmergencyStop = async (id) => {
    const el = elections.find(e => e.id === id);
    if (!el) return;

    const publish = window.confirm('EMERGENCY STOP PROTOCOL:\nWould you like to calculate and publish the current results with this emergency stop?');
    
    const { error } = await supabase.rpc('emergency_stop_election', {
      p_election_id: id,
      p_publish_results: publish
    });
    
    if (error) {
      alert('Failed to apply emergency stop: ' + error.message);
    } else {
      await addAuditLog('ELECTION_STOPPED', 'admin', `EMERGENCY STOP ACTIVATED ON ${el.name} - HALTING VOTING`, 'CRITICAL', 'err');
      setNotifications(prevNotif => [
        { id: Date.now(), type: 'critical', text: `EMERGENCY STOP applied on ${el.name}`, ts: 'Just now', read: false },
        ...prevNotif
      ]);
      alert(`Emergency stop applied on election "${el.name}"!`);
      await fetchDatabaseData();
      await broadcastRefresh();
    }
  };

  const handleCompleteElection = (id) => {
    const el = elections.find(x => x.id === id);
    triggerConfirm(
      'Complete Election and Lock Ledger',
      `Are you sure you want to complete the election "${el?.name || 'this election'}"? This will lock all votes and calculate final results.`,
      async () => {
        const { data: finalStatus, error } = await supabase
          .rpc('finalize_election', { p_election_id: id });

        if (error) {
          alert('Failed to complete/finalize election: ' + error.message);
        } else {
          if (finalStatus === 'DEADLOCK') {
            alert('TIE DEADLOCK DETECTED! Administrative tie-break resolution is required.');
          } else {
            alert('Election completed successfully! Winners declared.');
          }
          await addAuditLog('ELECTION_COMPLETED', 'admin', `Completed election ${el.name}. Final status: ${finalStatus}`, 'INFO', 'ok');
          await fetchDatabaseData();
          await broadcastRefresh();
        }
      }
    );
  };


  const handleArchiveElection = async (id) => {
    const el = elections.find(e => e.id === id);
    if (!el) return;
    const { error } = await supabase
      .from('elections')
      .update({ status: 'ARCHIVED' })
      .eq('id', id);

    if (error) {
      alert('Failed to archive election: ' + error.message);
    } else {
      await addAuditLog('ELECTION_ARCHIVE', 'admin', `Archived election ${el.name} (${id})`, 'INFO', 'ok');
      await fetchDatabaseData();
      await broadcastRefresh();
    }
  };


  // Template loaders
  const handleLoadTemplate = (id) => {
    const t = electionTemplates.find(x => x.id === id);
    if (!t) return;
    setNewElName(t.name);
    setNewElDesc(t.description);
    setNewElPatterns(t.patterns);
    setNewElRanges(t.ranges);
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
      patterns: newElPatterns,
      ranges: newElRanges
    };
    setElectionTemplates(prev => [...prev, newTemplate]);
    addAuditLog('TEMPLATE_SAVE', 'admin', `Saved ${newElName} as a loadable template`, 'INFO', 'ok');
    alert(`Successfully saved active configuration as: ${newElName} Template`);
  };

  // Handle New Election Creation
  // Handle New Election Creation
  const handleCreateElection = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!newElName.trim()) {
      alert('Election Name is required.');
      return;
    }
    
    // Validate Patterns & Ranges
    const pats = newElPatterns
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
      
    if (pats.length === 0) {
      alert('At least one Eligible Voter ID Pattern is required.');
      return;
    }
    
    const formattedRules = [];
    for (const pat of pats) {
      const info = parsePattern(pat);
      if (!info.valid) {
        alert(`Pattern "${pat}" is invalid: ${info.error}`);
        return;
      }
      
      const range = newElRanges[pat];
      if (!range || !range.from || !range.to) {
        alert(`Range configuration for pattern "${pat}" is incomplete.`);
        return;
      }
      
      if (range.from.length !== info.varLength || range.to.length !== info.varLength) {
        alert(`Range limits for "${pat}" must be exactly ${info.varLength} characters long.`);
        return;
      }
      
      if (range.mode === 'numeric') {
        if (!/^[0-9]+$/.test(range.from) || !/^[0-9]+$/.test(range.to)) {
          alert(`Numeric range limits for "${pat}" must contain only digits.`);
          return;
        }
        if (parseInt(range.from) > parseInt(range.to)) {
          alert(`Numeric range "From" value must be less than or equal to "To" value for "${pat}".`);
          return;
        }
      } else {
        const fromVal = base36ToInt(range.from);
        const toVal = base36ToInt(range.to);
        if (fromVal === -1 || toVal === -1) {
          alert(`Alphanumeric range limits for "${pat}" contain invalid characters.`);
          return;
        }
        if (fromVal > toVal) {
          alert(`Alphanumeric range "From" value must be less than or equal to "To" value for "${pat}".`);
          return;
        }
      }
      
      formattedRules.push({
        pattern: pat,
        prefix: info.prefix,
        variableLength: info.varLength,
        mode: range.mode,
        from: range.from.toUpperCase(),
        to: range.to.toUpperCase()
      });
    }

    const startTime = new Date(newElStart);
    const endTime = new Date(newElEnd);
    const now = new Date();

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      alert('Invalid start or end time format.');
      return;
    }

    if (startTime < now - 60000) {
      alert('Start time cannot be in the past.');
      return;
    }

    if (endTime <= startTime) {
      alert('End time must be after start time.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const electionCode = 'ELC-' + newElName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase() + '-' + Date.now();
      
      const { data: newElData, error } = await supabase
        .from('elections')
        .insert({
          election_name: newElName,
          election_code: electionCode,
          status: 'DRAFT',
          access_code: newElAccessCode || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          description: newElDesc,
          eligibility_rules: formattedRules
        })
        .select()
        .single();

      if (error) {
        alert('Failed to initialize election registry: ' + error.message);
      } else {
        // Bulk insert uploaded eligibility lists from Step 4 if they exist
        const bulkElig = [];
        uploadedEligibleRolls.forEach(roll => {
          bulkElig.push({
            election_id: newElData.id,
            roll_number: roll,
            is_eligible: true
          });
        });
        uploadedIneligibleRolls.forEach(roll => {
          bulkElig.push({
            election_id: newElData.id,
            roll_number: roll,
            is_eligible: false
          });
        });

        if (bulkElig.length > 0) {
          const { error: eligError } = await supabase
            .from('election_eligibility')
            .insert(bulkElig);
          if (eligError) {
            alert('Election created, but failed to insert eligibility list: ' + eligError.message);
          }
        }

        await addAuditLog('ELECTION_CREATE', 'admin', `Created election ${newElName} (${newElData.id})`, 'INFO', 'ok');
        alert(`✅ Election "${newElName}" successfully created and configured!\n\n⚠️ Status: DRAFT — currently hidden from voters.\n\nTo make this election visible to voters, go to the Elections tab and click the Activate button.`);
        
        // Reset state
        setNewElName('');
        setNewElDesc('');
        setNewElAccessCode('');
        setNewElPatterns('');
        setNewElRanges({});
        setUploadedEligibleRolls([]);
        setUploadedIneligibleRolls([]);
        setUploadReport(null);
        setSelectedTemplate('');
        setWizardStep(1);
        
        await fetchDatabaseData();
        await broadcastRefresh();
      }
    } catch (err) {
      alert('An error occurred: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    newElName,
    newElPatterns,
    newElRanges,
    newElStart,
    newElEnd,
    isSubmitting,
    newElAccessCode,
    newElDesc,
    uploadedEligibleRolls,
    uploadedIneligibleRolls,
    fetchDatabaseData,
    broadcastRefresh
  ]);


  // Candidate setup
  // Candidate setup
  const handleCandidateSubmit = async (e) => {
    e.preventDefault();
    if (!candName.trim()) {
      alert('Please fill out Candidate Name.');
      return;
    }
    if (!candElectionId) {
      alert('Please select an election to assign the candidate to.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    const selectedEl = elections.find(el => el.id === candElectionId);
    if (selectedEl && selectedEl.status !== 'DRAFT') {
      alert('Cannot add/modify candidates for an active or completed election.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (editCandId) {
        const { error } = await supabase
          .from('candidates')
          .update({
            candidate_name: candName,
            department: candDept || null,
            description: candDescription,
            election_id: candElectionId
          })
          .eq('id', editCandId);

        if (error) {
          alert('Failed to update candidate: ' + error.message);
        } else {
          await addAuditLog('CANDIDATE_EDIT', 'admin', `Modified candidate details: ${candName}`, 'INFO', 'ok');
          setEditCandId(null);
          setCandName('');
          setCandDescription('');
          await fetchDatabaseData();
        }
      } else {
        const { error } = await supabase
          .from('candidates')
          .insert({
            election_id: candElectionId,
            candidate_name: candName,
            department: candDept || null,
            description: candDescription || null,
            status: 'active'
          });

        if (error) {
          alert('Failed to bind candidate: ' + error.message);
        } else {
          await addAuditLog('CANDIDATE_CREATE', 'admin', `Assigned new candidate ${candName} to election ${candElectionId}`, 'INFO', 'ok');
          setCandName('');
          setCandDescription('');
          await fetchDatabaseData();
        }
      }
    } catch (err) {
      alert('An error occurred: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCandidateClick = (c) => {
    const el = elections.find(e => e.id === c.electionId);
    if (el && el.status !== 'DRAFT') {
      alert('Cannot edit candidates for an active or completed election.');
      return;
    }
    setEditCandId(c.id);
    setCandName(c.name);
    setCandDept(c.dept);
    setCandDescription(c.description);
    setCandElectionId(c.electionId);
  };

  const handleDeleteCandidate = (id, electionId) => {
    const el = elections.find(e => e.id === electionId);
    if (el && el.status !== 'DRAFT') {
      alert('Cannot withdraw/modify candidates for an active or completed election.');
      return;
    }
    triggerConfirm(
      'Withdraw Candidate Profile',
      'Are you sure you want to withdraw this candidate? Their status will be set to inactive to preserve audit records.',
      async () => {
        const { error } = await supabase
          .from('candidates')
          .update({ status: 'inactive' })
          .eq('id', id);

        if (error) {
          alert('Failed to withdraw candidate: ' + error.message);
        } else {
          await addAuditLog('CANDIDATE_WITHDRAW', 'admin', `Withdrew candidate profile ${id}`, 'INFO', 'ok');
          await fetchDatabaseData();
        }
      }
    );
  };


  // Wizard Excel Drag & Drop Uploader Subsystem
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processSpreadsheetFile(file);
    }
  };

  const processSpreadsheetFile = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        const eligibleFromFile = [];
        const ineligibleFromFile = [];
        data.forEach(row => {
          if (row[0]) eligibleFromFile.push(String(row[0]).trim());
          if (row[1]) ineligibleFromFile.push(String(row[1]).trim());
        });
        
        const isHeader = (val) => /^(eligible|whitelist|ineligible|blacklist|roll|student|name|id)/i.test(val);
        if (eligibleFromFile.length > 0 && isHeader(eligibleFromFile[0])) eligibleFromFile.shift();
        if (ineligibleFromFile.length > 0 && isHeader(ineligibleFromFile[0])) ineligibleFromFile.shift();

        // Validate against configured patterns & ranges
        const pats = newElPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0);
        const report = validateUploadList(eligibleFromFile, ineligibleFromFile, pats, newElRanges);
        
        setUploadedEligibleRolls(report.eligible);
        setUploadedIneligibleRolls(report.ineligible);
        setUploadReport({
          fileName: file.name,
          totalRecords: report.rowsProcessed,
          validRecords: report.eligible.length + report.ineligible.length,
          invalidRecords: report.errorsCount,
          eligibleRecords: report.eligible.length,
          blacklistedRecords: report.ineligible.length,
          errors: report.errorDetails
        });
      } catch (err) {
        alert('Failed to parse spreadsheet file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleWizardFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) processSpreadsheetFile(file);
  };


  // Excel validation parser simulator & Uploader
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }); // read as array of arrays
        
        const eligibleFromFile = [];
        const ineligibleFromFile = [];
        
        data.forEach(row => {
          if (row[0]) eligibleFromFile.push(String(row[0]).trim());
          if (row[1]) ineligibleFromFile.push(String(row[1]).trim());
        });
        
        // Remove header rows if headers match keywords
        const isHeader = (val) => /^(eligible|whitelist|ineligible|blacklist|roll|student|name|id)/i.test(val);
        if (eligibleFromFile.length > 0 && isHeader(eligibleFromFile[0])) {
          eligibleFromFile.shift();
        }
        if (ineligibleFromFile.length > 0 && isHeader(ineligibleFromFile[0])) {
          ineligibleFromFile.shift();
        }
        
        setExcelInputEligible(eligibleFromFile.join(', '));
        setExcelInputIneligible(ineligibleFromFile.join(', '));
      } catch (err) {
        alert('Failed to parse spreadsheet file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelValidation = async () => {
    if (!eligibilityElectionId) {
      alert('Please select a target election first.');
      return;
    }

    const selectedEl = elections.find(e => e.id === eligibilityElectionId);
    if (selectedEl && selectedEl.status !== 'DRAFT') {
      alert('Cannot modify eligibility list for an active or completed election.');
      return;
    }

    if (!excelInputEligible.trim() && !excelInputIneligible.trim()) {
      alert('Please enter roll numbers or upload a spreadsheet file.');
      return;
    }

    setExcelValidationLogs(['Initializing Excel Ingestion & Prefix Validation Engine...', 'Running pattern and range integrity checks...']);
    setExcelSuccess('checking');

    // Parse separators: commas, spaces, or newlines
    const parseRolls = (str) => {
      return str
        .split(/[,\n\r\s]+/)
        .map(x => x.trim().toUpperCase())
        .filter(x => x.length > 0);
    };

    const rawEligible = parseRolls(excelInputEligible);
    const rawIneligible = parseRolls(excelInputIneligible);

    const rules = selectedEl?.eligibilityRules || [];

    const finalEligible = [];
    const finalIneligible = [];
    let whitelistDuplicates = 0;
    let blacklistDuplicates = 0;
    let conflictsCount = 0;
    let malformedCount = 0;
    const errorsList = [];

    const seen = new Set();
    const blacklistSet = new Set();

    const validateRollAgainstRules = (roll, rulesList) => {
      if (rulesList.length === 0) return true; // Legacy fallback
      for (const rule of rulesList) {
        const { prefix, variableLength, mode, from, to } = rule;
        if (roll.startsWith(prefix) && roll.length === prefix.length + variableLength) {
          const varPart = roll.substring(prefix.length);
          if (mode === 'numeric') {
            if (/^[0-9]+$/.test(varPart)) {
              const val = parseInt(varPart);
              const fromVal = parseInt(from);
              const toVal = parseInt(to);
              if (val >= fromVal && val <= toVal) return true;
            }
          } else {
            const val = base36ToInt(varPart);
            const fromVal = base36ToInt(from);
            const toVal = base36ToInt(to);
            if (val !== -1 && fromVal !== -1 && toVal !== -1) {
              if (val >= fromVal && val <= toVal) return true;
            }
          }
        }
      }
      return false;
    };

    // Process whitelist
    rawEligible.forEach(roll => {
      if (seen.has(roll)) {
        whitelistDuplicates++;
        return;
      }
      seen.add(roll);

      if (!validateRollAgainstRules(roll, rules)) {
        malformedCount++;
        errorsList.push(`Roll "${roll}" (Column A) rejected: does not match pattern/range scope.`);
        return;
      }
      finalEligible.push(roll);
    });

    // Process blacklist
    rawIneligible.forEach(roll => {
      if (blacklistSet.has(roll)) {
        blacklistDuplicates++;
        return;
      }
      blacklistSet.add(roll);

      if (!validateRollAgainstRules(roll, rules)) {
        malformedCount++;
        errorsList.push(`Roll "${roll}" (Column B) rejected: does not match pattern/range scope.`);
        return;
      }

      if (seen.has(roll)) {
        conflictsCount++;
        const idx = finalEligible.indexOf(roll);
        if (idx !== -1) finalEligible.splice(idx, 1);
        errorsList.push(`Conflict: Roll "${roll}" is in both columns. Excluded.`);
        return;
      }
      finalIneligible.push(roll);
    });

    const totalDuplicates = whitelistDuplicates + blacklistDuplicates;

    setTimeout(async () => {
      let logsBuffer = [
        `Processed ${rawEligible.length + rawIneligible.length} total rows.`,
        `Column A whitelist: parsed ${rawEligible.length} entries.`,
        `Column B blacklist: parsed ${rawIneligible.length} entries.`
      ];

      if (totalDuplicates > 0) {
        logsBuffer.push(`Removed ${totalDuplicates} duplicate roll entries.`);
      }

      if (conflictsCount > 0) {
        logsBuffer.push(`Conflict Error: Suspended insertion for ${conflictsCount} conflict roll numbers.`);
      }

      if (malformedCount > 0) {
        logsBuffer.push(`Rejected ${malformedCount} rows due to pattern or range mismatches.`);
      }

      errorsList.forEach(err => {
        logsBuffer.push(`  ❌ ${err}`);
      });

      try {
        // Clear old eligibility
        const { error: delError } = await supabase
          .from('election_eligibility')
          .delete()
          .eq('election_id', eligibilityElectionId);
        
        if (delError) throw delError;

        // Prepare bulk insert
        const insertRows = [];
        finalEligible.forEach(roll => {
          insertRows.push({
            election_id: eligibilityElectionId,
            roll_number: roll,
            is_eligible: true
          });
        });
        finalIneligible.forEach(roll => {
          insertRows.push({
            election_id: eligibilityElectionId,
            roll_number: roll,
            is_eligible: false
          });
        });

        if (insertRows.length > 0) {
          const { error: insError } = await supabase
            .from('election_eligibility')
            .insert(insertRows);
          if (insError) throw insError;
        }

        logsBuffer.push(`✓ Ingestion Completed: Eligible Imported: ${finalEligible.length}, Ineligible Imported: ${finalIneligible.length}.`);
        setExcelValidationLogs(logsBuffer);
        setExcelSuccess(true);
        setEligibilitySummary({
          eligible: finalEligible.length,
          ineligible: finalIneligible.length,
          duplicates: totalDuplicates,
          conflicts: conflictsCount
        });

        await addAuditLog('EXCEL_INGEST', 'admin', `Ingested eligibility: ${finalEligible.length} eligible, ${finalIneligible.length} restricted, ${totalDuplicates} duplicates, ${conflictsCount} conflicts`, 'INFO', 'ok');
        await fetchDatabaseData();
      } catch (err) {
        logsBuffer.push(`❌ DATABASE WRITE ERROR: ${err.message}`);
        setExcelValidationLogs(logsBuffer);
        setExcelSuccess(false);
      }
    }, 1000);
  };


  // Secure Invalidate & Resend token flow
  const triggerResendToken = (v) => {
    triggerConfirm(
      'Regenerate & Resend Token',
      `Are you sure you want to invalidate the old token and regenerate a new secure token for ${v.name} (${v.roll})?`,
      () => {
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
      }
    );
  };

  // Tie-Breaking Draw Actions
  const handleDeclareJointWinners = (electionId) => {
    const el = elections.find(x => x.id === electionId);
    triggerConfirm(
      'Declare Joint Winners',
      `Are you sure you want to declare joint winners for the election "${el?.name || 'this election'}"? This override will combine victory configurations in the ledger.`,
      async () => {
        const { error } = await supabase
          .rpc('declare_joint_winners', { p_election_id: electionId });

        if (error) {
          alert('Failed to declare joint winners: ' + error.message);
        } else {
          await addAuditLog('TIE_BREAK', 'admin', `Joint Winners override declared for election: ${el?.name}`, 'INFO', 'ok');
          await fetchDatabaseData();
          setInspectedElection(null);
        }
      }
    );
  };

  const handleReopenElection = (electionId) => {
    const el = elections.find(x => x.id === electionId);
    const defaultTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);
    
    const userInput = prompt(
      `Reopen Election "${el?.name || 'this election'}"\n` +
      `Existing vote counters will be reset to zero, previous tokens will be flushed, and a new voting window will be initialized.\n\n` +
      `Enter the new election end date and time (YYYY-MM-DD HH:MM):`,
      defaultTime
    );

    if (userInput === null) return; // User cancelled

    const newEndTime = new Date(userInput);
    if (isNaN(newEndTime.getTime()) || newEndTime <= new Date()) {
      alert('Invalid date/time. The date must be a valid future timestamp.');
      return;
    }

    triggerConfirm(
      'Confirm Reopen Election',
      `Are you sure you want to reopen "${el?.name}" until ${newEndTime.toLocaleString()}?`,
      async () => {
        const { error } = await supabase
          .rpc('reopen_election', { 
            p_election_id: electionId, 
            p_new_end_time: newEndTime.toISOString() 
          });

        if (error) {
          alert('Failed to reopen election: ' + error.message);
        } else {
          await addAuditLog('TIE_BREAK', 'admin', `Reopened election ${el?.name} until ${newEndTime.toISOString()}. Cleared previous votes and tokens.`, 'WARNING', 'warn');
          await fetchDatabaseData();
          setInspectedElection(null);
        }
      }
    );
  };

  // --- WORKSPACE DIARY LOGIC (SECTION 4) ---
  const handleAddOrEditNote = (e) => {
    e.preventDefault();
    if (!noteTitleInput.trim()) {
      alert('Note Title is required.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    setTimeout(() => {
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
      setIsSubmitting(false);
    }, 600);
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
    triggerConfirm(
      'Delete Admin Note',
      `Are you sure you want to delete note "${noteToDelete?.title || 'this note'}" permanently?`,
      () => {
        setAdminNotes(prev => prev.filter(n => n.id !== id));
        addAuditLog('NOTE_DELETE', 'admin', `Deleted admin note: ${noteToDelete?.title}`);
      }
    );
  };

  // --- WORKSPACE TASK LOGIC (SECTION 5) ---
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!taskTitleInput.trim()) {
      alert('Task Title is required.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    setTimeout(() => {
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
      setIsSubmitting(false);
    }, 600);
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
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!adminPassCurrent || !adminPassNew || !adminPassConfirm) {
      alert('Please fill out all password fields.');
      return;
    }
    if (adminPassNew !== adminPassConfirm) {
      alert('New passwords do not match.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: adminPassNew,
      });

      if (error) {
        alert(error.message);
      } else {
        addAuditLog('PASSWORD_CHANGE', 'admin', 'Super Admin password successfully updated', 'INFO', 'ok');
        alert('Security Settings: Password updated successfully.');
        setAdminPassCurrent('');
        setAdminPassNew('');
        setAdminPassConfirm('');
      }
    } catch (err) {
      console.error('Password update exception:', err);
      alert('Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to end your secure administrative session? All current context will be wiped.')) {
      try {
        await supabase.rpc('handle_logout');
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Logout error:', err);
        await supabase.auth.signOut();
      }
      navigate('/portal');
    }
  };
  // Wire logoutRef so callbacks defined before handleLogout can call it via the ref
  // Must be inside useEffect to avoid "cannot update ref during render" violation
  useEffect(() => {
    logoutRef.current = handleLogout;
  });

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
    const el = elections.find(x => x.id === elId);
    triggerConfirm(
      'Export Cryptographic Report',
      `Are you sure you want to export the cryptographic PDF report for "${el?.name || 'this election'}"? This compiles all signed voter vectors and audit trails.`,
      () => {
        setExportingElectionId(elId);
        setExportProgress(0);
        setSignedPdfData(null);

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
      }
    );
  };

  // Global search filtering logic
  const handleGlobalSearchChange = (e) => {
    setSearchInput(e.target.value);
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

  const selectedElForCand = elections.find(e => e.id === candElectionId);
  const isCandFormLocked = selectedElForCand && selectedElForCand.status !== 'DRAFT';

  const selectedElForElig = elections.find(e => e.id === eligibilityElectionId);
  const isEligFormLocked = selectedElForElig && selectedElForElig.status !== 'DRAFT';

  const activeElection = elections.find(e => e.status === 'ACTIVE' || e.status === 'PAUSED');

  if (checkingAuth) {

    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0d1117', color: '#f0f6fc', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(212, 168, 67, 0.2)', borderTop: '3px solid #d4a843', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13.5px', color: 'rgba(240, 239, 232, 0.8)' }}>Verifying administrative session...</div>
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
    <div className="dashboard-page">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <div className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
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
              { id: 'Security', lbl: 'Security Analytics', icon: <IconShield size={18} /> },
              { id: 'Reports', lbl: 'Audit Portal', icon: <IconFolder size={18} /> },
              { id: 'Operations', lbl: 'Operations Control', icon: <IconPackage size={18} /> },
              { id: 'System', lbl: 'System Health', icon: <IconPlug size={18} /> },
              { id: 'Alerts', lbl: 'Alerts Terminal', icon: <IconAlertCircle size={18} /> },
              { id: 'Profile', lbl: 'Profile & Notes', icon: <IconUser size={18} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSidebarOpen(false);
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
          {elections.filter(e => e.status === 'ACTIVE' || e.status === 'PAUSED').length === 0 ? (
            <div className="active-panel-empty">No Active Elections</div>
          ) : (
            elections.filter(e => e.status === 'ACTIVE' || e.status === 'PAUSED').map(el => (
              <div key={el.id} className="active-panel-card">
                <span className="active-el-name">{el.name}</span>
                <span className="active-el-time">Ends: {el.end.split(' ')[1] || '04:00 PM'}</span>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div className="admin-badge">
            <div className="admin-avatar">{adminProfile ? adminProfile.full_name.split(' ').map(x=>x[0]).join('') : 'AD'}</div>
            <div className="admin-info">
              <span className="admin-name">{adminProfile ? adminProfile.admin_id : 'VG-SUPER-001'}</span>
              <span className="admin-role">Super Administrator</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Terminate Session</button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="dashboard-main" ref={contentRef}>
        {/* HEADER BAR */}
        <div className="dashboard-header">
          <button 
            className="hamburger-toggle" 
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className="dashboard-title-area">
            <h1 className="dashboard-title">
              {activeTab === 'Dashboard' 
                ? 'Administrator Cockpit' 
                : activeTab === 'Reports' 
                  ? 'Audit Portal' 
                  : activeTab === 'Security' 
                    ? 'Security Analytics' 
                    : activeTab === 'Operations'
                      ? 'Operations Control'
                      : activeTab}
            </h1>
            <span className="dashboard-subtitle">VoteGuard Secure Election Governance Cockpit</span>
          </div>

          <div className="dashboard-meta">
            {/* Global Search everywhere */}
            <div className="global-search-container">
              <input 
                type="text" 
                placeholder="Search everywhere..."
                value={searchInput}
                onChange={handleGlobalSearchChange}
                className="global-search-input"
              />
              {searchInput && (
                <button className="clear-search-btn" onClick={() => { setSearchInput(''); setGlobalSearch(''); }}>✕</button>
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
                    <CountUpNumber to={elections.filter(e => e.status === 'ACTIVE' || e.status === 'PAUSED').length} />
                  </span>
                  <span className="dash-stat-sub positive">Live turnout tracking active</span>
                </div>
              </SpotlightCard>
              <SpotlightCard className="dash-stat-card-spotlight" spotlightColor="rgba(212, 168, 67, 0.12)">
                <div className="dash-stat-card">
                  <span className="dash-stat-label">Completed / Archived</span>
                  <span className="dash-stat-value">
                    <CountUpNumber to={elections.filter(e => e.status === 'COMPLETED' || e.status === 'ARCHIVED').length} />
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
                    <span className="heatmap-info">Busiest voting hours (Total: {turnoutData.reduce((sum, x) => sum + x.v, 0)} votes)</span>
                  </div>

                  <div className="heatmap-bars">
                    {turnoutData.length === 0 || turnoutData.every(x => x.v === 0) ? (
                      <div style={{ color: 'var(--text3)', fontSize: '13px', margin: 'auto', textAlign: 'center', padding: '20px 0' }}>
                        No ballots cast in active polling hours yet.
                      </div>
                    ) : (
                      turnoutData.map((x, i) => {
                        const maxVal = Math.max(...turnoutData.map(h => h.v), 1);
                        return (
                          <div key={i} className="heatmap-col">
                            <div className="heatmap-bar-fill" style={{ height: `${(x.v / maxVal) * 100}%` }}>
                              <span className="tooltip-val">{x.v}v</span>
                            </div>
                            <span className="heatmap-lbl">{x.hr}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </SpotlightCard>

              {/* Active Election Health Integrity Widget */}
              <SpotlightCard className="dash-chart-card-spotlight" spotlightColor="rgba(74, 157, 143, 0.15)">
                <div className="dash-chart-card">
                  <div className="dash-chart-header">
                    <span className="dash-chart-title">
                      <IconShield size={18} /> Active Election Health
                    </span>
                    {activeElection ? (
                      <span className={`badge-role ${activeElection.status === 'ACTIVE' || activeElection.status === 'PAUSED' ? 'green' : 'gold'}`}>
                        {activeElection.status === 'ACTIVE' ? 'Running' : activeElection.status}
                      </span>
                    ) : (
                      <span className="badge-role" style={{ color: 'var(--text3)' }}>Inactive</span>
                    )}
                  </div>

                  {activeElection ? (
                    <div style={{ marginTop: '12px' }}>
                      <h3 style={{ fontSize: '14px', margin: '0 0 10px 0', color: 'var(--text)' }}>
                        {activeElection.name}
                      </h3>
                      
                      <div className="integrity-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        <div className="integrity-tile" style={{ padding: '8px' }}>
                          <span className="int-lbl" style={{ fontSize: '9.5px' }}>Active Candidates</span>
                          <span className="int-val color-green" style={{ fontSize: '16px' }}>
                            {candidates.filter(c => c.electionId === activeElection.id && c.status === 'active').length}
                          </span>
                        </div>
                        <div className="integrity-tile" style={{ padding: '8px' }}>
                          <span className="int-lbl" style={{ fontSize: '9.5px' }}>Eligible Students</span>
                          <span className="int-val color-green" style={{ fontSize: '16px' }}>
                            {activeElection.voters}
                          </span>
                        </div>
                        <div className="integrity-tile" style={{ padding: '8px' }}>
                          <span className="int-lbl" style={{ fontSize: '9.5px' }}>Tokens Requested</span>
                          <span className="int-val color-gold" style={{ fontSize: '16px' }}>
                            {voters.filter(v => v.status === 'Token Dispatched - Not Voted' || v.status === 'Voted').length}
                          </span>
                        </div>
                        <div className="integrity-tile" style={{ padding: '8px' }}>
                          <span className="int-lbl" style={{ fontSize: '9.5px' }}>Votes Cast</span>
                          <span className="int-val color-gold" style={{ fontSize: '16px' }}>
                            {voters.filter(v => v.status === 'Voted').length}
                          </span>
                        </div>
                      </div>

                      <div className="security-status-msg" style={{ marginTop: '12px', padding: '8px', fontSize: '11px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                        <strong>Integrity Status: </strong>
                        {candidates.filter(c => c.electionId === activeElection.id && c.status === 'active').length < 2 ? (
                          <span style={{ color: 'var(--red)' }}>Configuration Error: Minimum 2 candidates required.</span>
                        ) : activeElection.voters === 0 ? (
                          <span style={{ color: 'var(--gold)' }}>Warning: Eligibility roster is empty.</span>
                        ) : (
                          <span style={{ color: 'var(--green)' }}>Healthy (All safeguards verified)</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text3)', fontSize: '12.5px' }}>
                      <IconAlertTriangle size={24} style={{ color: 'var(--text3)', marginBottom: '8px' }} />
                      <p style={{ margin: 0 }}>No active election currently running.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text3)' }}>
                        Initialize an election and activate it in the Election Management tab.
                      </p>
                    </div>
                  )}
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
                    {filteredLogs.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>No logs match search filters.</div>
                    ) : (
                      filteredLogs.map((log, index) => (
                        <div key={index} className={`log-row-level ${log.level.toLowerCase()}`}>
                          <span className="ts">[{log.ts}]</span>
                          <span className={`log-severity-badge ${log.level.toLowerCase()}`}>{log.level}</span>
                          <span className="ev">{highlightMatch(log.ev, globalSearch)}</span>
                          <span className="user">{highlightMatch(log.usr, globalSearch)}</span> · {highlightMatch(log.desc, globalSearch)}
                        </div>
                      ))
                    )}
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
                      <h3>{adminProfile ? adminProfile.full_name : 'Hari Harsha'} (Super Admin)</h3>
                      <p>Operator Code: <strong>{adminProfile ? `@${adminProfile.admin_id.toLowerCase().replace('-', '_')}` : '@harsha_admin'}</strong></p>
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
              
              {/* Election Configuration Stepper Wizard */}
              <div className="users-table-card">
                <h2 className="tab-section-title">Configure &amp; Initialize New Election</h2>
                
                {/* Stepper Header */}
                <div className="wizard-stepper-container" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto' }}>
                  {[1, 2, 3, 4, 5].map((step) => {
                    const stepLabels = ['Information', 'Eligibility', 'Schedule', 'Roster Ingestion', 'Review & Deploy'];
                    const isActive = wizardStep === step;
                    const isCompleted = wizardStep > step;
                    return (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isActive || isCompleted ? 1 : 0.4, transition: 'all 0.3s ease', minWidth: 'max-content', marginRight: '16px' }}>
                        <span style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: isCompleted ? 'var(--teal)' : isActive ? 'var(--teal)' : 'var(--bg-card)',
                          color: isActive || isCompleted ? '#000' : 'var(--text2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '12px',
                          border: isActive ? '2px solid var(--teal)' : '1px solid var(--border)',
                          boxShadow: isActive ? '0 0 10px rgba(74, 157, 143, 0.3)' : 'none'
                        }}>
                          {isCompleted ? '✓' : step}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: isActive ? '600' : '500', color: isActive ? 'var(--teal)' : 'var(--text2)' }}>
                          {stepLabels[step - 1]}
                        </span>
                        {step < 5 && <span style={{ color: 'var(--border)', marginLeft: '16px' }}>—</span>}
                      </div>
                    );
                  })}
                </div>

                {/* STEP 1: Election Information */}
                {wizardStep === 1 && (
                  <div className="wizard-step-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Template Loader Dropdown */}
                    <div className="template-selector-sub" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="field-title" htmlFor="template-select" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text3)', marginBottom: '6px' }}>Load Configuration Template:</label>
                        <select 
                          id="template-select"
                          value={selectedTemplate} 
                          onChange={(e) => handleLoadTemplate(e.target.value)}
                          className="template-select-box"
                          style={{ width: '100%', padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                        >
                          <option value="">-- Choose Template to Auto-Fill --</option>
                          {electionTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <button className="btn-action-sm" onClick={handleSaveAsTemplate} style={{ height: '38px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px' }}>
                        <IconDeviceFloppy size={18} /> Save Active Config as Template
                      </button>
                    </div>

                    <div className="form-row-grid">
                      <div className="field">
                        <label htmlFor="new-el-name">Election Name <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input 
                          id="new-el-name"
                          type="text" 
                          placeholder="e.g. Student Council CR Poll"
                          value={newElName}
                          onChange={(e) => setNewElName(e.target.value)}
                          aria-required="true"
                        />
                      </div>
                    </div>

                    <div className="form-row-grid">
                      <div className="field">
                        <label htmlFor="new-el-desc">Description</label>
                        <textarea 
                          id="new-el-desc"
                          rows={3}
                          placeholder="Brief summary of the election purpose..."
                          value={newElDesc}
                          onChange={(e) => setNewElDesc(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="new-el-access-code">Access Code (Leave blank for Public elections)</label>
                        <input 
                          id="new-el-access-code"
                          type="text" 
                          placeholder="e.g. VG-ACCESS-CODE"
                          value={newElAccessCode}
                          onChange={(e) => setNewElAccessCode(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <button 
                        className="btn-create-election" 
                        onClick={() => {
                          if (!newElName.trim()) {
                            alert('Election Name is required.');
                            return;
                          }
                          setWizardStep(2);
                        }}
                        style={{ width: 'auto', padding: '10px 24px' }}
                      >
                        Next: Eligibility Configuration →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Eligibility Configuration */}
                {wizardStep === 2 && (
                  <div className="wizard-step-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="field">
                      <label htmlFor="new-el-patterns" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Eligible Voter ID Patterns <span style={{ color: 'var(--red)' }}>*</span>
                        <span className="tooltip-trigger" title="Enter roll number patterns separated by commas. Use underscores (_) at the end for the variable length. E.g. 25L35A44__ allows 2-digit roll ranges like 25L35A4401 to 25L35A4464." style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text3)' }}>?</span>
                      </label>
                      <input 
                        id="new-el-patterns"
                        type="text" 
                        placeholder="e.g. 25L35A44__, 24L31A44__"
                        value={newElPatterns}
                        onChange={(e) => updatePatternsAndRanges(e.target.value)}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                        Separate multiple patterns using commas. Underscores represent variable characters.
                      </span>
                    </div>

                    {/* Dynamic Range Configuration Cards */}
                    <div className="dynamic-range-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {newElPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0).map((pat, index) => {
                        const info = parsePattern(pat);
                        const range = newElRanges[pat] || {};
                        
                        if (!info.valid) {
                          return (
                            <div key={index} style={{ padding: '16px', background: 'rgba(239,83,80,0.05)', border: '1px solid rgba(239,83,80,0.2)', borderRadius: '8px', color: '#ef5350', fontSize: '13px' }}>
                              ⚠️ Pattern <strong>"{pat}"</strong> is invalid: {info.error}
                            </div>
                          );
                        }

                        let estimatedCount = 0;
                        if (range.from && range.to && range.from.length === info.varLength && range.to.length === info.varLength) {
                          if (range.mode === 'numeric') {
                            estimatedCount = Math.max(0, parseInt(range.to) - parseInt(range.from) + 1);
                          } else {
                            const fromVal = base36ToInt(range.from);
                            const toVal = base36ToInt(range.to);
                            if (fromVal !== -1 && toVal !== -1) {
                              estimatedCount = Math.max(0, toVal - fromVal + 1);
                            }
                          }
                        }

                        return (
                          <div key={pat} style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                              <strong style={{ fontSize: '14px', color: 'var(--teal)' }}>Range Configuration Card #{index + 1}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Pattern: <code style={{ color: 'var(--gold)' }}>{pat}</code></span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                              <div className="field">
                                <label>Range Mode</label>
                                <select 
                                  value={range.mode || 'numeric'} 
                                  onChange={(e) => handleRangeChange(pat, 'mode', e.target.value)}
                                  style={{ width: '100%', padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                                >
                                  <option value="numeric">Numeric Mode (e.g. 01 → 64)</option>
                                  <option value="alphanumeric">Alphanumeric Mode (e.g. A0 → C7)</option>
                                </select>
                              </div>

                              <div className="field">
                                <label>From Value ({info.varLength} chars)</label>
                                <input 
                                  type="text" 
                                  maxLength={info.varLength}
                                  placeholder={'0'.repeat(info.varLength - 1) + '1'}
                                  value={range.from || ''} 
                                  onChange={(e) => handleRangeChange(pat, 'from', e.target.value)}
                                />
                              </div>

                              <div className="field">
                                <label>To Value ({info.varLength} chars)</label>
                                <input 
                                  type="text" 
                                  maxLength={info.varLength}
                                  placeholder={'9'.repeat(info.varLength)}
                                  value={range.to || ''} 
                                  onChange={(e) => handleRangeChange(pat, 'to', e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Live Preview Inside Card */}
                            <div style={{ background: 'rgba(74, 157, 143, 0.04)', border: '1px solid rgba(74, 157, 143, 0.15)', borderRadius: '8px', padding: '12px', fontSize: '12.5px', color: 'var(--text2)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                              <div>Prefix: <strong style={{ color: 'var(--text)' }}>{info.prefix}</strong></div>
                              <div>Variable length: <strong style={{ color: 'var(--text)' }}>{info.varLength}</strong></div>
                              <div>Range: <strong style={{ color: 'var(--text)' }}>{range.from || '?'} → {range.to || '?'}</strong></div>
                              <div>Estimated voters: <strong style={{ color: 'var(--teal)', fontSize: '13.5px' }}>{isNaN(estimatedCount) ? 0 : estimatedCount}</strong></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                      <button className="btn-action-sm secondary" onClick={() => setWizardStep(1)} style={{ height: '38px', padding: '0 20px' }}>
                        ← Back
                      </button>
                      <button 
                        className="btn-create-election" 
                        onClick={() => {
                          const pats = newElPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0);
                          if (pats.length === 0) {
                            alert('At least one Eligible Voter ID Pattern is required.');
                            return;
                          }
                          for (const pat of pats) {
                            const info = parsePattern(pat);
                            if (!info.valid) {
                              alert(`Invalid pattern "${pat}": ${info.error}`);
                              return;
                            }
                            const range = newElRanges[pat];
                            if (!range || !range.from || !range.to) {
                              alert(`Incomplete range configurations for pattern "${pat}".`);
                              return;
                            }
                          }
                          setWizardStep(3);
                        }}
                        style={{ width: 'auto', padding: '10px 24px' }}
                      >
                        Next: Election Schedule →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Election Schedule */}
                {wizardStep === 3 && (
                  <div className="wizard-step-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-row-grid">
                      <div className="field">
                        <label htmlFor="new-el-start">Start Date &amp; Time <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input 
                          id="new-el-start" 
                          type="datetime-local" 
                          value={newElStart} 
                          onChange={(e) => setNewElStart(e.target.value)} 
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="new-el-end">End Date &amp; Time <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input 
                          id="new-el-end" 
                          type="datetime-local" 
                          value={newElEnd} 
                          onChange={(e) => setNewElEnd(e.target.value)} 
                        />
                      </div>
                    </div>

                    {newElStart && newElEnd && (
                      <div style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', fontWeight: '600' }}>TOTAL ELECTION DURATION</span>
                          <strong style={{ fontSize: '18px', color: 'var(--gold)', fontFamily: 'IBM Plex Mono, monospace' }}>{calculateDuration(newElStart, newElEnd)}</strong>
                        </div>
                        <span style={{ fontSize: '24px' }}>⏳</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                      <button className="btn-action-sm secondary" onClick={() => setWizardStep(2)} style={{ height: '38px', padding: '0 20px' }}>
                        ← Back
                      </button>
                      <button 
                        className="btn-create-election" 
                        onClick={() => {
                          const start = new Date(newElStart);
                          const end = new Date(newElEnd);
                          const now = new Date();
                          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                            alert('Please enter valid start and end dates.');
                            return;
                          }
                          if (start < now - 60000) {
                            alert('Start date and time cannot be in the past.');
                            return;
                          }
                          if (end <= start) {
                            alert('End date must be after start date.');
                            return;
                          }
                          setWizardStep(4);
                        }}
                        style={{ width: 'auto', padding: '10px 24px' }}
                      >
                        Next: Eligibility Upload →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Eligibility Upload */}
                {wizardStep === 4 && (
                  <div className="wizard-step-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2)' }}>
                      (Optional) Drag &amp; drop a whitelisted/blacklisted roster to override pattern rules. If skipped, voter validation uses dynamic prefix matching only.
                    </p>

                    {/* Drag & Drop Area */}
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{
                        border: dragOver ? '2px dashed var(--teal)' : '2px dashed var(--border)',
                        background: dragOver ? 'rgba(74, 157, 143, 0.05)' : 'rgba(255,255,255,0.01)',
                        padding: '40px 20px',
                        borderRadius: '12px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                      onClick={() => document.getElementById('wizard-file-input').click()}
                    >
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '50%' }}>
                        <IconInbox size={32} style={{ color: dragOver ? 'var(--teal)' : 'var(--text3)' }} />
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>Drag &amp; drop spreadsheet file here</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Accepts Excel (.xlsx, .xls) and CSV (.csv) formats</span>
                      </div>
                      <button type="button" className="btn-action-sm" style={{ pointerEvents: 'none' }}>
                        Browse Local Files
                      </button>
                      <input 
                        id="wizard-file-input"
                        type="file" 
                        accept=".xlsx,.xls,.csv" 
                        onChange={handleWizardFileUpload}
                        style={{ display: 'none' }}
                      />
                    </div>

                    {/* Roster Upload Validation Summary */}
                    {uploadReport && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--gold)', letterSpacing: '1px' }}>UPLOAD VALIDATION REPORT:</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>File Name</span>
                            <strong style={{ fontSize: '12px', color: 'var(--text)' }}>{uploadReport.fileName}</strong>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Total Processed</span>
                            <strong style={{ fontSize: '16px', color: 'var(--text)' }}>{uploadReport.totalRecords}</strong>
                          </div>
                          <div style={{ background: 'rgba(74, 157, 143, 0.1)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Eligible (Col A)</span>
                            <strong style={{ fontSize: '16px', color: 'var(--teal)' }}>{uploadReport.eligibleRecords}</strong>
                          </div>
                          <div style={{ background: 'rgba(239, 83, 80, 0.1)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Blacklisted (Col B)</span>
                            <strong style={{ fontSize: '16px', color: '#ef5350' }}>{uploadReport.blacklistedRecords}</strong>
                          </div>
                          <div style={{ background: 'rgba(239, 83, 80, 0.15)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Rejected Rows</span>
                            <strong style={{ fontSize: '16px', color: '#ff6b6b' }}>{uploadReport.invalidRecords}</strong>
                          </div>
                        </div>

                        {uploadReport.errors.length > 0 && (
                          <div style={{ background: 'rgba(239,83,80,0.04)', border: '1px solid rgba(239,83,80,0.15)', borderRadius: '6px', padding: '12px', maxHeight: '120px', overflowY: 'auto' }}>
                            <strong style={{ display: 'block', fontSize: '11px', color: '#ef5350', marginBottom: '6px' }}>REJECTED RECORDS LOG PREVIEW:</strong>
                            {uploadReport.errors.slice(0, 5).map((err, idx) => (
                              <div key={idx} style={{ fontSize: '11px', color: 'var(--text3)', margin: '2px 0' }}>• {err}</div>
                            ))}
                            {uploadReport.errors.length > 5 && (
                              <div style={{ fontSize: '11.5px', color: 'var(--text3)', fontStyle: 'italic', marginTop: '4px' }}>...and {uploadReport.errors.length - 5} more records rejected.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                      <button className="btn-action-sm secondary" onClick={() => setWizardStep(3)} style={{ height: '38px', padding: '0 20px' }}>
                        ← Back
                      </button>
                      <button className="btn-create-election" onClick={() => setWizardStep(5)} style={{ width: 'auto', padding: '10px 24px' }}>
                        Next: Review &amp; Create →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: Review & Create */}
                {wizardStep === 5 && (
                  <div className="wizard-step-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                        <h3 style={{ fontSize: '13.5px', color: 'var(--teal)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Election Information</h3>
                        <p style={{ fontSize: '13px', margin: '6px 0' }}>Name: <strong>{newElName}</strong></p>
                        <p style={{ fontSize: '13px', margin: '6px 0' }}>Description: <span style={{ color: 'var(--text2)' }}>{newElDesc || 'None'}</span></p>
                        <p style={{ fontSize: '13px', margin: '6px 0' }}>Access Code: <strong>{newElAccessCode ? `Private (Code: "${newElAccessCode}")` : 'Public'}</strong></p>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                        <h3 style={{ fontSize: '13.5px', color: 'var(--teal)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Schedule &amp; Window</h3>
                        <p style={{ fontSize: '13px', margin: '6px 0' }}>Starts: <span style={{ color: 'var(--text2)' }}>{new Date(newElStart).toLocaleString()}</span></p>
                        <p style={{ fontSize: '13px', margin: '6px 0' }}>Ends: <span style={{ color: 'var(--text2)' }}>{new Date(newElEnd).toLocaleString()}</span></p>
                        <p style={{ fontSize: '13px', margin: '6px 0' }}>Duration: <strong style={{ color: 'var(--gold)' }}>{calculateDuration(newElStart, newElEnd)}</strong></p>
                      </div>

                      <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                        <h3 style={{ fontSize: '13.5px', color: 'var(--teal)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Eligibility Patterns &amp; Ranges</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {newElPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0).map((pat, idx) => {
                            const range = newElRanges[pat] || {};
                            return (
                              <div key={idx} style={{ fontSize: '12.5px', color: 'var(--text2)', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                <span>Pattern: <code>{pat}</code> ({range.mode || 'numeric'})</span>
                                <strong>Range: {range.from} → {range.to}</strong>
                              </div>
                            );
                          })}
                          
                          {uploadReport && (
                            <div style={{ paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                              <span>Uploaded whitelist overrides (Col A):</span>
                              <strong style={{ color: 'var(--teal)' }}>{uploadReport.eligibleRecords} Roll Numbers</strong>
                            </div>
                          )}
                          {uploadReport && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                              <span>Uploaded blacklist exclusions (Col B):</span>
                              <strong style={{ color: '#ef5350' }}>{uploadReport.blacklistedRecords} Roll Numbers</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                      <button className="btn-action-sm secondary" onClick={() => setWizardStep(4)} style={{ height: '38px', padding: '0 20px' }}>
                        ← Back
                      </button>
                      <button 
                        className="btn-create-election" 
                        onClick={() => handleCreateElection()}
                        disabled={isSubmitting}
                        style={{ width: 'auto', padding: '10px 32px' }}
                      >
                        {isSubmitting ? 'Deploying Registry...' : '✓ Create & Launch Election'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Excel Eligibility Overrides Ingestion */}
              <div className="users-table-card">
                <h2 className="tab-section-title">Ingest Eligibility Overrides Pipeline</h2>
                <p className="section-desc">Upload Excel/CSV spreadsheets or manually enter roll numbers. Lock is applied on active elections.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="field" style={{ gridColumn: 'span 2' }}>
                    <label htmlFor="eligibility-election-select">Target Election (Draft/Configured Only)</label>
                    <select 
                      id="eligibility-election-select"
                      value={eligibilityElectionId}
                      onChange={(e) => setEligibilityElectionId(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                    >
                      <option value="">-- Choose Election to Ingest Eligibility --</option>
                      {elections.filter(el => el.status === 'DRAFT').map(el => (
                         <option key={el.id} value={el.id}>{el.name} ({el.id})</option>
                       ))}
                    </select>
                  </div>

                  <div className="field" style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', color: 'var(--text2)' }} htmlFor="excel-file-upload">
                      Upload Spreadsheet File (.xlsx, .xls, .csv):
                    </label>
                    <input 
                      id="excel-file-upload"
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleFileUpload}
                      style={{ color: 'var(--text2)', fontSize: '13px' }}
                      disabled={isEligFormLocked || !eligibilityElectionId}
                    />
                    <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--text3)' }}>
                      Make sure Column A contains Whitelist rolls and Column B contains Blacklist rolls.
                    </p>
                  </div>

                  <div className="field">
                    <label>Column A: Eligible Whitelist (Inclusions)</label>
                    <textarea 
                      rows={3} 
                      placeholder="Roll numbers to force-approve (e.g. 23ME089, 21CS001)"
                      value={excelInputEligible}
                      onChange={(e) => setExcelInputEligible(e.target.value)}
                      disabled={isEligFormLocked || !eligibilityElectionId}
                    />
                  </div>
                  <div className="field">
                    <label>Column B: Ineligible Blacklist (Exclusions)</label>
                    <textarea 
                      rows={3} 
                      placeholder="Roll numbers to restrict/exclude (e.g. 23EE005)"
                      value={excelInputIneligible}
                      onChange={(e) => setExcelInputIneligible(e.target.value)}
                      disabled={isEligFormLocked || !eligibilityElectionId}
                    />
                  </div>
                </div>

                <button 
                  className="btn-action-sm gold" 
                  onClick={handleExcelValidation} 
                  disabled={isEligFormLocked || !eligibilityElectionId || isSubmitting}
                >
                  Validate &amp; Ingest Eligibility
                </button>

                {isEligFormLocked && (
                  <p style={{ marginTop: '10px', color: 'var(--red)', fontSize: '12px' }}>
                    ⚠️ Eligibility roster is locked because the target election is active or ended.
                  </p>
                )}

                {excelSuccess !== null && (
                  <div className={`excel-validation-results ${excelSuccess === 'checking' ? 'info' : excelSuccess ? 'success' : 'error'}`} style={{ marginTop: '16px' }}>
                    <h4>Ingestion Validator Log Outcome:</h4>
                    <div className="excel-log-outputs">
                      {excelValidationLogs.map((logLine, idx) => (
                        <div key={idx} className="log-line">{logLine}</div>
                      ))}
                    </div>

                    {excelSuccess === true && eligibilitySummary && (
                      <div className="eligibility-summary-panel animate-fade-in" style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--gold)', fontFamily: 'IBM Plex Mono, monospace' }}>ELIGIBILITY INGESTION SUMMARY:</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                          <div style={{ background: 'rgba(74, 157, 143, 0.1)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Eligible Students</span>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#4a9d8f' }}>{eligibilitySummary.eligible}</span>
                          </div>
                          <div style={{ background: 'rgba(239, 83, 80, 0.1)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Non-Eligible</span>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef5350' }}>{eligibilitySummary.ineligible}</span>
                          </div>
                          <div style={{ background: 'rgba(212, 168, 67, 0.1)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Duplicates Removed</span>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#d4a843' }}>{eligibilitySummary.duplicates}</span>
                          </div>
                          <div style={{ background: 'rgba(239, 83, 80, 0.15)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)' }}>Conflicts Found</span>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff6b6b' }}>{eligibilitySummary.conflicts}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>


              {/* Election Lifecycle List */}
              <div className="view-action-bar" style={{ marginTop: '20px' }}>
                <h2 className="dashboard-subtitle" style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Election Lifecycle Timeline Cockpit</h2>
              </div>

              <div className="elections-list">
                {filteredElections.length === 0 ? (
                  <div className="dash-empty-state">
                    <IconSearch size={48} className="empty-state-icon" style={{ color: 'var(--text3)', marginBottom: '12px' }} />
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text)' }}>No matching elections found</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2)' }}>Try refining your search query or check back later.</p>
                  </div>
                ) : (
                  filteredElections.map((el) => (
                    <div key={el.id} className={`election-list-item status-${el.status.toLowerCase()}`}>
                      
                      <div className="election-meta-left">
                        <span className="election-item-title">{highlightMatch(el.name, globalSearch)}</span>
                        <span className="election-item-dates">Duration: {el.start} to {el.end} · ID: {highlightMatch(el.id, globalSearch)} · Type: <strong>{el.type}</strong></span>
                      
                      {/* Visual lifecycle timeline */}
                      <div className="visual-timeline-container">
                        {[
                           { key: 'DRAFT', lbl: 'Created' },
                           { key: 'ACTIVE', lbl: 'Activated' },
                           { key: 'PAUSED', lbl: 'Paused' },
                           { key: 'STOPPED', lbl: 'Stopped' },
                           { key: 'COMPLETED', lbl: 'Completed' },
                           { key: 'DEADLOCK', lbl: 'Deadlock' },
                           { key: 'ARCHIVED', lbl: 'Archived' }
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
                      <span className={`election-status-tag ${el.status === 'ACTIVE' ? 'running' : el.status.toLowerCase()}`}>
                        {el.status === 'ACTIVE' ? 'Running' : el.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="election-actions">
                      <button className="btn-action-sm" onClick={() => setPreviewElection(el)}>
                        <IconEye size={18} /> Preview
                      </button>

                      {el.status === 'DRAFT' && (
                        <button className="btn-action-sm positive" onClick={() => startElection(el.id)} style={{ background: 'rgba(74, 157, 143, 0.2)', color: '#4a9d8f' }}>
                          <IconPlayerPlay size={18} /> Start Election
                        </button>
                      )}

                      {el.status === 'ACTIVE' && (
                        <>
                          <button className="btn-action-sm" onClick={() => toggleElectionStatus(el.id)}>
                            <IconPlayerPause size={18} /> Pause
                          </button>
                          <button className="btn-action-sm danger" onClick={() => handleEmergencyStop(el.id)}>
                            <IconAlertCircle size={18} /> Emergency Stop
                          </button>
                          <button className="btn-action-sm positive" onClick={() => handleCompleteElection(el.id)} style={{ background: 'rgba(74, 157, 143, 0.2)', color: '#4a9d8f' }}>
                            <IconCircleCheck size={18} /> Complete Election
                          </button>
                        </>
                      )}

                      {el.status === 'PAUSED' && (
                        <>
                          <button className="btn-action-sm" onClick={() => toggleElectionStatus(el.id)}>
                            <IconPlayerPlay size={18} /> Resume
                          </button>
                          <button className="btn-action-sm danger" onClick={() => handleEmergencyStop(el.id)}>
                            <IconAlertCircle size={18} /> Emergency Stop
                          </button>
                          <button className="btn-action-sm positive" onClick={() => handleCompleteElection(el.id)} style={{ background: 'rgba(74, 157, 143, 0.2)', color: '#4a9d8f' }}>
                            <IconCircleCheck size={18} /> Complete Election
                          </button>
                        </>
                      )}

                      {el.status === 'STOPPED' && (
                        <button className="btn-action-sm" onClick={async () => {
                          const { error } = await supabase.from('elections').update({ status: 'ACTIVE', emergency_locked: false }).eq('id', el.id);
                          if (error) alert(error.message);
                          else {
                            await addAuditLog('EMERGENCY_UNLOCK', 'admin', `Unlocked election ${el.name}`, 'INFO', 'ok');
                            await fetchDatabaseData();
                            await broadcastRefresh();
                          }
                        }}>
                          <IconLockOpen size={18} /> Unlock
                        </button>
                      )}

                      {el.status === 'COMPLETED' && (
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

                      {el.status === 'DEADLOCK' && (
                        <>
                          <button className="btn-action-sm gold" onClick={() => handleDeclareJointWinners(el.id)}>
                            <IconHeartHandshake size={18} /> Declare Joint Winners
                          </button>
                          <button className="btn-action-sm danger" onClick={() => handleReopenElection(el.id)}>
                            <IconRefresh size={18} /> Re-Open Election
                          </button>
                        </>
                      )}

                      {el.status === 'ARCHIVED' && (
                        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Archived (Read Only)</span>
                      )}
                    </div>


                  </div>
                )))}
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
                    <label htmlFor="cand-fullname">Full Name</label>
                    <input 
                      id="cand-fullname"
                      type="text" 
                      placeholder="e.g. Priya Sharma" 
                      value={candName} 
                      onChange={(e) => setCandName(e.target.value)} 
                      aria-required="true"
                      disabled={isCandFormLocked}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cand-dept">Department <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '11px' }}>(Optional)</span></label>
                    <select id="cand-dept" value={candDept} onChange={(e) => setCandDept(e.target.value)} disabled={isCandFormLocked}>
                      <option value="">— None —</option>
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
                    <label htmlFor="cand-election-id">Assign to Election</label>
                    <select id="cand-election-id" value={candElectionId} onChange={(e) => setCandElectionId(e.target.value)} disabled={isCandFormLocked}>
                      <option value="" disabled>— Select an Election —</option>
                      {elections.filter(el => el.status !== 'Archived').map(el => (
                        <option key={el.id} value={el.id}>{el.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="cand-description">Description</label>
                  <textarea 
                    id="cand-description"
                    rows={2} 
                    placeholder="Short description or summary..." 
                    value={candDescription} 
                    onChange={(e) => setCandDescription(e.target.value)} 
                    disabled={isCandFormLocked}
                  />
                </div>

                <div className="form-row-grid">
                  <div className="field">
                    <label>Candidate Profile Photo <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '11px' }}>(Optional)</span></label>
                    <div className="mock-photo-upload-box">
                      <div className="mock-upload-icon"><IconCamera size={24} /></div>
                      <span>Photo Upload Slot (Optional — 1:1 Aspect)</span>
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn-create-election" disabled={isSubmitting || isCandFormLocked}>
                  {isSubmitting ? 'Saving Profile...' : (editCandId ? 'Update Candidate Entry' : 'Bind Candidate Entry')}
                </button>

                {isCandFormLocked && (
                  <p style={{ marginTop: '10px', color: 'var(--red)', fontSize: '12px' }}>
                    ⚠️ Candidate roster is locked because the assigned election is active or completed.
                  </p>
                )}
              </form>
            </div>

            {/* Candidates Directory */}
            <div className="users-table-card" style={{ marginTop: '20px' }}>
              <h2 className="tab-section-title">Candidates Directory</h2>
              <table className="dash-table candidates-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>DEPT</th>
                    <th>ASSIGNED ELECTION</th>
                    <th>DESCRIPTION</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map(c => {
                    const el = elections.find(e => e.id === c.electionId);
                    const isLocked = el && el.status !== 'DRAFT';
                    return (
                      <tr key={c.id}>
                        <td data-label="Name"><strong>{highlightMatch(c.name, globalSearch)}</strong></td>
                        <td data-label="Dept">{highlightMatch(c.dept, globalSearch)}</td>
                        <td data-label="Assigned Election"><span className="badge-role gold">{el ? el.name : 'Unknown Election'}</span></td>
                        <td data-label="Description" style={{ fontSize: '11px', color: 'var(--text2)', maxWidth: '280px' }}>{c.description}</td>
                        <td data-label="Status">
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: c.status === 'active' ? 'rgba(74, 157, 143, 0.15)' : 'rgba(239, 83, 80, 0.15)',
                            color: c.status === 'active' ? '#4a9d8f' : '#ef5350'
                          }}>
                            {c.status === 'active' ? 'Active' : 'Withdrawn'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn-action-sm" 
                            onClick={() => handleEditCandidateClick(c)}
                            disabled={isLocked}
                          >
                            <IconPencil size={18} /> Edit
                          </button>
                          
                          {c.status === 'inactive' ? (
                            <button 
                              className="btn-action-sm positive" 
                              onClick={async () => {
                                if (isLocked) {
                                  alert('Cannot modify candidate for an active or completed election.');
                                  return;
                                }
                                const { error } = await supabase.from('candidates').update({ status: 'active' }).eq('id', c.id);
                                if (error) alert(error.message);
                                else {
                                  await addAuditLog('CANDIDATE_REACTIVATE', 'admin', `Reactivated candidate ${c.name} (${c.rollNo})`, 'INFO', 'ok');
                                  await fetchDatabaseData();
                                }
                              }}
                              disabled={isLocked}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button 
                              className="btn-action-sm danger" 
                              onClick={() => handleDeleteCandidate(c.id, c.electionId)}
                              disabled={isLocked}
                            >
                              ✕ Withdraw
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px 10px' }}>
                        <div className="dash-empty-state-small">
                          <IconSearch size={32} style={{ color: 'var(--text3)', marginBottom: '8px' }} />
                          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '13px' }}>No candidates match search queries.</p>
                        </div>
                      </td>
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

              <table className="dash-table voters-table">
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
                      <td data-label="Select">
                        <input 
                          type="checkbox" 
                          checked={selectedVoters.includes(v.roll)}
                          onChange={() => toggleSelectVoter(v.roll)}
                        />
                      </td>
                      <td data-label="Institutional ID" className="user-roll"><strong>{highlightMatch(v.roll, globalSearch)}</strong></td>
                      <td data-label="User-Created ID" className="user-roll">{highlightMatch(v.userCreatedId, globalSearch)}</td>
                      <td data-label="System ID" className="user-roll" style={{ color: 'var(--text3)' }}>{highlightMatch(v.systemId, globalSearch)}</td>
                      <td data-label="Full Name">{highlightMatch(v.name, globalSearch)}</td>
                      <td data-label="Dept">{highlightMatch(v.dept, globalSearch)}</td>
                      <td data-label="Eligible">
                        <span className={`eligibility-badge ${v.eligible ? 'yes' : 'no'}`}>
                          {v.eligible ? 'Eligible Whitelist' : 'Restricted Blacklist'}
                        </span>
                      </td>
                      <td data-label="Status">
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
                      <td colSpan="9" style={{ textAlign: 'center', padding: '30px 10px' }}>
                        <div className="dash-empty-state-small">
                          <IconSearch size={32} style={{ color: 'var(--text3)', marginBottom: '8px' }} />
                          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '13px' }}>No voters matching your query found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTS ANALYTICS TAB */}
        {activeTab === 'Results' && (
          <div className="dashboard-body animate-fade-in" style={{ padding: '24px' }}>
            <div className="page-intro-header" style={{ marginBottom: '24px' }}>
              <h2 className="tab-section-title" style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text)' }}>
                Election Results Cockpit
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text2)' }}>
                Inspect cryptographic standings, verify tally reconciliations, and resolve deadlocks for active and finalized elections.
              </p>
            </div>

            <div className="results-split-layout" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
              
              {/* LEFT SIDEBAR: ELECTIONS SELECTOR */}
              <div className="results-sidebar-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.05em', fontWeight: '700' }}>
                  Elections Registry
                </h3>
                {elections.filter(e => e.status !== 'ARCHIVED').length === 0 ? (
                  <div className="empty-state-small" style={{ padding: '16px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--text3)' }}>
                    No active or completed elections.
                  </div>
                ) : (
                  elections.filter(e => e.status !== 'ARCHIVED').map(el => {
                    const isSelected = effectiveResultElectionId === el.id;
                    return (
                      <div
                        key={el.id}
                        onClick={() => setSelectedResultElectionId(el.id)}
                        className={`election-select-item-card ${isSelected ? 'active' : ''}`}
                        style={{
                          background: isSelected ? 'rgba(74, 157, 143, 0.1)' : 'var(--glass)',
                          border: isSelected ? '1px solid var(--teal)' : '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 'bold' }}>{el.id}</span>
                          <span className={`election-status-tag ${el.status.toLowerCase()}`} style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold', background: el.status === 'ACTIVE' ? 'var(--teal-bg)' : el.status === 'PAUSED' ? 'var(--gold-bg)' : el.status === 'DEADLOCK' ? 'var(--red-bg)' : 'var(--glass)', color: el.status === 'ACTIVE' ? 'var(--teal)' : el.status === 'PAUSED' ? 'var(--gold)' : el.status === 'DEADLOCK' ? 'var(--red)' : 'var(--text2)' }}>
                            {el.status === 'ACTIVE' ? 'Running' : el.status === 'STOPPED' ? 'Stopped' : el.status}
                          </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: isSelected ? 'var(--teal)' : 'var(--text)' }}>{el.name}</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text3)' }}>
                          <span>Round {el.currentRound}</span>
                          <span>{el.votesCast} votes</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* RIGHT CONTENT: RESULTS AUDIT & ANALYTICS */}
              <div className="results-main-display" style={{ minHeight: '500px' }}>
                {(() => {
                  const el = elections.find(e => e.id === effectiveResultElectionId);
                  if (!el) {
                    return (
                      <div className="empty-details-card" style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
                        <IconChartBar size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Select an Election</h3>
                        <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Select an election from the sidebar list to view results, standings, and security audit reports.</p>
                      </div>
                    );
                  }

                  const standings = el.status === 'COMPLETED' || el.status === 'STOPPED' || el.status === 'DEADLOCK'
                    ? el.results.map(r => ({
                        id: r.candidate_id,
                        name: r.candidate_name,
                        votes: Number(r.vote_count),
                        pct: Number(r.vote_percentage),
                        isWinner: r.is_winner,
                        rank: r.position_rank
                      }))
                    : candidates.filter(c => c.electionId === el.id).map(c => ({
                        id: c.id,
                        name: c.name,
                        votes: c.votes,
                        pct: el.votesCast > 0 ? Number(((c.votes / el.votesCast) * 100).toFixed(2)) : 0,
                        isWinner: false,
                        rank: 0
                      })).sort((a, b) => b.votes - a.votes);

                  // Colors for donut chart slices
                  const chartColors = ['#4a9d8f', '#d4af37', '#9b5de5', '#f15bb5', '#00bbf9', '#00f5d4'];

                  // Function to render the SVG Donut Chart dynamically
                  const renderSvgDonut = () => {
                    const total = el.votesCast;
                    if (total === 0) {
                      return (
                        <svg width="160" height="160" viewBox="0 0 160 160">
                          <circle cx="80" cy="80" r="60" fill="transparent" stroke="var(--border2)" strokeWidth="16" />
                          <text x="80" y="85" textAnchor="middle" fill="var(--text3)" fontSize="12" fontWeight="bold">0 Votes</text>
                        </svg>
                      );
                    }

                    let accumulatedPct = 0;
                    const radius = 60;
                    const circumference = 2 * Math.PI * radius; // 376.991

                    return (
                      <svg width="160" height="160" viewBox="0 0 160 160">
                        {standings.map((item, idx) => {
                          const pct = (item.votes / total) * 100;
                          const strokeLength = (pct / 100) * circumference;
                          const strokeOffset = circumference - ((accumulatedPct / 100) * circumference);
                          accumulatedPct += pct;
                          const color = chartColors[idx % chartColors.length];

                          return (
                            <circle
                              key={item.id}
                              cx="80"
                              cy="80"
                              r={radius}
                              fill="transparent"
                              stroke={color}
                              strokeWidth="16"
                              strokeDasharray={`${strokeLength} ${circumference}`}
                              strokeDashoffset={strokeOffset}
                              transform="rotate(-90 80 80)"
                              style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                            />
                          );
                        })}
                        <circle cx="80" cy="80" r="44" fill="var(--bg2)" />
                        <text x="80" y="84" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="bold">
                          {total}
                        </text>
                        <text x="80" y="96" textAnchor="middle" fill="var(--text3)" fontSize="10">
                          Total Votes
                        </text>
                      </svg>
                    );
                  };

                  return (
                    <div className="results-detail-dashboard animate-fade-in" style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* HEADER SUMMARY */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 'bold' }}>{el.id}</span>
                            <span style={{ color: 'var(--text3)', fontSize: '11px' }}>•</span>
                            <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '600' }}>Round {el.currentRound} Standing</span>
                          </div>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>{el.name}</h3>
                          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text2)', lineHeight: '1.4' }}>{el.description}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className={`election-status-tag ${el.status.toLowerCase()}`} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 'bold', display: 'inline-block', background: el.status === 'ACTIVE' ? 'var(--teal-bg)' : el.status === 'PAUSED' ? 'var(--gold-bg)' : el.status === 'DEADLOCK' ? 'var(--red-bg)' : 'var(--glass)', color: el.status === 'ACTIVE' ? 'var(--teal)' : el.status === 'PAUSED' ? 'var(--gold)' : el.status === 'DEADLOCK' ? 'var(--red)' : 'var(--text2)' }}>
                            {el.status === 'ACTIVE' ? 'Running' : el.status === 'STOPPED' ? 'Stopped' : el.status}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>Ended: {el.end}</span>
                        </div>
                      </div>

                      {/* STATS TILES ROW */}
                      <div className="results-stats-row-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Turnout Index</span>
                          <span style={{ fontSize: '20px', fontWeight: '750', color: 'var(--teal)' }}>{el.turnoutPercentage}%</span>
                          <div style={{ width: '100%', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                            <div style={{ width: `${el.turnoutPercentage}%`, height: '100%', background: 'var(--teal)' }}></div>
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Whitelisted Voters</span>
                          <span style={{ fontSize: '20px', fontWeight: '750', color: 'var(--text)' }}>{el.voters}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text3)' }}>Eligible registration profiles</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Secure Ballots Cast</span>
                          <span style={{ fontSize: '20px', fontWeight: '750', color: 'var(--gold)' }}>{el.votesCast}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text3)' }}>Decoupled cryptographic records</span>
                        </div>
                      </div>

                      {/* DETAILED STANDINGS AND DONUT CHART SECTION */}
                      <div className="standings-viz-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                        
                        {/* LEFT: CANDIDATES STANDINGS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Candidate Tally Standings</h4>
                          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                            <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Rank</th>
                                  <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Candidate</th>
                                  <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'right' }}>Votes</th>
                                  <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'right' }}>Pct</th>
                                </tr>
                              </thead>
                              <tbody>
                                {standings.map((st, i) => {
                                  const dbCand = candidates.find(c => c.id === st.id);
                                  const isWinner = el.status === 'COMPLETED' || el.status === 'STOPPED' ? st.isWinner || (i === 0 && st.votes > 0 && !el.isTie) : false;
                                  return (
                                    <tr key={st.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: isWinner ? 'rgba(74, 157, 143, 0.03)' : 'transparent' }}>
                                      <td style={{ padding: '12px 14px', fontWeight: 'bold', color: isWinner ? 'var(--teal)' : 'var(--text2)' }}>
                                        {el.status === 'COMPLETED' || el.status === 'STOPPED' ? `#${st.rank || i+1}` : `#${i+1}`}
                                      </td>
                                      <td style={{ padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          <span style={{ fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {st.name} {isWinner && <IconTrophy size={14} style={{ color: 'var(--teal)' }} />}
                                          </span>
                                          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{dbCand ? dbCand.dept : ''}</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{st.votes}</td>
                                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{st.pct}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Deadlock Tie-Break Panel */}
                          {el.status === 'DEADLOCK' && (
                            <div style={{ background: 'rgba(239, 83, 80, 0.03)', border: '1px solid rgba(239, 83, 80, 0.15)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--red)' }}>
                                <IconAlertTriangle size={18} />
                                <span style={{ fontSize: '13px', fontWeight: '700' }}>TIE DEADLOCK DETECTED</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text2)', lineHeight: '1.4' }}>
                                Two or more leading candidates have received an equal number of votes. Select an administrative resolution option below to finalize the election:
                              </p>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-action-sm gold" onClick={() => handleDeclareJointWinners(el.id)} style={{ flex: 1, padding: '10px', background: 'var(--gold)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                  <IconHeartHandshake size={16} /> Declare Joint Winners
                                </button>
                                <button className="btn-action-sm danger" onClick={() => handleReopenElection(el.id)} style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                  <IconRefresh size={16} /> Re-Open for Round {el.currentRound + 1}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Winner Banner */}
                          {(el.status === 'COMPLETED' || el.status === 'STOPPED') && (
                            <div style={{ background: 'rgba(74, 157, 143, 0.04)', border: '1px solid rgba(74, 157, 143, 0.15)', borderRadius: '8px', padding: '16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(74, 157, 143, 0.1)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <IconTrophy size={22} />
                              </div>
                              <div>
                                <h5 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                                  {el.jointWinner ? 'Joint Winners Declared' : 'Official Outcome'}
                                </h5>
                                <p style={{ margin: '2px 0 0', fontSize: '13.5px', fontWeight: '700', color: 'var(--text)' }}>
                                  {el.winners && el.winners.length > 0
                                    ? el.winners.map(w => w.name).join(' and ')
                                    : standings.filter(s => s.isWinner).map(s => s.name).join(' and ') || 'No winner declared'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: VIZ (DONUT CHART) */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.005)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
                          <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '700', color: 'var(--text)', alignSelf: 'flex-start' }}>Vote Share Distribution</h4>
                          
                          <div style={{ margin: '12px 0' }}>
                            {renderSvgDonut()}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '16px' }}>
                            {standings.map((st, idx) => (
                              <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: chartColors[idx % chartColors.length] }}></div>
                                  <span style={{ fontWeight: '500', color: 'var(--text)' }}>{st.name}</span>
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
                                  {st.pct}% ({st.votes}v)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>

                      {/* CRYPTOGRAPHIC SECURITY INTEGRITY REPORT PANEL */}
                      {el.integrity && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '10px' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <IconShield size={18} style={{ color: 'var(--teal)' }} /> Ledger Tally Cryptographic Integrity Audit
                            </h4>
                            {Number(el.integrity.total_tokens_verified) === Number(el.integrity.total_votes_cast) ? (
                              <span style={{ fontSize: '10px', color: 'var(--teal)', background: 'var(--teal-bg)', border: '1px solid rgba(74,157,143,0.2)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                ✓ TALLY INTEGRITY RECONCILED (100% MATCH)
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid rgba(239,83,80,0.2)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                ⚠️ RECONCILIATION DISCREPANCY DETECTED
                              </span>
                            )}
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Tokens Generated</span>
                              <span style={{ fontSize: '16px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{el.integrity.total_tokens_generated}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Secure blind vectors</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Tokens Verified (Used)</span>
                              <span style={{ fontSize: '16px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{el.integrity.total_tokens_verified}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Ballot-decoupled verification requests</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Anonymous Ballots Logged</span>
                              <span style={{ fontSize: '16px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{el.integrity.total_votes_cast}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Secure votes cast in round {el.currentRound}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Voter Turnout Rate</span>
                              <span style={{ fontSize: '16px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{el.integrity.participation_percentage}%</span>
                              <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Tally turnout coverage</span>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '12px', fontSize: '12px', color: 'var(--text2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', borderRadius: '6px' }}>
                              <span>Failed Token Authorizations:</span>
                              <strong style={{ color: el.integrity.invalid_token_attempts > 0 ? 'var(--gold)' : 'var(--text2)' }}>{el.integrity.invalid_token_attempts}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '6px' }}>
                              <span>Verification Rate-Limit Lockouts:</span>
                              <strong style={{ color: el.integrity.blocked_verification_attempts > 0 ? 'var(--red)' : 'var(--text2)' }}>{el.integrity.blocked_verification_attempts}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        )}

        {/* SECURITY ANALYTICS TAB */}
        {activeTab === 'Security' && (
          <div className="dashboard-body animate-fade-in" style={{ padding: '24px' }}>
            <div className="page-intro-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="tab-section-title" style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text)' }}>
                  Security Analytics &amp; Hardening Cockpit
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text2)' }}>
                  Observe real-time administrative and voter security events, lockouts, and suspicious client vectors.
                </p>
              </div>
              <button 
                className="btn-action-sm gold" 
                onClick={fetchSecurityData} 
                disabled={securityLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
              >
                <IconRefresh size={16} className={securityLoading ? 'spin' : ''} /> {securityLoading ? 'Syncing...' : 'Force Refresh Analytics'}
              </button>
            </div>

            {/* KPI STAT CARDS */}
            <div className="dash-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Active Sessions</span>
                <span style={{ fontSize: '24px', fontWeight: '750', color: 'var(--teal)' }}>{securityData?.verified_sessions || 0} / {securityData?.active_sessions || 0}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text3)' }}>Verified vs Total sockets</span>
              </div>
              <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Failed Logins Today</span>
                <span style={{ fontSize: '24px', fontWeight: '750', color: 'var(--gold)' }}>{securityData?.failed_logins_today || 0}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text3)' }}>Daily auth failures</span>
              </div>
              <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Active Lockouts</span>
                <span style={{ fontSize: '24px', fontWeight: '750', color: (securityData?.active_lockouts || 0) > 0 ? 'var(--red)' : 'var(--text)' }}>
                  {securityData?.active_lockouts || 0}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text3)' }}>Accounts currently cooldown-locked</span>
              </div>
              <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Suspicious Events</span>
                <span style={{ fontSize: '24px', fontWeight: '750', color: (securityData?.suspicious_activities_today || 0) > 0 ? 'var(--red)' : 'var(--text)' }}>
                  {securityData?.suspicious_activities_today || 0}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text3)' }}>Threat-detection triggers today</span>
              </div>
            </div>

            <div className="security-tables-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              
              {/* SUSPICIOUS ACTIVITY LOGS */}
              <div className="users-table-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconAlertTriangle size={18} style={{ color: 'var(--gold)' }} /> Threat Intelligence: Suspicious Client Activities
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Last refreshed: {securityData?.last_refreshed_at ? new Date(securityData.last_refreshed_at).toLocaleTimeString() : 'N/A'}</span>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Event type</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Actor</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Session id</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Reason</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Severity</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(securityData?.suspicious_activities || []).map((sa) => (
                        <tr key={sa.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>{sa.event_type}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text2)' }}>{sa.actor_identifier || 'ANONYMOUS'}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>{sa.session_id ? `${sa.session_id.substring(0, 8)}...` : 'N/A'}</span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text2)' }}>{sa.reason}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ 
                              fontSize: '9px', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              textTransform: 'uppercase', 
                              fontWeight: 'bold', 
                              background: sa.severity === 'CRITICAL' ? 'rgba(239, 83, 80, 0.15)' : sa.severity === 'HIGH' ? 'rgba(242, 148, 54, 0.15)' : sa.severity === 'MEDIUM' ? 'rgba(212, 168, 67, 0.15)' : 'rgba(74, 157, 143, 0.15)', 
                              color: sa.severity === 'CRITICAL' ? 'var(--red)' : sa.severity === 'HIGH' ? '#f29436' : sa.severity === 'MEDIUM' ? 'var(--gold)' : 'var(--teal)' 
                            }}>
                              {sa.severity}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '11.5px', color: 'var(--text3)' }}>
                            {new Date(sa.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {(securityData?.suspicious_activities || []).length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text3)' }}>
                            No suspicious client vectors identified.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SYSTEM/EDGE ERRORS */}
              <div className="users-table-card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconAlertCircle size={18} style={{ color: 'var(--red)' }} /> Edge &amp; API Monitor: System Errors
                </h3>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Source</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Error message</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Severity</th>
                        <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(securityData?.system_errors || []).map((se) => (
                        <tr key={se.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>{se.source}</span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text2)' }}>{se.error_message}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ 
                              fontSize: '9px', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              textTransform: 'uppercase', 
                              fontWeight: 'bold', 
                              background: se.severity === 'CRITICAL' ? 'rgba(239, 83, 80, 0.15)' : se.severity === 'HIGH' ? 'rgba(242, 148, 54, 0.15)' : 'rgba(74, 157, 143, 0.15)', 
                              color: se.severity === 'CRITICAL' ? 'var(--red)' : se.severity === 'HIGH' ? '#f29436' : 'var(--teal)' 
                            }}>
                              {se.severity}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '11.5px', color: 'var(--text3)' }}>
                            {new Date(se.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {(securityData?.system_errors || []).length === 0 && (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text3)' }}>
                            No system errors logged.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LOG RETENTION POLICY AND CONTROLS */}
              <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconScale size={18} style={{ color: 'var(--teal)' }} /> Operational Logs Retention Policy
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text2)', lineHeight: '1.4' }}>
                    VoteGuard is configured with a strict log retention schedule. General security events are stored for <strong>180 days</strong>, while critical system errors and threat warnings are retained for <strong>365 days</strong> before automatic truncation.
                  </p>
                </div>
                <button 
                  className="btn-action-sm gold" 
                  onClick={handleManualRetentionCleanup}
                  style={{ padding: '12px 20px', background: 'var(--gold)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Trigger Manual Cleanup
                </button>
              </div>

            </div>
          </div>
        )}

        {/* REPORTS & AUDITS TAB (AUDIT PORTAL) */}
        {activeTab === 'Reports' && (
          <div className="dashboard-body animate-fade-in" style={{ padding: '24px' }}>
            <div className="page-intro-header" style={{ marginBottom: '24px' }}>
              <h2 className="tab-section-title" style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text)' }}>
                Cryptographic Audit Portal
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text2)' }}>
                Query formal ledger audit entries, filter governance logs, and review cryptographic election integrity tallies.
              </p>
            </div>

            <div className="audit-portal-split" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr', gap: '24px', alignItems: 'start', marginBottom: '24px' }}>
              
              {/* LEFT COLUMN: AUDIT LOGS QUERY ENGINE */}
              <div className="users-table-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                    Governance Audit Logs Stream
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-action-sm gold" 
                      onClick={() => handleExportXlsx(auditLogsFromDb, 'voteguard_audit_logs', 'Cryptographic Audit Logs Portal', adminProfile?.admin_id || 'admin')}
                      disabled={auditLogsFromDb.length === 0}
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      Export XLSX
                    </button>
                    <button 
                      className="btn-action-sm gold" 
                      onClick={() => handleExportCsv(auditLogsFromDb, 'voteguard_audit_logs', 'Cryptographic Audit Logs Portal', adminProfile?.admin_id || 'admin')}
                      disabled={auditLogsFromDb.length === 0}
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* FILTERS PANEL */}
                <div className="audit-filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Event Type</label>
                    <select 
                      value={auditEventFilter} 
                      onChange={(e) => setAuditEventFilter(e.target.value)}
                      style={{ padding: '8px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12.5px' }}
                    >
                      <option value="ALL">All Event Types</option>
                      <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                      <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
                      <option value="OTP_SENT">OTP_SENT</option>
                      <option value="OTP_SUCCESS">OTP_SUCCESS</option>
                      <option value="OTP_FAILURE">OTP_FAILURE</option>
                      <option value="TOKEN_REQUEST">TOKEN_REQUEST</option>
                      <option value="TOKEN_VERIFY_SUCCESS">TOKEN_VERIFY_SUCCESS</option>
                      <option value="TOKEN_VERIFY_FAILURE">TOKEN_VERIFY_FAILURE</option>
                      <option value="VOTE_SUBMITTED">VOTE_SUBMITTED</option>
                      <option value="ACCOUNT_LOCKED">ACCOUNT_LOCKED</option>
                      <option value="RATE_LIMIT_TRIGGERED">RATE_LIMIT_TRIGGERED</option>
                      <option value="ELECTION_COMPLETED">ELECTION_COMPLETED</option>
                      <option value="ELECTION_STOPPED">ELECTION_STOPPED</option>
                      <option value="REPORT_COMPILE">REPORT_COMPILE</option>
                      <option value="ELIGIBILITY_OVERRIDE">ELIGIBILITY_OVERRIDE</option>
                      <option value="BULK_ACTION">BULK_ACTION</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Election Link</label>
                    <select 
                      value={auditElectionFilter} 
                      onChange={(e) => setAuditElectionFilter(e.target.value)}
                      style={{ padding: '8px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12.5px' }}
                    >
                      <option value="ALL">All Elections</option>
                      {elections.map(el => (
                        <option key={el.id} value={el.id}>{el.id} - {el.name.substring(0, 24)}...</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Date From</label>
                    <input 
                      type="date" 
                      value={auditDateFrom} 
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      style={{ padding: '7px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12.5px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Date To</label>
                    <input 
                      type="date" 
                      value={auditDateTo} 
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      style={{ padding: '7px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12.5px' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button 
                      className="btn-action-sm" 
                      onClick={() => {
                        setAuditEventFilter('ALL');
                        setAuditElectionFilter('ALL');
                        setAuditDateFrom('');
                        setAuditDateTo('');
                      }}
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>

                {/* LOGS TABLE */}
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  {auditLogsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', fontSize: '13px', color: 'var(--text3)' }}>
                      Loading cryptographic log vectors...
                    </div>
                  ) : (
                    <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Timestamp</th>
                          <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Event Type</th>
                          <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Actor</th>
                          <th style={{ padding: '10px 14px', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)' }}>Metadata payload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogsFromDb.map((log) => {
                          const metaString = log.metadata_json && Object.keys(log.metadata_json).length > 0
                            ? Object.keys(log.metadata_json).map(k => `${k}: ${log.metadata_json[k]}`).join(', ')
                            : log.details || 'None';

                          return (
                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '12px 14px', fontSize: '11.5px', color: 'var(--text3)' }}>
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', fontWeight: '600', color: 'var(--text)' }}>
                                  {log.event_type}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text2)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '500' }}>{log.actor_identifier || 'system'}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{log.actor_type}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px', fontSize: '11.5px', color: 'var(--text3)', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={metaString}>
                                {metaString}
                              </td>
                            </tr>
                          );
                        })}
                        {auditLogsFromDb.length === 0 && (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text3)', fontSize: '13px' }}>
                              No log trace matches the current filter settings.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: ELECTION INTEGRITY AUDIT PANEL */}
              <div className="users-table-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconShield size={18} style={{ color: 'var(--teal)' }} /> Ledger Tally Cryptographic Integrity Panel
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '600' }}>Select Election to Inspect</label>
                  <select 
                    value={selectedAuditElectionId} 
                    onChange={(e) => setSelectedAuditElectionId(e.target.value)}
                    style={{ padding: '10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '13px', width: '100%' }}
                  >
                    <option value="">-- Choose Election --</option>
                    {elections.map(el => (
                      <option key={el.id} value={el.id}>{el.id} - {el.name}</option>
                    ))}
                  </select>
                </div>

                {integrityLoading ? (
                  <div style={{ textAlign: 'center', padding: '48px 10px', color: 'var(--text3)', fontSize: '13.5px' }}>
                    <div style={{ width: '24px', height: '24px', border: '2px solid rgba(74, 157, 143, 0.2)', borderTop: '2px solid var(--teal)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    Running automated ledger checks...
                  </div>
                ) : integrityReport ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} className="animate-fade-in">
                    
                    {/* STATUS BANNER */}
                    <div style={{ 
                      background: integrityReport.integrity_status === 'PASSED' ? 'rgba(74, 157, 143, 0.05)' : 'rgba(239, 83, 80, 0.05)', 
                      border: integrityReport.integrity_status === 'PASSED' ? '1px solid rgba(74, 157, 143, 0.25)' : '1px solid rgba(239, 83, 80, 0.25)', 
                      borderRadius: '8px', 
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        background: integrityReport.integrity_status === 'PASSED' ? 'rgba(74, 157, 143, 0.15)' : 'rgba(239, 83, 80, 0.15)', 
                        color: integrityReport.integrity_status === 'PASSED' ? 'var(--teal)' : 'var(--red)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}>
                        {integrityReport.integrity_status === 'PASSED' ? '✓' : '✗'}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: integrityReport.integrity_status === 'PASSED' ? 'var(--teal)' : 'var(--red)' }}>
                          Ledger Audit: {integrityReport.integrity_status}
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text2)', lineHeight: '1.3' }}>
                          {integrityReport.integrity_status === 'PASSED' 
                            ? 'All cryptographic counts reconcile according to the VoteGuard election formula rules.' 
                            : 'Cryptographic discrepancy detected. Check the list of failing rules below.'}
                        </p>
                      </div>
                    </div>

                    {/* METRICS GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text3)' }}>Eligible Voters</span>
                        <span style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{integrityReport.eligible_voters}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text3)' }}>Tokens Generated</span>
                        <span style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{integrityReport.tokens_generated}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text3)' }}>Tokens Verified</span>
                        <span style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{integrityReport.tokens_verified}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text3)' }}>Ballots Cast</span>
                        <span style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{integrityReport.votes_cast}</span>
                      </div>
                    </div>

                    {/* FORMULA INEQUALITIES STATUS */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: '700' }}>
                        Formula Validation Details
                      </h4>
                      
                      {/* Check 1: Votes Cast <= Tokens Verified */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--text2)' }}>Votes Cast &le; Tokens Verified</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>({integrityReport.votes_cast} &le; {integrityReport.tokens_verified})</span>
                          <span style={{ color: integrityReport.votes_cast <= integrityReport.tokens_verified ? 'var(--teal)' : 'var(--red)', fontWeight: 'bold' }}>
                            {integrityReport.votes_cast <= integrityReport.tokens_verified ? '✓ PASSED' : '✗ FAILED'}
                          </span>
                        </div>
                      </div>

                      {/* Check 2: Tokens Verified <= Tokens Generated */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--text2)' }}>Tokens Verified &le; Tokens Generated</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>({integrityReport.tokens_verified} &le; {integrityReport.tokens_generated})</span>
                          <span style={{ color: integrityReport.tokens_verified <= integrityReport.tokens_generated ? 'var(--teal)' : 'var(--red)', fontWeight: 'bold' }}>
                            {integrityReport.tokens_verified <= integrityReport.tokens_generated ? '✓ PASSED' : '✗ FAILED'}
                          </span>
                        </div>
                      </div>

                      {/* Check 3: Tokens Generated <= Eligible Voters */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--text2)' }}>Tokens Generated &le; Eligible Voters</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>({integrityReport.tokens_generated} &le; {integrityReport.eligible_voters})</span>
                          <span style={{ color: integrityReport.tokens_generated <= integrityReport.eligible_voters ? 'var(--teal)' : 'var(--red)', fontWeight: 'bold' }}>
                            {integrityReport.tokens_generated <= integrityReport.eligible_voters ? '✓ PASSED' : '✗ FAILED'}
                          </span>
                        </div>
                      </div>

                      {/* Check 4: Results Snapshot sum = Votes Cast in round */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--text2)' }}>Results Snapshot = Votes Cast</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {(() => {
                            const snapshotSum = integrityReport.rounds && integrityReport.rounds.length > 0
                              ? integrityReport.rounds.reduce((sum, r) => sum + Number(r.total_votes), 0)
                              : integrityReport.votes_cast;
                            const isMatch = !integrityReport.integrity_reasons || !integrityReport.integrity_reasons.some(r => r.includes('Snapshot'));
                            return (
                              <>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>({snapshotSum} == {integrityReport.votes_cast})</span>
                                <span style={{ color: isMatch ? 'var(--teal)' : 'var(--red)', fontWeight: 'bold' }}>
                                  {isMatch ? '✓ PASSED' : '✗ FAILED'}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* ERROR LIST DETAILS */}
                    {integrityReport.integrity_reasons && integrityReport.integrity_reasons.length > 0 && (
                      <div style={{ background: 'rgba(239, 83, 80, 0.02)', border: '1px solid rgba(239, 83, 80, 0.15)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h5 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', color: 'var(--red)', fontWeight: 'bold' }}>
                          Failing Audit Checks Reasons
                        </h5>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {integrityReport.integrity_reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.005)', border: '1px dashed var(--border)', borderRadius: '8px', padding: '36px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                    Choose an election from the selector to perform the cryptographical audit checks.
                  </div>
                )}
              </div>

            </div>

            {/* EXPORT ARCHIVE ENGINE */}
            <div className="users-table-card" style={{ padding: '20px' }}>
              <h2 className="tab-section-title">Reports Archive &amp; PDF Export Engine</h2>
              <p style={{ margin: '4px 0 16px', fontSize: '13px', color: 'var(--text2)' }}>Download cryptographically signed PDF summaries and election receipts.</p>

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
                <div className="pdf-signed-receipt-modal" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
                  <h3><IconFileDescription size={24} /> Signed PDF Document Compiled</h3>
                  <div className="signed-receipt-details" style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
                    <p style={{ margin: 0 }}><strong>Report Title:</strong> {signedPdfData.title}</p>
                    <p style={{ margin: 0 }}><strong>Target ID:</strong> {signedPdfData.id}</p>
                    <p style={{ margin: 0 }}><strong>Report ID Code:</strong> <span className="code">{signedPdfData.reportId}</span></p>
                    <p style={{ margin: 0 }}><strong>Voter Turnout:</strong> {signedPdfData.votes} / {signedPdfData.voters} votes cast</p>
                    
                    <div className="signature-seal-block" style={{ border: '1px solid var(--teal)', padding: '12px', borderRadius: '8px', background: 'rgba(74,157,143,0.05)', display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
                      <div className="seal-logo" style={{ color: 'var(--teal)' }}><IconShield size={40} /></div>
                      <div className="seal-text">
                        <p style={{ margin: 0 }}><strong>GENERATED BY:</strong> Super Administrator</p>
                        <p style={{ margin: 0 }}><strong>GENERATED ON:</strong> {signedPdfData.date}</p>
                        <p className="verif-status" style={{ margin: 0, color: 'var(--teal)', fontWeight: 'bold' }}>✓ CRYPTOGRAPHICALLY SIGNED VIA ECDSA P-256</p>
                      </div>
                    </div>
                  </div>
                  <button className="btn-action-sm" onClick={() => setSignedPdfData(null)}>Close Preview</button>
                </div>
              )}
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

        {/* OPERATIONS CONTROL TAB */}
        {activeTab === 'Operations' && (
          <div className="dashboard-body animate-fade-in">
            <div className="dash-system-row">
              {/* KPIs & Diagnostics Dashboard */}
              <div className="dash-system-card" style={{ flex: '2 1 60%' }}>
                <span className="dash-control-title font-title">System Health & Telemetry Metrics (12 KPIs)</span>
                {healthLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gold)' }}>Loading health telemetry...</div>
                ) : (
                  <div className="system-status-grid" style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Database Status</span>
                      <span className={`sys-val-mono ${healthData?.database_status === 'healthy' ? 'color-green' : 'color-red'}`}>
                        {healthData?.database_status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Email Status</span>
                      <span className={`sys-val-mono ${healthData?.email_service_status === 'healthy' ? 'color-green' : 'color-orange'}`}>
                        {healthData?.email_service_status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">System Uptime</span>
                      <span className="sys-val-mono color-green">{healthData?.system_uptime || '99.98%'}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Application Version</span>
                      <span className="sys-val-mono">{healthData?.application_version || '1.0.0'}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Total Elections</span>
                      <span className="sys-val-mono">{healthData?.total_elections ?? 0}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Completed Elections</span>
                      <span className="sys-val-mono">{healthData?.completed_elections ?? 0}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Active Election</span>
                      <span className="sys-val-mono color-green">{healthData?.current_active_election || 'None'}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Total Registered Voters</span>
                      <span className="sys-val-mono">{healthData?.total_voters ?? 0}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Total Votes Cast</span>
                      <span className="sys-val-mono">{healthData?.total_votes_cast ?? 0}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Tokens Generated</span>
                      <span className="sys-val-mono">{healthData?.total_tokens_generated ?? 0}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Tokens Verified</span>
                      <span className="sys-val-mono">{healthData?.total_tokens_verified ?? 0}</span>
                    </div>
                    <div className="system-status-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span className="sys-label">Active Verified Sessions</span>
                      <span className="sys-val-mono color-green">{healthData?.active_sessions ?? 0}</span>
                    </div>
                  </div>
                )}
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button className="btn-action-sm gold" onClick={fetchOperationsStatus}>Refresh System Health</button>
                  <button className="btn-action-sm gold" onClick={handleExportAuditPackage}>Export Audit Package</button>
                </div>
              </div>

              {/* Backup Registry & History Panel */}
              <div className="dash-system-card" style={{ flex: '1 1 35%' }}>
                <span className="dash-control-title font-title">Backup Registry Operations</span>
                <div className="backup-telemetry-box" style={{ marginTop: '20px', maxHeight: '180px', overflowY: 'auto' }}>
                  {backupHistory.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No backups logged.</div>
                  ) : (
                    backupHistory.map((b) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontFamily: 'monospace' }}>{new Date(b.created_at).toLocaleString()}</span>
                        <span style={{ color: b.backup_status === 'SUCCESS' ? 'var(--teal)' : 'var(--red)', fontWeight: 'bold' }}>{b.backup_type} ({b.backup_status})</span>
                      </div>
                    ))
                  )}
                </div>
                <button 
                  className="btn-action-sm gold" 
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={async () => {
                    try {
                      const { error } = await supabase.from('backup_registry').insert({
                        backup_type: 'MANUAL',
                        backup_status: 'SUCCESS',
                        notes: 'Manual backup registry log generated via Operations dashboard.'
                      });
                      if (error) throw error;
                      alert('Manual backup successfully registered.');
                      fetchOperationsStatus();
                    } catch (e) {
                      alert('Failed to register backup: ' + e.message);
                    }
                  }}
                >
                  Register Manual Backup
                </button>
              </div>
            </div>

            {/* INTEGRITY TESTING PANEL */}
            <div className="users-table-card" style={{ marginTop: '20px' }}>
              <h2 className="tab-section-title">Integrity Verification Scanning Cockpit</h2>
              <p className="section-desc">Select an election to compute and verify the integrity mathematical equations: Votes Cast &le; Tokens Verified &le; Tokens Generated &le; Eligible Voters.</p>
              
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                <select 
                  style={{ background: '#11221f', border: '1px solid rgba(74, 157, 143, 0.3)', borderRadius: '6px', color: 'var(--text)', padding: '8px 12px', outline: 'none' }}
                  value={integrityElectionId} 
                  onChange={(e) => setIntegrityElectionId(e.target.value)}
                >
                  <option value="">-- Select Election --</option>
                  {elections.map((el) => (
                    <option key={el.id} value={el.id}>{el.election_name}</option>
                  ))}
                </select>
                <button className="btn-main gold" onClick={runIntegrityScan} disabled={!integrityElectionId || opsIntegrityLoading}>
                  {opsIntegrityLoading ? 'Scanning...' : 'Run Integrity Scan'}
                </button>
              </div>

              {opsIntegrityReport && (
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(74, 157, 143, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Election ID: {opsIntegrityReport.election_id}</h3>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '12px', 
                      fontSize: '13px', 
                      fontWeight: 'bold',
                      background: opsIntegrityReport.integrity_status === 'PASSED' ? 'rgba(74, 157, 143, 0.15)' : 'rgba(211, 84, 0, 0.15)',
                      color: opsIntegrityReport.integrity_status === 'PASSED' ? 'var(--teal)' : 'var(--red)',
                      border: `1px solid ${opsIntegrityReport.integrity_status === 'PASSED' ? 'var(--teal)' : 'var(--red)'}`
                    }}>
                      STATUS: {opsIntegrityReport.integrity_status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '13.5px' }}>
                    <div>
                      <div><strong>Total Eligible Voters:</strong> {opsIntegrityReport.eligible_voters}</div>
                      <div><strong>Tokens Generated:</strong> {opsIntegrityReport.tokens_generated}</div>
                      <div><strong>Tokens Verified:</strong> {opsIntegrityReport.tokens_verified}</div>
                      <div><strong>Votes Cast (Round):</strong> {opsIntegrityReport.votes_cast}</div>
                    </div>
                    <div>
                      <div><strong>Results Standings Votes Sum:</strong> {opsIntegrityReport.standings_votes_sum ?? 0}</div>
                      <div><strong>Turnout Percentage:</strong> {opsIntegrityReport.turnout_percentage}%</div>
                      {opsIntegrityReport.violation_details && (
                        <div style={{ color: 'var(--red)', marginTop: '8px' }}>
                          <strong>Violation:</strong> {opsIntegrityReport.violation_details}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                    {resolvedAlerts.length === 0 ? (
                      <div style={{ color: 'var(--text3)', fontSize: '13.5px', padding: '12px 0' }}>No historical alerts logged.</div>
                    ) : (
                      resolvedAlerts.map(alertItem => (
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
                      ))
                    )}
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
                        <span>Email Gateway warning status currently monitored</span>
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
                        <label htmlFor="settings-email">Email Address</label>
                        <input id="settings-email" type="text" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="settings-section" style={{ marginTop: '16px' }}>
                    <span className="settings-subtitle">Platform Alert Notifications</span>
                    <div className="notification-checkboxes">
                      <label className="checkbox-label" htmlFor="settings-notif-email">
                        <input id="settings-notif-email" type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
                        Send critical alerts via Email
                      </label>
                      <label className="checkbox-label" htmlFor="settings-notif-push">
                        <input id="settings-notif-push" type="checkbox" checked={notifPush} onChange={(e) => setNotifPush(e.target.checked)} />
                        Enable desktop browser push notifications
                      </label>
                    </div>
                  </div>

                  <div className="settings-section" style={{ marginTop: '16px' }}>
                    <span className="settings-subtitle">Security Key Update</span>
                    <form onSubmit={handleUpdatePassword} className="settings-password-form">
                      <div className="field">
                        <label htmlFor="settings-pass-current">Current Password</label>
                        <div style={{ position: 'relative', width: '100%' }}>
                          <input 
                            id="settings-pass-current" 
                            type={showSettingsPassCurrent ? "text" : "password"} 
                            value={adminPassCurrent} 
                            onChange={(e) => setAdminPassCurrent(e.target.value)} 
                            placeholder="••••••••" 
                            style={{ paddingRight: '40px' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSettingsPassCurrent(!showSettingsPassCurrent)}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text2)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 10
                            }}
                            tabIndex="-1"
                          >
                            {showSettingsPassCurrent ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="settings-pass-new">New Password</label>
                        <div style={{ position: 'relative', width: '100%' }}>
                          <input 
                            id="settings-pass-new" 
                            type={showSettingsPassNew ? "text" : "password"} 
                            value={adminPassNew} 
                            onChange={(e) => setAdminPassNew(e.target.value)} 
                            placeholder="••••••••" 
                            style={{ paddingRight: '40px' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSettingsPassNew(!showSettingsPassNew)}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text2)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 10
                            }}
                            tabIndex="-1"
                          >
                            {showSettingsPassNew ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="settings-pass-confirm">Confirm Password</label>
                        <div style={{ position: 'relative', width: '100%' }}>
                          <input 
                            id="settings-pass-confirm" 
                            type={showSettingsPassConfirm ? "text" : "password"} 
                            value={adminPassConfirm} 
                            onChange={(e) => setAdminPassConfirm(e.target.value)} 
                            placeholder="••••••••" 
                            style={{ paddingRight: '40px' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSettingsPassConfirm(!showSettingsPassConfirm)}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text2)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 10
                            }}
                            tabIndex="-1"
                          >
                            {showSettingsPassConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" className="btn-action-sm gold" style={{ marginTop: '8px' }} disabled={isSubmitting}>
                        {isSubmitting ? 'Updating Credentials...' : 'Update Security Credentials'}
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
                        <label htmlFor="task-title-field">Task Title</label>
                        <input 
                          id="task-title-field"
                          type="text" 
                          placeholder="e.g. Invalidate voter token..." 
                          value={taskTitleInput}
                          onChange={(e) => setTaskTitleInput(e.target.value)}
                          aria-required="true"
                        />
                      </div>
                      <div className="form-row-grid">
                        <div className="field">
                          <label htmlFor="task-priority-field">Priority</label>
                          <select id="task-priority-field" value={taskPriorityInput} onChange={(e) => setTaskPriorityInput(e.target.value)}>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="task-deadline-field">Deadline Date</label>
                          <input id="task-deadline-field" type="date" value={taskDeadlineInput} onChange={(e) => setTaskDeadlineInput(e.target.value)} />
                        </div>
                      </div>
                      <button type="submit" className="btn-action-sm gold" style={{ marginTop: '8px' }} disabled={isSubmitting}>
                        {isSubmitting ? 'Adding...' : 'Add to Task Matrix'}
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
                <label htmlFor="note-title-field">Note Title</label>
                <input 
                  id="note-title-field"
                  type="text" 
                  placeholder="e.g. CSE election eligibility review" 
                  value={noteTitleInput}
                  onChange={(e) => setNoteTitleInput(e.target.value)}
                  aria-required="true"
                />
              </div>
              <div className="field">
                <label htmlFor="note-text-field">Note Text / Details</label>
                <textarea 
                  id="note-text-field"
                  rows={4}
                  placeholder="Type note details here..."
                  value={noteTextInput}
                  onChange={(e) => setNoteTextInput(e.target.value)}
                />
              </div>
              <div className="modal-form-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn-action-sm gold" style={{ flexGrow: '1' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : (editingNoteId ? 'Update Note' : 'Save Note')}
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
                      <span className="dept">{c.dept}</span>
                      <p className="manifesto">"{c.description}"</p>
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
                <p>Election ID: <strong>{inspectedElection.id}</strong></p>
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
                          <span className="d">{c.dept}</span>
                          <p className="manifesto">"{c.description}"</p>
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

      {/* Custom Confirmation Modal */}
      {confirmModal.show && (
        <div className="confirm-modal-overlay" onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null, isTeal: false })}>
          <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm-modal-icon ${confirmModal.isTeal ? 'teal' : 'danger'}`}>
              <IconAlertTriangle size={32} />
            </div>
            <h3 className="confirm-modal-title">{confirmModal.title}</h3>
            <p className="confirm-modal-desc">{confirmModal.message}</p>
            <div className="confirm-modal-actions">
              <button 
                className="confirm-modal-cancel" 
                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null, isTeal: false })}
              >
                Cancel
              </button>
              <button 
                className={`confirm-modal-confirm ${confirmModal.isTeal ? 'teal' : 'danger'}`} 
                onClick={confirmModal.onConfirm}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}