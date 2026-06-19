import { useRef, useState, useCallback } from 'react';

/**
 * Reusable OTP code input — 6 single-digit fields with:
 * - auto-advance on input
 * - backspace focuses previous
 * - paste splits digits across all fields
 *
 * @param {{ length?: number, focusColor?: string, className?: string }} props
 */
export default function OtpInput({ length = 4, focusColor = 'teal', className = '', onChange }) {
  const inputsRef = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const triggerChange = useCallback(() => {
    if (onChange) {
      const code = inputsRef.current.map(inp => inp?.value || '').join('');
      onChange(code);
    }
  }, [onChange]);

  const handleInput = useCallback((e, index) => {
    const value = e.target.value;
    if (value.length === 1 && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
    triggerChange();
  }, [length, triggerChange]);

  const handleKeyDown = useCallback((e, index) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    // Delay to let the input value clear before triggering change
    setTimeout(triggerChange, 0);
  }, [triggerChange]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    inputsRef.current.forEach((inp, j) => {
      if (inp) {
        inp.value = digits[j] || '';
      }
    });
    // Focus the last filled input or the next empty
    const lastIdx = Math.min(digits.length, length) - 1;
    if (lastIdx >= 0) {
      inputsRef.current[lastIdx]?.focus();
    }
    triggerChange();
  }, [length, triggerChange]);

  const focusClass = focusColor === 'gold' ? 'otp-focus-gold' : 'otp-focus-teal';

  return (
    <div className={`otp-wrap ${className}`}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          maxLength={1}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1} of ${length}`}
          className={focusedIndex === i ? focusClass : ''}
          onInput={(e) => handleInput(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={(e) => handlePaste(e)}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex(-1)}
        />
      ))}
    </div>
  );
}
