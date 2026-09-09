import React, { useState, useEffect, useRef } from 'react';

export function useCountUp(targetValue, duration = 800) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = Number(targetValue) || 0;

    const startTime = performance.now();
    let frameId;

    const tick = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(end);
        prevValueRef.current = end;
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [targetValue, duration]);

  return displayValue;
}

export default function AnimatedNumber({
  value = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 800,
  className = '',
}) {
  const count = useCountUp(value, duration);

  const formatted = decimals > 0
    ? count.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : Math.round(count).toLocaleString('en-IN');

  return (
    <span className={`inline-block font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
