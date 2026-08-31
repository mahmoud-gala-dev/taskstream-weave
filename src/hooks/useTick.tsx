import { useEffect, useState } from "react";

/**
 * Returns Date.now() refreshed every `ms`. Used only to re-render timers —
 * elapsed time is always derived from stored timestamps, never accumulated here.
 */
export function useTick(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
