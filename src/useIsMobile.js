import { useEffect, useState } from 'react';

// Phone breakpoint for the Body Stats and Watch pages (short chart labels,
// fewer value labels). Same width as Stats.css's mobile block.
const QUERY = '(max-width: 820px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
