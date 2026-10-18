import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';

// /samsungHealth is the Galaxy Watch data the MyStats phone app copies out of
// Health Connect every 3 hours (its own path; nothing else writes there):
//   exercise/<id>  type, date, start, startMs, durationMin, distanceMi,
//                  paceMinPerMi, pacePerMi, avgHr, maxHr, calories, vo2max
//   vo2max/<id>    { value, date, time, timeMs }
//   daily/<date>   { steps, distanceKm, hrAvg, hrMin, hrMax, restingHr }
//   sleep/<id>     { date (the morning), start, end, durationMin, stages: { deepMin, ... } }
//   weight/<id>, bodyFat/<id>, meta: { lastSync, lastSyncMs, device }
// Small, so one app-lifetime listener with a module cache, shared by every mount.
let cache = null;
const subscribers = new Set();
let listening = false;

function publish(value) {
  cache = value;
  for (const cb of subscribers) cb(value);
}

/** Returns { data, loaded }; data.error is set when the read was refused. */
export function useSamsungHealth(database) {
  const [data, setData] = useState(() => cache);

  useEffect(() => {
    setData(cache);
    subscribers.add(setData);
    if (!listening) {
      listening = true;
      onValue(ref(database, 'samsungHealth'),
        (snap) => publish(snap.val() || {}),
        (err) => publish({ error: err.message }));
    }
    return () => { subscribers.delete(setData); };
  }, [database]);

  return { data, loaded: data !== null };
}
