import { useRef } from 'react';
import './SpotlightCard.css';

export default function SpotlightCard({
  as: Component = 'div',
  children,
  className = '',
  spotlightColor = 'rgba(105, 241, 196, 0.16)',
  onMouseMove,
  ...props
}) {
  const cardRef = useRef(null);

  const handleMouseMove = (event) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    card.style.setProperty('--spotlight-color', spotlightColor);
    onMouseMove?.(event);
  };

  return (
    <Component
      ref={cardRef}
      className={`rb-spotlight-card ${className}`}
      onMouseMove={handleMouseMove}
      {...props}
    >
      {children}
    </Component>
  );
}
