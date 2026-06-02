import { useRef, useCallback } from 'react';

/**
 * Reusable OTP code input — 6 single-digit fields with:
 * - auto-advance on input
 * - backspace focuses previous
 * - paste splits digits across all fields
 *
 * @param {{ length?: number, focusColor?: string, className?: string }} props
 */
export default function OtpInput({ length = 6, focusColor = 'teal', className = '' }) {
  const inputsRef = useRef([]);

  const handleInput = useCallback((e, index) => {
    const value = e.target.value;
    if (value.length === 1 && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }, [length]);

  const handleKeyDown = useCallback((e, index) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }, []);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    inputsRef.current.forEach((inp, j) => {
      if (inp && digits[j]) {
        inp.value = digits[j];
      }
    });
    // Focus the last filled input or the next empty
    const lastIdx = Math.min(digits.length, length) - 1;
    if (lastIdx >= 0) {
      inputsRef.current[lastIdx]?.focus();
    }
  }, [length]);

  const focusStyle = focusColor === 'gold'
    ? { borderColor: 'rgba(212,168,67,0.3)', background: 'rgba(212,168,67,0.04)' }
    : { borderColor: 'var(--teal3)', background: 'rgba(74,157,143,0.05)' };

  return (
    <div className={`otp-wrap ${className}`}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          maxLength={1}
          onInput={(e) => handleInput(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={(e) => handlePaste(e, i)}
          onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          onBlur={(e) => {
            e.target.style.borderColor = '';
            e.target.style.background = '';
          }}
        />
      ))}
    </div>
  );
}
