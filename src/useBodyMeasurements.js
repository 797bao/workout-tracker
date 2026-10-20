import { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';

// /bodyMeasurements/<YYYY-MM-DD> holds Bao's hand-written check-ins:
//   { date, weightLbs, bp: { sys, dia, pulse? }, tape?: 'Oiyaku' | 'Myo-body',
//     in: { shoulder, chest, belowRib, waist, stomach, hips, bicepR, bicepL,
//           bicepFlexedR, forearmR, forearmL, wristR, wristL, thighR, thighL,
//           calfR, calfL }, notes? }   (inches, unflexed unless "Flexed")
// Tiny, so one app-lifetime listener with a module cache, shared by every mount.

// Both soft tapes Bao uses from May 2025 on read about 0.3 in higher than a
// regular ruler. Values are stored as measured; this hook hands out the
// ruler-equivalent. An entry's own tapeOffsetIn wins over the per-tape default.
export const TAPE_OFFSET_IN = { 'Myo-body': -0.3, Oiyaku: -0.3 };

let cache = null;
const subscribers = new Set();
let listening = false;

function publish(value) {
  cache = value;
  for (const cb of subscribers) cb(value);
}

/** Returns { entries: [...] oldest first (in = ruler-equivalent, rawIn = as measured, offsetIn), loaded, error }. */
export function useBodyMeasurements(database) {
  const [data, setData] = useState(() => cache);

  useEffect(() => {
    setData(cache);
    subscribers.add(setData);
    if (!listening) {
      listening = true;
      onValue(ref(database, 'bodyMeasurements'),
        (snap) => publish(snap.val() || {}),
        (err) => publish({ __error: err.message }));
    }
    return () => { subscribers.delete(setData); };
  }, [database]);

  const entries = useMemo(
    () => Object.entries(data || {}).filter(([k]) => k !== '__error').sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e]) => {
        const offsetIn = e.tapeOffsetIn ?? TAPE_OFFSET_IN[e.tape] ?? 0;
        const inches = offsetIn && e.in
          ? Object.fromEntries(Object.entries(e.in).map(([k, v]) => [k, Math.round((v + offsetIn) * 1000) / 1000]))
          : e.in;
        return { ...e, date, in: inches, rawIn: e.in, offsetIn };
      }),
    [data]
  );
  return { entries, loaded: data !== null, error: data?.__error || null };
}
