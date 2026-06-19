import React, { useEffect, useRef, useState } from 'react';
import '../styles/CustomCursor.css';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Touch device detection - disable custom cursor for touchscreen devices
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      setEnabled(false);
      return;
    }
    
    setEnabled(true);

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;

    // Fast track mouse moves
    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
    };

    // Smooth Lerp tracking loop for outer ring
    let animationFrameId;
    const lerp = (start, end, factor) => (1 - factor) * start + factor * end;
    
    const updateRingPosition = () => {
      ringX = lerp(ringX, mouseX, 0.15);
      ringY = lerp(ringY, mouseY, 0.15);

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }

      animationFrameId = requestAnimationFrame(updateRingPosition);
    };

    // Event delegation for hovers
    const handleMouseOver = (e) => {
      const target = e.target;
      if (!target) return;

      const isClickable = target.closest('a, button, .csp-tab-btn, .csp-gallery-card, .btn-primary, .btn-secondary, .btn-back-home, .btn-milestone, .theme-toggle-switch, .csp-video-scrubber, .csp-range-input');
      const isInput = target.closest('input, textarea, select');

      if (isClickable) {
        dotRef.current?.classList.add('cursor-hover-clickable');
        ringRef.current?.classList.add('cursor-hover-clickable');
      } else if (isInput) {
        dotRef.current?.classList.add('cursor-hover-input');
        ringRef.current?.classList.add('cursor-hover-input');
      }
    };

    const handleMouseOut = (e) => {
      const target = e.target;
      if (!target) return;

      dotRef.current?.classList.remove('cursor-hover-clickable', 'cursor-hover-input');
      ringRef.current?.classList.remove('cursor-hover-clickable', 'cursor-hover-input');
    };

    // Click tracking
    const handleMouseDown = () => {
      dotRef.current?.classList.add('cursor-clicking');
      ringRef.current?.classList.add('cursor-clicking');
    };

    const handleMouseUp = () => {
      dotRef.current?.classList.remove('cursor-clicking');
      ringRef.current?.classList.remove('cursor-clicking');
    };

    // Attach event listeners
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Start tracking loop
    animationFrameId = requestAnimationFrame(updateRingPosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div className="custom-cursor-dot" ref={dotRef}></div>
      <div className="custom-cursor-ring" ref={ringRef}></div>
    </>
  );
}
