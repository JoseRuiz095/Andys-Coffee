import { useEffect, useState } from 'react';

/** Current time (ms), refreshed every `intervalMs`: one clock shared by all the order timers. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
