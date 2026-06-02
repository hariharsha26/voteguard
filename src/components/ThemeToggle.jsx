import { useState, useEffect } from 'react';
import { IconMoon, IconSun } from '@tabler/icons-react';

/**
 * Premium switch-type Theme Toggle component.
 * Synchronizes with localStorage and applies the data-theme attribute to documentElement.
 */
export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light';
  });

  useEffect(() => {
    const theme = isLight ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [isLight]);

  return (
    <div className="theme-toggle-wrap" title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}>
      <svg className="toggle-label-icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
        <path d="M21 13.2A7.5 7.5 0 0 1 10.8 3 8.8 8.8 0 1 0 21 13.2Z" />
      </svg>
      <button
        type="button"
        className={`theme-toggle-switch ${isLight ? 'active' : ''}`}
        onClick={() => setIsLight(!isLight)}
        aria-label="Toggle color theme"
      >
        <span className="theme-toggle-knob"></span>
      </button>
      <svg className="toggle-label-icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', stroke: 'currentColor', strokeWidth: '2', fill: 'none' }}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    </div>
  );
}
