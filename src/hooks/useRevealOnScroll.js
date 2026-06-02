import { useEffect } from 'react';

/**
 * Custom hook that observes `.reveal` elements within a container
 * and adds the `.in` class when they scroll into view.
 *
 * @param {React.RefObject} containerRef - Ref to the container element
 * @param {boolean} enabled - Whether the observer should be active
 */
export default function useRevealOnScroll(containerRef, enabled = true) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const items = containerRef.current.querySelectorAll('.reveal');
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    items.forEach((el) => observer.observe(el));

    return () => {
      items.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [containerRef, enabled]);
}
