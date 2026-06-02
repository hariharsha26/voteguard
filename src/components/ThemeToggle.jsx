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
    <div className="theme-toggle-wrap" title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
      <span className="toggle-label-icon"><IconMoon size={16} /></span>
      <button 
        type="button"
        className={`theme-toggle-switch ${isLight ? 'active' : ''}`}
        onClick={() => setIsLight(!isLight)}
        aria-label="Toggle Theme"
      >
        <span className="theme-toggle-knob"></span>
      </button>
      <span className="toggle-label-icon"><IconSun size={16} /></span>
    </div>
  );
}
