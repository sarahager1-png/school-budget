import { useEffect, useRef, useState } from 'react';

// A number that counts up on mount — used on dashboard KPIs.
// Renders the final formatted string (prefix/suffix included in `format`).
export default function CountUp({ to, format = (n) => n.toLocaleString('he-IL'), duration = 900, delay = 0 }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * to));
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [to, duration, delay]);

  return <>{format(value)}</>;
}
