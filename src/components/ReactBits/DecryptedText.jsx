import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-/=?@';

export default function DecryptedText({
  text,
  className = '',
  encryptedClassName = '',
  speed = 34,
  maxIterations = 13,
  delay = 0,
  animateOn = 'mount'
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const hasMountedRef = useRef(false);
  const chars = useMemo(() => GLYPHS.split(''), []);

  const run = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(text);
      return;
    }

    window.clearInterval(intervalRef.current);
    let iteration = 0;
    setIsRunning(true);

    intervalRef.current = window.setInterval(() => {
      const nextText = text
        .split('')
        .map((char, index) => {
          if (char === ' ') return char;
          if (index < iteration) return text[index];
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join('');

      setDisplayText(nextText);
      iteration += 1 / 2;

      if (iteration >= text.length + maxIterations) {
        window.clearInterval(intervalRef.current);
        setDisplayText(text);
        setIsRunning(false);
      }
    }, speed);
  }, [chars, maxIterations, speed, text]);

  useEffect(() => {
    if (animateOn !== 'mount' || hasMountedRef.current) return undefined;
    hasMountedRef.current = true;
    const timer = window.setTimeout(run, delay);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(intervalRef.current);
    };
  }, [animateOn, delay, run, text]);

  return (
    <span
      className={`${className} ${isRunning ? encryptedClassName : ''}`.trim()}
      onMouseEnter={animateOn === 'hover' ? run : undefined}
    >
      {displayText}
    </span>
  );
}
