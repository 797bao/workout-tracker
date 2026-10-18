import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';

// /bodyStats holds every DEXA scan (BodySpec), keyed by 'YYYY-MM-DD':
//   profile: { sex, dob, heightIn, provider }
//   scans/<date>: { summary, regions, limbs, rmr, androidPct, gynoidPct,
//                   agRatio, vatLbs, vatIn3, bone, source, note? }
// Tiny (~20 KB) and changes only when a new scan is added, so one
// app-lifetime listener with a module cache, shared by every mount.
let cache = null;
const subscribers = new Set();
let listening = false;

function publish(value) {
  cache = value;
  for (const cb of subscribers) cb(value);
}

/** Returns { profile, scans: [{ date, ...scan }] oldest first, loaded, error }. */
export function useBodyStats(database) {
  const [data, setData] = useState(() => cache);

  useEffect(() => {
    setData(cache);
    subscribers.add(setData);
    if (!listening) {
      listening = true;
      onValue(ref(database, 'bodyStats'),
        (snap) => publish(snap.val() || { profile: null, scans: {} }),
        (err) => publish({ profile: null, scans: {}, error: err.message }));
    }
    return () => { subscribers.delete(setData); };
  }, [database]);

  const scans = useMemo(
    () => (data?.scans
      ? Object.keys(data.scans).sort().map((date) => ({ date, ...data.scans[date] }))
      : []),
    [data]
  );
  return { profile: data?.profile || null, scans, loaded: data !== null, error: data?.error || null };
}
