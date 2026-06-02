import { useState, useEffect } from 'react';
import LogoMark from './LogoMark';
import ThemeToggle from './ThemeToggle';
import '../styles/VoterNavigation.css';

export default function VoterNavigation({
  activeTab,
  setActiveTab,
  voter,
  notifications,
  onMarkAllRead,
  onClearNotification,
  onLogout
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scroll for sticky blur transitions
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { id: 'Home', label: 'Home', icon: (
      <svg viewBox="0 0 24 24" className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { id: 'My Elections', label: 'My Elections', icon: (
      <svg viewBox="0 0 24 24" className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    )},
    { id: 'Results', label: 'Results', icon: (
      <svg viewBox="0 0 24 24" className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )},
    { id: 'Activity', label: 'Activity', icon: (
      <svg viewBox="0 0 24 24" className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )},
    { id: 'Verification', label: 'Verification', icon: (
      <svg viewBox="0 0 24 24" className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 11 11 13 15 9" />
      </svg>
    )},
    { id: 'Help', label: 'Help', icon: (
      <svg viewBox="0 0 24 24" className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )}
  ];

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    setDrawerOpen(false);
    setNotificationsOpen(false);
  };

  return (
    <>
      {/* DESKTOP TOP NAVIGATION BAR */}
      <header className={`voter-navbar-desktop ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          {/* Left brand area */}
          <div className="nav-brand-group" onClick={() => handleTabSelect('Home')}>
            <LogoMark size={14} />
            <div className="brand-text-wrap">
              <span className="brand-title">VoteGuard</span>
              <span className="brand-tagline">Secure Election Governance Platform</span>
            </div>
          </div>

          {/* Center Links */}
          <nav className="nav-links-center">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-link-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleTabSelect(item.id)}
              >
                {item.label}
                {activeTab === item.id && <span className="nav-indicator-bar" />}
              </button>
            ))}
          </nav>

          {/* Right Profile / Controls */}
          <div className="nav-controls-right">
            <ThemeToggle />

            {/* Notification Bell */}
            <div className="notification-bell-container">
              <button 
                className={`nav-btn-icon ${notificationsOpen ? 'active' : ''}`} 
                onClick={() => { setNotificationsOpen(!notificationsOpen); setDrawerOpen(false); }}
                aria-label="Notifications"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && <span className="bell-badge-count">{unreadCount}</span>}
              </button>

              {/* Dropdown Card */}
              {notificationsOpen && (
                <div className="notifications-dropdown-card">
                  <div className="dropdown-header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <button className="btn-link-action" onClick={onMarkAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="dropdown-body">
                    {notifications.length === 0 ? (
                      <div className="notifications-empty">No announcements or alerts</div>
                    ) : (
                      notifications.map((notif) => (
                        <div key={notif.id} className={`notification-item ${notif.read ? 'read' : 'unread'}`}>
                          <div className="notif-content-wrap">
                            <div className="notif-header-line">
                              <span className="notif-badge-type">{notif.type}</span>
                              <button className="notif-clear-btn" onClick={() => onClearNotification(notif.id)}>×</button>
                            </div>
                            <p className="notif-msg">{notif.message}</p>
                            <span className="notif-time">{notif.time}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="profile-badge-desktop">
              <div className="profile-avatar-circle" style={{ background: 'linear-gradient(135deg, var(--teal), var(--teal3))' }}>
                {voter.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="profile-info-text">
                <span className="profile-name">{voter.name}</span>
                <span className="profile-role">Voter Account</span>
              </div>
            </div>

            {/* Logout Button */}
            <button className="btn-nav-logout" onClick={onLogout} title="Log Out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-logout-icon">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE TOP BANNER */}
      <header className={`voter-navbar-mobile ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-brand-group" onClick={() => handleTabSelect('Home')}>
          <LogoMark size={12} />
          <span className="brand-title-mobile">VoteGuard</span>
        </div>

        <div className="nav-controls-mobile">
          <ThemeToggle />

          {/* Notification Bell */}
          <div className="notification-bell-container">
            <button 
              className={`nav-btn-icon ${notificationsOpen ? 'active' : ''}`}
              onClick={() => { setNotificationsOpen(!notificationsOpen); setDrawerOpen(false); }}
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && <span className="bell-badge-count">{unreadCount}</span>}
            </button>

            {/* Mobile Dropdown Card */}
            {notificationsOpen && (
              <div className="notifications-dropdown-card mobile-dropdown">
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <button className="btn-link-action" onClick={onMarkAllRead}>
                      Mark read
                    </button>
                  )}
                </div>
                <div className="dropdown-body">
                  {notifications.length === 0 ? (
                    <div className="notifications-empty">No announcements or alerts</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className={`notification-item ${notif.read ? 'read' : 'unread'}`}>
                        <div className="notif-content-wrap">
                          <div className="notif-header-line">
                            <span className="notif-badge-type">{notif.type}</span>
                            <button className="notif-clear-btn" onClick={() => onClearNotification(notif.id)}>×</button>
                          </div>
                          <p className="notif-msg">{notif.message}</p>
                          <span className="notif-time">{notif.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Profile Avatar Trigger */}
          <button className="mobile-profile-trigger-btn" onClick={() => { setDrawerOpen(true); setNotificationsOpen(false); }}>
            <div className="profile-avatar-circle mini">
              {voter.name.split(' ').map(n => n[0]).join('')}
            </div>
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="voter-bottom-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`bottom-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => handleTabSelect(item.id)}
          >
            <div className="bottom-nav-icon-wrap">
              {item.icon}
            </div>
            <span className="bottom-nav-label">{item.label === 'My Elections' ? 'Elections' : item.label}</span>
            {activeTab === item.id && <span className="bottom-active-dot" />}
          </button>
        ))}

        {/* Profile Item trigger Drawer */}
        <button
          className={`bottom-nav-item ${drawerOpen ? 'active' : ''}`}
          onClick={() => { setDrawerOpen(true); setNotificationsOpen(false); }}
        >
          <div className="bottom-nav-icon-wrap">
            <svg viewBox="0 0 24 24" className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="bottom-nav-label">Profile</span>
          {drawerOpen && <span className="bottom-active-dot" />}
        </button>
      </nav>

      {/* MOBILE SIDE DRAWER */}
      <div className={`drawer-overlay-backdrop ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`mobile-profile-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header-wrap">
          <div className="drawer-header-brand">
            <LogoMark size={10} />
            <span>VoteGuard Platform</span>
          </div>
          <button className="drawer-close-btn" onClick={() => setDrawerOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drawer-close-svg">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Voter details Widget */}
        <div className="drawer-profile-info-widget">
          <div className="drawer-avatar-wrap">
            <div className="profile-avatar-circle large" style={{ background: 'linear-gradient(135deg, var(--teal), var(--teal3))' }}>
              {voter.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="drawer-badge-indicator green-pulse">Eligible</div>
          </div>
          <div className="drawer-voter-metadata">
            <h2 className="drawer-voter-name">{voter.name}</h2>
            <div className="drawer-meta-row">
              <span className="meta-lbl">User ID:</span>
              <span className="meta-val">{voter.userId}</span>
            </div>
            <div className="drawer-meta-row">
              <span className="meta-lbl">Dept:</span>
              <span className="meta-val">{voter.department}</span>
            </div>
            <div className="drawer-meta-row">
              <span className="meta-lbl">Election Status:</span>
              <span className="meta-val status-active">{voter.electionStatus}</span>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="drawer-menu-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`drawer-menu-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleTabSelect(item.id)}
            >
              <span className="drawer-menu-icon">{item.icon}</span>
              {item.label === 'Help' ? 'Help Center' : item.label}
            </button>
          ))}
          <button 
            className="drawer-menu-btn" 
            onClick={() => { setDrawerOpen(false); alert('Settings module is currently under secure admin lock.'); }}
          >
            <span className="drawer-menu-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-svg">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            Settings
          </button>
          
          <div className="drawer-menu-divider" />
          
          <button className="drawer-menu-btn logout-btn-drawer" onClick={onLogout}>
            <span className="drawer-menu-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon-svg">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            Logout Session
          </button>
        </div>
      </aside>
    </>
  );
}
