import { useEffect, useRef, useState } from 'react';

export default function CountUpNumber({
  to,
  from = 0,
  duration = 1200,
  decimals = 0,
  separator = '',
  prefix = '',
  suffix = '',
  className = ''
}) {
  const [value, setValue] = useState(from);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      requestAnimationFrame(() => setValue(to));
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }, { threshold: 0.35 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [from, to, duration]);

  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: Boolean(separator)
  }).replace(/,/g, separator);

  return <span ref={ref} className={className}>{prefix}{formatted}{suffix}</span>;
}
