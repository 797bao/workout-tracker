import { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';

// /bodyMeasurements/<YYYY-MM-DD> holds Bao's hand-written check-ins:
//   { date, weightLbs, bp: { sys, dia, pulse? }, tape?: 'Oiyaku' | 'Myo-body',
//     tapeOffsetIn?, in: { shoulder, chest, stomach, hips, bicepR, bicepL,
//     bicepFlexedR, forearmR, forearmL, wristR, wristL, thighR, thighL, calfR,
//     calfL, ... }, notes? }   (inches, unflexed unless "Flexed")
// /bodyMeasurementsGuide says how each site is measured:
//   { conventions: [...], tapes: { <tape>: { offsetIn, note } },
//     sites: { <key>: { label, short, how } } }
// Both are tiny, so one app-lifetime listener each with a module cache, shared by every mount.

// Both soft tapes Bao uses from May 2025 on read about 0.3 in higher than a
// regular ruler. Values are stored as measured; this hook hands out the
// ruler-equivalent. An entry's own tapeOffsetIn wins over the per-tape default.
export const TAPE_OFFSET_IN = { 'Myo-body': -0.3, Oiyaku: -0.3 };

let cache = { data: null, guide: null };
const subscribers = new Set();
let listening = false;

function publish(patch) {
  cache = { ...cache, ...patch };
  for (const cb of subscribers) cb(cache);
}

/**
 * Returns { entries: [...] oldest first (in = ruler-equivalent, rawIn = as
 * measured, offsetIn), guide, loaded, error }.
 */
export function useBodyMeasurements(database) {
  const [state, setState] = useState(() => cache);

  useEffect(() => {
    setState(cache);
    subscribers.add(setState);
    if (!listening) {
      listening = true;
      onValue(ref(database, 'bodyMeasurements'),
        (snap) => publish({ data: snap.val() || {} }),
        (err) => publish({ data: { __error: err.message } }));
      onValue(ref(database, 'bodyMeasurementsGuide'),
        (snap) => publish({ guide: snap.val() || null }),
        () => publish({ guide: null }));
    }
    return () => { subscribers.delete(setState); };
  }, [database]);

  const data = state.data;
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
  return { entries, guide: state.guide, loaded: data !== null, error: data?.__error || null };
}
