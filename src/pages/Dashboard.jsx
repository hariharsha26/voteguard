import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Dashboard'); // 'Dashboard' | 'Elections' | 'Users' | 'Audit Logs' | 'System'
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const navigate = useNavigate();
// Simulated Audit Logs State with starting items
  const [logs, setLogs] = useState([
    { ts: '14:28:40', ev: 'CONFIG_UPDATE', usr: 'admin', desc: 'saved', status: 'ok' },
    { ts: '14:29:01', ev: 'ELECTION_START', usr: 'admin', desc: 'election_05', status: 'ok' },
    { ts: '14:29:44', ev: 'OTP_VERIFY', usr: 'user_4818', desc: 'success', status: 'ok' },
    { ts: '14:30:12', ev: 'RATE_LIMIT', usr: 'user_4799', desc: 'blocked', status: 'warn' },
    { ts: '14:31:30', ev: 'ELIGIBILITY', usr: 'user_4819', desc: 'validated', status: 'ok' },
    { ts: '14:31:55', ev: 'OTP_VERIFY', usr: 'user_4820', desc: 'success', status: 'ok' },
    { ts: '14:31:58', ev: 'TOKEN_GEN', usr: 'user_4820', desc: 'election_05', status: 'ok' },
    { ts: '14:32:01', ev: 'VOTE_CAST', usr: 'user_4821', desc: 'election_05', status: 'ok' },
  ]);

  // Elections Mock State
  const [elections, setElections] = useState([
    { id: 'ELC001', name: 'Student Council President 2026', start: '2026-06-01', end: '2026-06-03', turnout: '94%', voters: 2150, status: 'Active' },
    { id: 'ELC002', name: 'Senate Representative Poll', start: '2026-06-01', end: '2026-06-02', turnout: '82%', voters: 650, status: 'Active' },
    { id: 'ELC003', name: 'Alumni Association Board Selection', start: '2026-05-15', end: '2026-05-17', turnout: '91%', voters: 3101, status: 'Completed' },
  ]);

  // Users Mock State
  const [voters] = useState([
    { roll: '21CS001', name: 'Aarav Mehta', dept: 'CSE', status: 'Voted' },
    { roll: '21CS042', name: 'Priya Sharma', dept: 'CSE', status: 'Voted' },
    { roll: '22EC015', name: 'Rohan Verma', dept: 'ECE', status: 'Registered' },
    { roll: '23ME089', name: 'Aditya Nair', dept: 'ME', status: 'Pending' },
    { roll: '21CS102', name: 'Ananya Iyer', dept: 'CSE', status: 'Voted' },
    { roll: '22EC144', name: 'Kabir Kapoor', dept: 'ECE', status: 'Registered' },
    { roll: '23EE005', name: 'Sneha Patel', dept: 'EE', status: 'Pending' },
    { roll: '21IT054', name: 'Vikram Singh', dept: 'IT', status: 'Voted' },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const logEndRef = useRef(null);

  // Live Clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Audit Log Stream Effect
  useEffect(() => {
    const events = ['VOTE_CAST', 'TOKEN_GEN', 'OTP_VERIFY', 'ELIGIBILITY', 'RATE_LIMIT', 'LOGIN_ATTEMPT'];
    const users = ['user_5101', 'user_3402', 'user_7721', 'user_8820', 'user_9015', 'admin'];
    const descriptions = ['election_05', 'success', 'validated', 'blocked', 'failed_attempt'];

    const interval = setInterval(() => {
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
      
      let status = 'ok';
      if (randomDesc === 'blocked') status = 'warn';
      if (randomDesc === 'failed_attempt') status = 'err';

      const newLog = {
        ts: new Date().toLocaleTimeString(),
        ev: randomEvent,
        usr: randomUser,
        desc: randomDesc,
        status: status,
      };

      setLogs((prevLogs) => {
        const nextLogs = [...prevLogs, newLog];
        // Keep the logs list contained to last 40 logs
        return nextLogs.slice(-40);
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom of logs on update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const toggleElectionStatus = (id) => {
    setElections(prevElections =>
      prevElections.map(el => {
        if (el.id === id) {
          const nextStatus = el.status === 'Active' ? 'Paused' : el.status === 'Paused' ? 'Active' : el.status;
          return { ...el, status: nextStatus };
        }
        return el;
      })
    );
  };

  const stopElection = (id) => {
    if (window.confirm('Are you sure you want to stop this election permanently? This action is immutable.')) {
      setElections(prevElections =>
        prevElections.map(el => {
          if (el.id === id) {
            return { ...el, status: 'Completed' };
          }
          return el;
        })
      );
    }
  };

  // Filter voters on search
  const filteredVoters = voters.filter(voter =>
    voter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    voter.roll.toLowerCase().includes(searchTerm.toLowerCase()) ||
    voter.dept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogout = () => {
    navigate('/portal');
  };

  // Chart configurations
  const chartVals = [40, 62, 55, 75, 88, 70, 94];
  const chartColors = ['#2a4a44', '#3a6a62', '#2a4a44', '#4a7a72', '#4a9d8f', '#3a7a70', '#5abcb0'];
  const chartDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

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
            {['Dashboard', 'Elections', 'Users', 'Audit Logs', 'System'].map((tab) => (
              <button
                key={tab}
                className={`sidebar-nav-item ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <div className="sidebar-nav-dot"></div>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="admin-badge">
            <div className="admin-avatar">AD</div>
            <div className="admin-info">
              <span className="admin-name">VGADM001</span>
              <span className="admin-role">Platform Operator</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Terminate Session</button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="dashboard-main">
        {/* HEADER BAR */}
        <div className="dashboard-header">
          <div className="dashboard-title-area">
            <h1 className="dashboard-title">{activeTab === 'Dashboard' ? 'Administrator Cockpit' : activeTab}</h1>
            <span className="dashboard-subtitle">VoteGuard Secure Election Governance · v2.4.1</span>
          </div>

          <div className="dashboard-meta">
            <ThemeToggle />
            <div className="system-time">GMT/UTC {time}</div>
          </div>
        </div>


        {/* CORE DASHBOARD TAB VIEW */}
        {activeTab === 'Dashboard' && (
          <div className="dashboard-body">
            
            {/* STAT CARDS */}
            <div className="dash-stats-grid">
              <div className="dash-stat-card">
                <span className="dash-stat-label">Votes Cast</span>
                <span className="dash-stat-value">2,847</span>
                <span className="dash-stat-sub positive">↑ 94.2% turnout</span>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-label">Active Elections</span>
                <span className="dash-stat-value">
                  {elections.filter(e => e.status === 'Active').length}
                </span>
                <span className="dash-stat-sub neutral">Live polls in progress</span>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-label">Audit Events</span>
                <span className="dash-stat-value">14.2k</span>
                <span className="dash-stat-sub positive">Cryptographically signed</span>
              </div>
            </div>

            {/* CHART & TERMINAL ROW */}
            <div className="dash-analytics-row">
              {/* Participation trend chart */}
              <div className="dash-chart-card">
                <div className="dash-chart-header">
                  <span className="dash-chart-title">PARTICIPATION TREND — 7 DAYS</span>
                  <div className="dash-chart-legend">
                    <span className="legend-item"><span className="legend-color" style={{ background: 'var(--teal)' }}></span>Turnout %</span>
                  </div>
                </div>

                <div className="dash-bars-container">
                  {chartVals.map((v, i) => (
                    <div 
                      key={i} 
                      className="dash-bar-item" 
                      style={{ 
                        height: `${v}%`, 
                        background: chartColors[i],
                        animationDelay: `${i * 0.08}s`
                      }} 
                    />
                  ))}
                </div>

                <div className="dash-chart-labels">
                  {chartDays.map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Terminal audit log stream */}
              <div className="dash-terminal-card">
                <div className="dash-terminal-header">
                  <span className="dash-terminal-title">REAL-TIME AUDIT STREAM</span>
                  <div className="terminal-status">
                    <div className="terminal-status-dot"></div>
                    <span>Active Observability</span>
                  </div>
                </div>

                <div className="dash-terminal-log">
                  {logs.map((log, index) => (
                    <div key={index}>
                      <span className="ts">[{log.ts}]</span>
                      {log.status === 'ok' && <span className="ok">✓</span>}
                      {log.status === 'warn' && <span className="warn">⚡</span>}
                      {log.status === 'err' && <span className="err">✕</span>}
                      <span className="ev">{log.ev}</span>
                      <span className="user">{log.usr}</span> · {log.desc}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>

            {/* CONTROL TILES & SYSTEM HEALTH STATUS */}
            <div className="dash-system-row">
              {/* Controls */}
              <div className="dash-control-card">
                <span className="dash-control-title">Administrative Control Totals</span>
                <div className="control-grid">
                  <div className="control-tile">
                    <div className="tile-label">Total Voters</div>
                    <div className="tile-value">3,021</div>
                    <div className="tile-trend">↑ 12 new today</div>
                  </div>
                  <div className="control-tile">
                    <div className="tile-label">Elections Run</div>
                    <div className="tile-value">47</div>
                    <div className="tile-trend">3 active now</div>
                  </div>
                  <div className="control-tile">
                    <div className="tile-label">Avg. Turnout</div>
                    <div className="tile-value">91%</div>
                    <div className="tile-trend">↑ 4% this term</div>
                  </div>
                  <div className="control-tile">
                    <div className="tile-label">Audit Engine</div>
                    <div className="tile-value">142k</div>
                    <div className="tile-trend">Integrity OK</div>
                  </div>
                </div>
              </div>

              {/* Infrastructure */}
              <div className="dash-system-card">
                <span className="dash-control-title">Infrastructure Health Observability</span>
                <div className="system-status-grid">
                  <div className="system-status-row">
                    <span className="sys-label">Application Platform Layer</span>
                    <span className="sys-value-badge healthy">Healthy</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Cryptographic Ballot Database</span>
                    <span className="sys-value-badge healthy">Online</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Live Audit Trace Logger</span>
                    <span className="sys-value-badge healthy">Active</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Two-Factor OTP Relay Service</span>
                    <span className="sys-value-badge degraded">Degraded</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ELECTIONS VIEW */}
        {activeTab === 'Elections' && (
          <div className="dashboard-body">
            <div className="elections-view-container">
              <div className="view-action-bar">
                <h2 className="dashboard-subtitle" style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Registered Election Life-cycles</h2>
                <button className="btn-create-election" onClick={() => alert('New election template module activated.')}>+ Configure Election</button>
              </div>

              <div className="elections-list">
                {elections.map((el) => (
                  <div key={el.id} className="election-list-item">
                    <div className="election-meta-left">
                      <span className="election-item-title">{el.name}</span>
                      <span className="election-item-dates">Duration: {el.start} to {el.end} · ID: {el.id}</span>
                    </div>

                    <div className="election-meta-center">
                      <div className="item-stat">
                        <span className="item-stat-lbl">Registered Voters</span>
                        <span className="item-stat-val">{el.voters}</span>
                      </div>
                      <div className="item-stat">
                        <span className="item-stat-lbl">Average Turnout</span>
                        <span className="item-stat-val">{el.turnout}</span>
                      </div>
                      <span className={`election-status-tag ${el.status.toLowerCase()}`}>
                        {el.status}
                      </span>
                    </div>

                    <div className="election-actions">
                      {(el.status === 'Active' || el.status === 'Paused') && (
                        <>
                          <button className="btn-action-sm" onClick={() => toggleElectionStatus(el.id)}>
                            {el.status === 'Active' ? '⏸ Pause' : '▶ Resume'}
                          </button>
                          <button className="btn-action-sm danger" onClick={() => stopElection(el.id)}>
                            ✕ Stop Poll
                          </button>
                        </>
                      )}
                      {el.status === 'Completed' && (
                        <button className="btn-action-sm" onClick={() => alert('Downloading cryptographic audit bundle...')}>
                          📥 Audit Report
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* USERS VIEW */}
        {activeTab === 'Users' && (
          <div className="dashboard-body">
            <div className="users-table-card">
              <input 
                type="text" 
                className="table-search-bar" 
                placeholder="Search by student name, roll number, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <table className="dash-table">
                <thead>
                  <tr>
                    <th>ROLL NUMBER</th>
                    <th>FULL NAME</th>
                    <th>DEPARTMENT</th>
                    <th>PARTICIPATION STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.map((v) => (
                    <tr key={v.roll}>
                      <td className="user-roll">{v.roll}</td>
                      <td>{v.name}</td>
                      <td>{v.dept}</td>
                      <td>
                        <span className={`user-status-dot ${v.status.toLowerCase()}`}></span>
                        {v.status}
                      </td>
                    </tr>
                  ))}
                  {filteredVoters.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text3)' }}>No voters matching your query found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT LOGS VIEW */}
        {activeTab === 'Audit Logs' && (
          <div className="dashboard-body">
            <div className="users-table-card" style={{ padding: '0' }}>
              <div 
                className="dash-terminal-header" 
                style={{ 
                  padding: '24px 24px 16px', 
                  borderBottom: '1px solid var(--border)',
                  marginBottom: '0'
                }}
              >
                <span className="dash-terminal-title" style={{ fontSize: '13px' }}>EXPANDED CRYPTOGRAPHIC SYSTEM AUDIT TRACE</span>
                <span className="system-time">SHA-256 Integrity Verification: PASS</span>
              </div>
              
              <div 
                className="dash-terminal-log" 
                style={{ 
                  height: '480px', 
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '0',
                  padding: '24px'
                }}
              >
                {[...logs].reverse().map((log, index) => (
                  <div key={index} style={{ marginBottom: '6px' }}>
                    <span className="ts">[{log.ts}]</span>
                    {log.status === 'ok' && <span className="ok">✓</span>}
                    {log.status === 'warn' && <span className="warn">⚡</span>}
                    {log.status === 'err' && <span className="err">✕</span>}
                    <span className="ev">{log.ev}</span>
                    <span className="user">{log.usr}</span> · {log.desc} · block_hash=e3b0c442...8f378a1a
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM OBSERVABILITY VIEW */}
        {activeTab === 'System' && (
          <div className="dashboard-body">
            <div className="dash-system-row">
              <div className="dash-system-card">
                <span className="dash-control-title">Cluster System Resource Gauges</span>
                <div className="system-status-grid" style={{ marginTop: '20px' }}>
                  <div className="system-status-row">
                    <span className="sys-label">Primary API CPU Utilization</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>14.2%</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Ballot Database Memory Pool</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>512MB / 4096MB</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Network Transport Stream Latency</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--teal)' }}>12ms (Optimal)</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Active Socket Handshakes</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>244 open</span>
                  </div>
                </div>
              </div>

              <div className="dash-system-card">
                <span className="dash-control-title">Active Security Policies</span>
                <div className="system-status-grid" style={{ marginTop: '20px' }}>
                  <div className="system-status-row">
                    <span className="sys-label">Session Token Rotation Duration</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--gold)' }}>15 mins</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Transport Shield Protocol</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>TLS 1.3 Strict</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Cryptographic Algorithm Engine</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>ECDSA P-256</span>
                  </div>
                  <div className="system-status-row">
                    <span className="sys-label">Access Restriction Filters</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>Progressive lockout (30s)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
