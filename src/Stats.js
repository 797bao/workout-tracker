// Stats.js — Personal Records page.
// Answers "what's my best X within time range Y under conditions Z" for both
// strength and cardio, straight from the full Firebase history (all years).
import React, { useState, useEffect, useMemo } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import './Stats.css';

// Mirrors the definitions in WorkoutChart.js (kept local so this page is
// self-contained and can't drift the chart's behavior).
const MUSCLE_GROUPS = {
    "Calisthenics": { color: "#b4a4da", order: 1 },
    "Chest": { color: "#f44336", order: 2 },
    "Back": { color: "#ea9999", order: 3 },
    "Delts": { color: "#ffad3f", order: 4 },
    "Arms": { color: "#93c47d", order: 5 },
    "Upper Legs": { color: "#6d9eeb", order: 6 },
    "Lower Legs": { color: "#cadcfd", order: 7 }
};
const CALISTHENICS = new Set(["Dips", "Push Ups", "Pull Ups", "Chin Ups", "Nordic Curls", "Sit Ups", "Hangs"]);
// Matches the Calories pill and intake line on the chart page
const CAL_COLOR = '#93c47d';
const CARDIO_ORDER = ['Elliptical', 'Treadmill', 'Jogging', 'Mission Peak', 'Summit'];
// Hangs are logged in SECONDS (a 60 in the reps field = a 60-second hang).
const TIMED_EXERCISES = new Set(['Hangs']);

// Icon path builders — same public/icons naming scheme the chart pages use.
const SHAPE_BY_POINTSTYLE = {
    triangle: 'Triangle', rectrot: 'RectRot', rect: 'Rect', rectrounded: 'RectRounded',
    cross: 'Cross', crossrot: 'CrossRot', circle: 'Circle',
};

function exerciseIconPath(exercise) {
    if (!exercise || !exercise.muscleGroup) return null;
    const base = SHAPE_BY_POINTSTYLE[(exercise.pointStyle || 'circle').toLowerCase()] || 'Circle';
    const needsStroke = exercise.backgroundColor === '#000000' && !['Cross', 'CrossRot'].includes(base);
    const fileName = `${exercise.muscleGroup}_${base}${needsStroke ? 'Stroke' : ''}.svg`;
    return `${process.env.PUBLIC_URL}/icons/${encodeURIComponent(fileName)}`;
}

const GROUP_BY_BORDER_COLOR = {
    '#b5a4da': 'Calisthenics', '#f44336': 'Chest', '#ea9999': 'Back', '#ffad3f': 'Delts',
    '#93c47d': 'Arms', '#6d9eeb': 'Upper Legs', '#cadcfd': 'Lower Legs',
};

function cardioIconPath(exercise) {
    if (!exercise) return null;
    const group = GROUP_BY_BORDER_COLOR[exercise.borderColor];
    if (!group) return null;
    const base = SHAPE_BY_POINTSTYLE[(exercise.pointStyle || 'circle').toLowerCase()] || 'Circle';
    const needsStroke = exercise.backgroundColor === '#000000' && !['Cross', 'CrossRot'].includes(base);
    const fileName = `${group}_${base}${needsStroke ? 'Stroke' : ''}.svg`;
    return `${process.env.PUBLIC_URL}/icons/${encodeURIComponent(fileName)}`;
}

const RANGE_OPTIONS = [
    { id: 'all', label: 'All Time' },
    { id: 'year', label: 'This Year' },
    { id: '6m', label: 'Last 6 Months' },
    { id: '3m', label: 'Last 3 Months' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom…' },
];

// Rep-max convention: "≥ 5 reps" = heaviest set with AT LEAST 5 reps (5RM-style).
const REP_OPTIONS = [
    { id: 'any', label: 'Any reps' },
    { id: '3', label: '≥ 3 reps' },
    { id: '5', label: '≥ 5 reps' },
    { id: '8', label: '≥ 8 reps' },
    { id: '10', label: '≥ 10 reps' },
    { id: '12', label: '≥ 12 reps' },
    { id: '15', label: '≥ 15 reps' },
];

const DURATION_BUCKETS = [
    { id: 'any', label: 'Any time' },
    { id: '15', label: '~15 min', min: 10, max: 20 },
    { id: '20', label: '~20 min', min: 15, max: 25 },
    { id: '30', label: '~30 min', min: 25, max: 35 },
    { id: '45', label: '~45 min', min: 40, max: 50 },
    { id: '60', label: '60+ min', min: 55, max: Infinity },
];

// For "Fastest pace" the natural question is "over WHAT distance" — a sprint
// pace and a long-run pace aren't comparable. Swaps in for the duration filter.
const DISTANCE_BUCKETS = [
    { id: 'any', label: 'Any distance' },
    { id: '1', label: '~1 mi', min: 0.75, max: 1.25 },
    { id: '1.5', label: '~1.5 mi', min: 1.25, max: 1.75 },
    { id: '2', label: '~2 mi', min: 1.75, max: 2.5 },
    { id: '3', label: '~3 mi', min: 2.5, max: 3.5 },
    { id: '4.5', label: '~4.5 mi', min: 3.5, max: 5 },
    { id: '5', label: '5+ mi', min: 5, max: Infinity },
];

// "17:03/mi (3.5 mph)" — mph from the session when logged, else derived.
const fmtPace = (r) => {
    if (!r.pace) return '';
    const mph = r.mph != null
        ? r.mph
        : (Number.isFinite(r.paceSec) && r.paceSec > 0 ? Math.round(36000 / r.paceSec) / 10 : null);
    return `${r.pace}/mi${mph != null ? ` (${mph} mph)` : ''}`;
};

const fmtDate = (dateKey) => {
    const d = new Date(
        parseInt(dateKey.slice(0, 4)),
        parseInt(dateKey.slice(4, 6)) - 1,
        parseInt(dateKey.slice(6, 8))
    );
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const rangeStartKey = (rangeId) => {
    const now = new Date();
    let d;
    if (rangeId === 'year') d = new Date(now.getFullYear(), 0, 1);
    else if (rangeId === '6m') { d = new Date(now); d.setMonth(d.getMonth() - 6); }
    else if (rangeId === '3m') { d = new Date(now); d.setMonth(d.getMonth() - 3); }
    else if (rangeId === '30d') { d = new Date(now); d.setDate(d.getDate() - 30); }
    else return '00000000';
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const paceToSeconds = (pace) => {
    if (!pace || typeof pace !== 'string') return Infinity;
    const parts = pace.split(':').map(Number);
    if (parts.some(isNaN)) return Infinity;
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
};

const fmtMins = (mins) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
};

const Stats = ({ exercises, cardioExercises }) => {
    const database = getDatabase();

    const [mode, setMode] = useState('strength');
    const [range, setRange] = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [repMin, setRepMin] = useState('any');
    const [search, setSearch] = useState('');
    // Expansion is global: opening one card opens them all, so a taller grid
    // row is always filled with data instead of neighboring blank space.
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(true);

    // Flattened history rows, loaded once for ALL years.
    const [strengthRows, setStrengthRows] = useState([]);   // {dateKey, exerciseId, weight, reps}
    const [cardioRows, setCardioRows] = useState([]);       // {dateKey, activityId, distance, mins, pace, mph, resistance}
    const [weightRows, setWeightRows] = useState([]);       // {dateKey, lbs, kg, time}
    const [calorieRows, setCalorieRows] = useState([]);     // {dateKey, total, count, goal, diff} — one per day

    // Per-cardio-card filters: { [activityId]: { metric, duration, resistance } }
    const [cardioFilters, setCardioFilters] = useState({});

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            get(ref(database, 'workouts')),
            get(ref(database, 'cardio')),
            get(ref(database, 'weightLog')),
            get(ref(database, 'calorieLog')),
            get(ref(database, 'calorieGoals')),
        ]).then(([wSnap, cSnap, wtSnap, calSnap, goalSnap]) => {
            if (cancelled) return;

            const sRows = [];
            const wData = wSnap.val() || {};
            for (const months of Object.values(wData)) {
                for (const days of Object.values(months || {})) {
                    for (const [dateKey, byExercise] of Object.entries(days || {})) {
                        for (const [exerciseId, workout] of Object.entries(byExercise || {})) {
                            (workout.sets || []).forEach((s) => {
                                if (s == null) return;
                                sRows.push({
                                    dateKey,
                                    exerciseId,
                                    weight: parseInt(s.weight) || 0,
                                    reps: parseInt(s.reps) || 0,
                                });
                            });
                        }
                    }
                }
            }

            const cRows = [];
            const cData = cSnap.val() || {};
            for (const months of Object.values(cData)) {
                for (const days of Object.values(months || {})) {
                    for (const [dateKey, byActivity] of Object.entries(days || {})) {
                        for (const [activityId, entry] of Object.entries(byActivity || {})) {
                            (entry.sessions || []).forEach((s) => {
                                if (s == null) return;
                                const mins = (s.time?.hours || 0) * 60 + (s.time?.minutes || 0) + (s.time?.seconds || 0) / 60;
                                cRows.push({
                                    dateKey,
                                    activityId,
                                    distance: typeof s.distance === 'number' ? s.distance : parseFloat(s.distance) || 0,
                                    mins,
                                    pace: s.speed?.pace || null,
                                    paceSec: paceToSeconds(s.speed?.pace),
                                    mph: s.speed?.mph ?? null,
                                    resistance: s.resistance ?? null,
                                });
                            });
                        }
                    }
                }
            }

            // weightLog/<YYYY-MM-DD>/<unix ts> -> { lbs, kg, time }; dateKey
            // normalized to YYYYMMDD to share the range filters.
            const wtRows = [];
            const wtData = wtSnap.val() || {};
            for (const [isoDate, entries] of Object.entries(wtData)) {
                const dateKey = isoDate.replace(/-/g, '');
                for (const entry of Object.values(entries || {})) {
                    if (entry == null || typeof entry.lbs !== 'number') continue;
                    wtRows.push({ dateKey, lbs: entry.lbs, kg: entry.kg, time: entry.time || '' });
                }
            }
            wtRows.sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));

            // calorieLog/<YYYY-MM-DD>/<pushId> -> { kcal, time }, one row per
            // DAY (totals are what records are about). calorieGoals is a sparse
            // effective-from map, so each day is scored against the goal that
            // was actually in force then.
            const goalsMap = goalSnap.val() || {};
            const goalDates = Object.keys(goalsMap).sort();
            const goalFor = (isoDate) => {
                let g = null;
                for (const d of goalDates) {
                    if (d <= isoDate) g = Number(goalsMap[d]);
                    else break;
                }
                return g;
            };
            const calRows = [];
            for (const [isoDate, entries] of Object.entries(calSnap.val() || {})) {
                const items = Object.keys(entries || {}).sort()
                    .map((k) => entries[k])
                    .filter((v) => v && typeof v.kcal === 'number');
                if (items.length === 0) continue;
                const total = items.reduce((a, v) => a + v.kcal, 0);
                const goal = goalFor(isoDate);
                calRows.push({
                    dateKey: isoDate.replace(/-/g, ''),
                    total,
                    count: items.length,
                    goal,
                    diff: goal != null ? total - goal : null,
                });
            }
            calRows.sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
            setCalorieRows(calRows);

            setStrengthRows(sRows);
            setCardioRows(cRows);
            setWeightRows(wtRows);
            setLoading(false);
        }).catch((e) => {
            console.error('Stats: failed to load history', e);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [database]);

    // Date window as YYYYMMDD keys. Custom range uses the two date inputs;
    // an empty input means "open-ended" on that side.
    const startKey = useMemo(() => {
        if (range === 'custom') return customStart ? customStart.replace(/-/g, '') : '00000000';
        return rangeStartKey(range);
    }, [range, customStart]);
    const endKey = useMemo(() => {
        if (range === 'custom' && customEnd) return customEnd.replace(/-/g, '');
        return '99999999';
    }, [range, customEnd]);

    /* ── Strength records ── */
    const strengthCards = useMemo(() => {
        const minReps = repMin === 'any' ? 0 : parseInt(repMin);
        const inRange = strengthRows.filter((r) => r.dateKey >= startKey && r.dateKey <= endKey && r.reps >= minReps);
        const byExercise = {};
        for (const row of inRange) {
            (byExercise[row.exerciseId] = byExercise[row.exerciseId] || []).push(row);
        }

        const cards = [];
        for (const [exerciseId, rows] of Object.entries(byExercise)) {
            const ex = exercises[exerciseId];
            if (!ex) continue;
            if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) continue;
            const isCali = CALISTHENICS.has(ex.name);

            // Rank sets: weighted lifts by weight then reps; calisthenics by reps.
            const ranked = [...rows].sort((a, b) =>
                isCali ? (b.reps - a.reps || b.weight - a.weight)
                       : (b.weight - a.weight || b.reps - a.reps)
            );

            // Collapse duplicate (weight, reps) pairs. Each entry keeps the
            // EARLIEST date it was achieved plus a count of every repeat, so
            // ties show as e.g. "50 reps (3)".
            const byPair = new Map(); // "weightxreps" -> entry with count
            const pairOrder = [];
            for (const r of ranked) {
                const k = `${r.weight}x${r.reps}`;
                const existing = byPair.get(k);
                if (existing) {
                    existing.count += 1;
                    if (r.dateKey < existing.dateKey) existing.dateKey = r.dateKey;
                } else {
                    byPair.set(k, { ...r, count: 1 });
                    pairOrder.push(k);
                }
            }
            const top = pairOrder.slice(0, 5).map((k) => byPair.get(k));
            if (top.length === 0) continue;

            cards.push({
                exerciseId,
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                color: MUSCLE_GROUPS[ex.muscleGroup]?.color || '#e0e0e0',
                order: MUSCLE_GROUPS[ex.muscleGroup]?.order || 999,
                isCali,
                isTimed: TIMED_EXERCISES.has(ex.name),
                icon: exerciseIconPath(ex),
                best: top[0],
                top,
                totalSets: rows.length,
            });
        }

        cards.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
        return cards;
    }, [strengthRows, startKey, endKey, exercises, repMin, search]);

    /* ── Cardio records ── */
    const cardioCards = useMemo(() => {
        const inRange = cardioRows.filter((r) => r.dateKey >= startKey && r.dateKey <= endKey);
        const byActivity = {};
        for (const row of inRange) {
            (byActivity[row.activityId] = byActivity[row.activityId] || []).push(row);
        }

        const cards = [];
        for (const [activityId, rows] of Object.entries(byActivity)) {
            const ex = cardioExercises[activityId];
            if (!ex) continue;
            if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) continue;

            const resistances = [...new Set(rows.map((r) => r.resistance).filter((v) => v != null))]
                .sort((a, b) => a - b);

            const f = cardioFilters[activityId] || { metric: 'pace', duration: 'any', distance: 'any', resistance: 'any' };

            let filtered = rows;
            if (f.resistance !== 'any') {
                filtered = filtered.filter((r) => r.resistance === parseInt(f.resistance));
            }
            if (f.metric === 'pace') {
                // Pace mode: filter by DISTANCE ("fastest pace over ~3 mi").
                if (f.distance !== 'any') {
                    const bucket = DISTANCE_BUCKETS.find((b) => b.id === f.distance);
                    if (bucket) filtered = filtered.filter((r) => r.distance >= bucket.min && r.distance <= bucket.max);
                }
            } else if (f.duration !== 'any') {
                const bucket = DURATION_BUCKETS.find((b) => b.id === f.duration);
                if (bucket) filtered = filtered.filter((r) => r.mins >= bucket.min && r.mins <= bucket.max);
            }

            const ranked = [...filtered].sort((a, b) => {
                if (f.metric === 'pace') return a.paceSec - b.paceSec;         // fastest pace
                if (f.metric === 'duration') return b.mins - a.mins;           // longest session
                return b.distance - a.distance;                                 // longest distance
            });

            cards.push({
                activityId,
                name: ex.name,
                icon: cardioIconPath(ex),
                order: CARDIO_ORDER.indexOf(ex.name) === -1 ? 999 : CARDIO_ORDER.indexOf(ex.name),
                resistances,
                filters: f,
                top: ranked.slice(0, 5),
                totalSessions: rows.length,
                matchCount: filtered.length,
            });
        }

        cards.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
        return cards;
    }, [cardioRows, startKey, endKey, cardioExercises, cardioFilters, search]);

    /* ── Weight records ── */
    const fmtMonthKey = (m) => new Date(parseInt(m.slice(0, 4)), parseInt(m.slice(4, 6)) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const weightStats = useMemo(() => {
        const inRange = weightRows.filter((r) => r.dateKey >= startKey && r.dateKey <= endKey);
        if (inRange.length === 0) return null;

        // Collapse duplicate lbs values (same convention as strength ties):
        // keep the earliest date plus a count of repeats.
        const collapseByValue = (sorted) => {
            const byVal = new Map();
            const order = [];
            for (const r of sorted) {
                const existing = byVal.get(r.lbs);
                if (existing) {
                    existing.count += 1;
                    if (r.dateKey < existing.dateKey) existing.dateKey = r.dateKey;
                } else {
                    byVal.set(r.lbs, { ...r, count: 1 });
                    order.push(r.lbs);
                }
            }
            return order.slice(0, 5).map((v) => byVal.get(v));
        };
        const lowest = collapseByValue([...inRange].sort((a, b) => a.lbs - b.lbs || (a.dateKey < b.dateKey ? -1 : 1)));
        const highest = collapseByValue([...inRange].sort((a, b) => b.lbs - a.lbs || (a.dateKey < b.dateKey ? -1 : 1)));

        // Per-month aggregates (rows are already date-sorted)
        const byMonth = {};
        for (const r of inRange) {
            (byMonth[r.dateKey.slice(0, 6)] = byMonth[r.dateKey.slice(0, 6)] || []).push(r);
        }
        const months = Object.entries(byMonth).map(([month, rows]) => ({
            month,
            count: rows.length,
            days: new Set(rows.map((r) => r.dateKey)).size,
            avg: rows.reduce((a, r) => a + r.lbs, 0) / rows.length,
            change: rows[rows.length - 1].lbs - rows[0].lbs,
        }));
        const lightestMonths = months.filter((m) => m.count >= 5).sort((a, b) => a.avg - b.avg).slice(0, 5);
        const biggestLoss = months.filter((m) => m.days >= 2 && m.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);

        // Longest run of consecutive days with at least one weigh-in
        const dayKeys = [...new Set(inRange.map((r) => r.dateKey))].sort();
        const toDate = (k) => new Date(parseInt(k.slice(0, 4)), parseInt(k.slice(4, 6)) - 1, parseInt(k.slice(6, 8)));
        const streaks = [];
        let runStart = dayKeys[0];
        let prev = dayKeys[0];
        for (let i = 1; i <= dayKeys.length; i++) {
            const k = dayKeys[i];
            const contiguous = k && (toDate(k) - toDate(prev) === 86400000);
            if (!contiguous) {
                streaks.push({
                    len: Math.round((toDate(prev) - toDate(runStart)) / 86400000) + 1,
                    start: runStart,
                    end: prev,
                });
                runStart = k;
            }
            prev = k;
        }
        const topStreaks = streaks.sort((a, b) => b.len - a.len || (a.start < b.start ? -1 : 1)).slice(0, 5);

        return {
            lowest, highest, lightestMonths, biggestLoss,
            streaks: topStreaks,
            total: inRange.length,
            daysLogged: dayKeys.length,
        };
    }, [weightRows, startKey, endKey]);

    /* ── Calorie records ── */
    const calorieStats = useMemo(() => {
        const inRange = calorieRows.filter((r) => r.dateKey >= startKey && r.dateKey <= endKey);
        if (inRange.length === 0) return null;

        // Same tie convention as the other tabs: collapse equal values, keep
        // the earliest date, show how many times it was hit.
        const collapseByValue = (sorted, valueOf) => {
            const byVal = new Map();
            const order = [];
            for (const r of sorted) {
                const v = valueOf(r);
                const existing = byVal.get(v);
                if (existing) {
                    existing.count += 1;
                    if (r.dateKey < existing.dateKey) existing.dateKey = r.dateKey;
                } else {
                    byVal.set(v, { ...r, count: 1 });
                    order.push(v);
                }
            }
            return order.slice(0, 5).map((v) => byVal.get(v));
        };

        const lowest = collapseByValue(
            [...inRange].sort((a, b) => a.total - b.total || (a.dateKey < b.dateKey ? -1 : 1)), (r) => r.total);
        const highest = collapseByValue(
            [...inRange].sort((a, b) => b.total - a.total || (a.dateKey < b.dateKey ? -1 : 1)), (r) => r.total);

        // Biggest deficit = most under the goal in force that day.
        const withGoal = inRange.filter((r) => r.diff != null);
        const deficits = collapseByValue(
            withGoal.filter((r) => r.diff < 0).sort((a, b) => a.diff - b.diff || (a.dateKey < b.dateKey ? -1 : 1)),
            (r) => r.diff);

        const toDate = (k) => new Date(parseInt(k.slice(0, 4)), parseInt(k.slice(4, 6)) - 1, parseInt(k.slice(6, 8)));
        // Longest runs of consecutive days matching a predicate.
        const runsOf = (rows) => {
            const keys = rows.map((r) => r.dateKey).sort();
            if (keys.length === 0) return [];
            const out = [];
            let runStart = keys[0];
            let prev = keys[0];
            for (let i = 1; i <= keys.length; i++) {
                const k = keys[i];
                const contiguous = k && (toDate(k) - toDate(prev) === 86400000);
                if (!contiguous) {
                    out.push({
                        len: Math.round((toDate(prev) - toDate(runStart)) / 86400000) + 1,
                        start: runStart,
                        end: prev,
                    });
                    runStart = k;
                }
                prev = k;
            }
            return out.sort((a, b) => b.len - a.len || (a.start < b.start ? -1 : 1)).slice(0, 5);
        };

        const underStreaks = runsOf(withGoal.filter((r) => r.diff <= 0));
        const logStreaks = runsOf(inRange);

        const totalKcal = inRange.reduce((a, r) => a + r.total, 0);
        return {
            lowest,
            highest,
            deficits,
            underStreaks,
            logStreaks,
            daysLogged: inRange.length,
            entries: inRange.reduce((a, r) => a + r.count, 0),
            avg: Math.round(totalKcal / inRange.length),
            under: withGoal.filter((r) => r.diff <= 0).length,
            over: withGoal.filter((r) => r.diff > 0).length,
        };
    }, [calorieRows, startKey, endKey]);

    const setCardFilter = (activityId, patch) => {
        setCardioFilters((prev) => ({
            ...prev,
            [activityId]: { metric: 'pace', duration: 'any', distance: 'any', resistance: 'any', ...(prev[activityId] || {}), ...patch },
        }));
    };

    const rangeLabel = range === 'custom'
        ? `${customStart || 'start'} → ${customEnd || 'today'}`
        : (RANGE_OPTIONS.find((r) => r.id === range)?.label || 'All Time');

    if (loading) {
        return <div className="stats-page"><div className="stats-loading">Crunching history…</div></div>;
    }

    return (
        <div className="stats-page">
            <div className="stats-header">
                <h2 className="stats-title">Stats</h2>
                <span className="stats-subtitle">Personal records — {rangeLabel.toLowerCase()}</span>
            </div>

            <div className="stats-controls">
                <div className="stats-mode-toggle">
                    <button
                        className={`stats-mode-btn ${mode === 'strength' ? 'active' : ''}`}
                        onClick={() => setMode('strength')}
                    >Strength</button>
                    <button
                        className={`stats-mode-btn ${mode === 'cardio' ? 'active' : ''}`}
                        onClick={() => setMode('cardio')}
                    >Cardio</button>
                    <button
                        className={`stats-mode-btn ${mode === 'weight' ? 'active' : ''}`}
                        onClick={() => setMode('weight')}
                    >Weight</button>
                    <button
                        className={`stats-mode-btn ${mode === 'calories' ? 'active' : ''}`}
                        onClick={() => setMode('calories')}
                    >Calories</button>
                </div>
                <select
                    className="stats-range-select"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                >
                    {RANGE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                {range === 'custom' && (
                    <div className="stats-custom-range">
                        <input
                            type="date"
                            value={customStart}
                            max={customEnd || undefined}
                            onChange={(e) => setCustomStart(e.target.value)}
                            title="From (leave empty for open start)"
                        />
                        <span className="stats-custom-arrow">&rarr;</span>
                        <input
                            type="date"
                            value={customEnd}
                            min={customStart || undefined}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            title="To (leave empty for today)"
                        />
                    </div>
                )}
                {mode === 'strength' && (
                    <select
                        className="stats-range-select"
                        value={repMin}
                        onChange={(e) => setRepMin(e.target.value)}
                        title="Heaviest set with at least this many reps"
                    >
                        {REP_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                )}
                {mode !== 'weight' && (
                <div className="stats-search">
                    <input
                        type="text"
                        placeholder={mode === 'strength' ? 'Search exercises…' : 'Search activities…'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="stats-search-clear" onClick={() => setSearch('')}>&times;</button>
                    )}
                </div>
                )}
            </div>

            {mode === 'strength' && (
                <div className="stats-grid">
                    {strengthCards.map((card) => {
                        const isExpanded = expanded;
                        return (
                            <div
                                key={card.exerciseId}
                                className={`stats-card ${isExpanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: card.color }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: card.color }}>
                                        {card.icon && <img src={card.icon} alt="" className="stats-card-icon" width="15" height="15" />}
                                        {card.name}
                                    </span>
                                    <span className="stats-card-sets">{card.totalSets} sets</span>
                                </div>
                                <div className="stats-card-record">
                                    {card.isTimed
                                        ? <><span className="stats-big">{card.best.reps}</span> sec{card.best.weight > 0 ? ` (+${card.best.weight} lbs)` : ''}</>
                                        : card.isCali
                                            ? <><span className="stats-big">{card.best.reps}</span> reps{card.best.weight > 0 ? ` (+${card.best.weight} lbs)` : ''}</>
                                            : <><span className="stats-big">{card.best.weight}</span> lbs × {card.best.reps}</>}
                                    {card.best.count > 1 && (
                                        <span className="stats-tie-count" title={`Achieved ${card.best.count} times — date shown is the first`}>
                                            ({card.best.count})
                                        </span>
                                    )}
                                </div>
                                <div className="stats-card-date">{fmtDate(card.best.dateKey)}</div>
                                {isExpanded && (
                                    <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                        {card.top.map((r, i) => (
                                            <li key={i}>
                                                <span className="stats-top-value">
                                                    {card.isTimed
                                                        ? `${r.reps} sec${r.weight > 0 ? ` (+${r.weight} lbs)` : ''}`
                                                        : card.isCali
                                                            ? `${r.reps} reps${r.weight > 0 ? ` (+${r.weight} lbs)` : ''}`
                                                            : `${r.weight} lbs × ${r.reps}`}
                                                    {r.count > 1 && (
                                                        <span className="stats-tie-count" title={`Achieved ${r.count} times — date shown is the first`}>
                                                            ({r.count})
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="stats-top-date">{fmtDate(r.dateKey)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        );
                    })}
                    {strengthCards.length === 0 && (
                        <div className="stats-empty">No strength data in this range.</div>
                    )}
                </div>
            )}

            {mode === 'cardio' && (
                <div className="stats-grid stats-grid-cardio">
                    {cardioCards.map((card) => (
                        <div key={card.activityId} className="stats-card stats-card-cardio" style={{ borderLeftColor: '#cadcfd' }}>
                            <div className="stats-card-head">
                                <span className="stats-card-name" style={{ color: '#cadcfd' }}>
                                    {card.icon && <img src={card.icon} alt="" className="stats-card-icon" width="15" height="15" />}
                                    {card.name}
                                </span>
                                <span className="stats-card-sets">{card.matchCount}/{card.totalSessions} sessions</span>
                            </div>

                            <div className="stats-cardio-filters">
                                <select
                                    value={card.filters.metric}
                                    onChange={(e) => setCardFilter(card.activityId, { metric: e.target.value })}
                                >
                                    <option value="distance">Best distance</option>
                                    <option value="pace">Fastest pace</option>
                                    <option value="duration">Longest session</option>
                                </select>
                                {card.filters.metric === 'pace' ? (
                                    <select
                                        value={card.filters.distance}
                                        onChange={(e) => setCardFilter(card.activityId, { distance: e.target.value })}
                                        title="Fastest pace over this distance"
                                    >
                                        {DISTANCE_BUCKETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                                    </select>
                                ) : (
                                    <select
                                        value={card.filters.duration}
                                        onChange={(e) => setCardFilter(card.activityId, { duration: e.target.value })}
                                    >
                                        {DURATION_BUCKETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                                    </select>
                                )}
                                {card.resistances.length > 0 && (
                                    <select
                                        value={card.filters.resistance}
                                        onChange={(e) => setCardFilter(card.activityId, { resistance: e.target.value })}
                                    >
                                        <option value="any">Any resist.</option>
                                        {card.resistances.map((r) => <option key={r} value={r}>R{r}</option>)}
                                    </select>
                                )}
                            </div>

                            {card.top.length > 0 ? (
                                <ol className="stats-top-list stats-top-list-cardio">
                                    {card.top.map((r, i) => (
                                        <li key={i} className={i === 0 ? 'stats-top-pr' : ''}>
                                            <span className="stats-top-rank">{i + 1}</span>
                                            <span className="stats-top-value">
                                                {r.distance ? `${r.distance} mi` : fmtMins(r.mins)}
                                                <span className="stats-top-detail">
                                                    {' '}· {fmtMins(r.mins)}
                                                    {r.pace ? ` · ${fmtPace(r)}` : ''}
                                                    {r.resistance != null ? ` · R${r.resistance}` : ''}
                                                </span>
                                            </span>
                                            <span className="stats-top-date">{fmtDate(r.dateKey)}</span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div className="stats-empty-card">No sessions match these filters.</div>
                            )}
                        </div>
                    ))}
                    {cardioCards.length === 0 && (
                        <div className="stats-empty">No cardio data in this range.</div>
                    )}
                </div>
            )}

            {mode === 'weight' && (
                <div className="stats-grid">
                    {weightStats ? (
                        <>
                            <div
                                className={`stats-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: '#C58AF9' }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: '#C58AF9' }}>Lowest Weight</span>
                                    <span className="stats-card-sets">{weightStats.total} weigh-ins</span>
                                </div>
                                <div className="stats-card-record">
                                    <span className="stats-big">{weightStats.lowest[0].lbs}</span> lbs
                                    {weightStats.lowest[0].count > 1 && (
                                        <span className="stats-tie-count" title={`Hit ${weightStats.lowest[0].count} times — date shown is the first`}>
                                            ({weightStats.lowest[0].count})
                                        </span>
                                    )}
                                </div>
                                <div className="stats-card-date">{fmtDate(weightStats.lowest[0].dateKey)}</div>
                                {expanded && (
                                    <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                        {weightStats.lowest.map((r, i) => (
                                            <li key={i}>
                                                <span className="stats-top-value">
                                                    {r.lbs} lbs
                                                    {r.count > 1 && <span className="stats-tie-count">({r.count})</span>}
                                                </span>
                                                <span className="stats-top-date">{fmtDate(r.dateKey)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            <div
                                className={`stats-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: '#C58AF9' }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: '#C58AF9' }}>Highest Weight</span>
                                    <span className="stats-card-sets">{weightStats.daysLogged} days</span>
                                </div>
                                <div className="stats-card-record">
                                    <span className="stats-big">{weightStats.highest[0].lbs}</span> lbs
                                    {weightStats.highest[0].count > 1 && (
                                        <span className="stats-tie-count">({weightStats.highest[0].count})</span>
                                    )}
                                </div>
                                <div className="stats-card-date">{fmtDate(weightStats.highest[0].dateKey)}</div>
                                {expanded && (
                                    <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                        {weightStats.highest.map((r, i) => (
                                            <li key={i}>
                                                <span className="stats-top-value">
                                                    {r.lbs} lbs
                                                    {r.count > 1 && <span className="stats-tie-count">({r.count})</span>}
                                                </span>
                                                <span className="stats-top-date">{fmtDate(r.dateKey)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            {weightStats.lightestMonths.length > 0 && (
                                <div
                                    className={`stats-card ${expanded ? 'expanded' : ''}`}
                                    style={{ borderLeftColor: '#C58AF9' }}
                                    onClick={() => setExpanded((v) => !v)}
                                >
                                    <div className="stats-card-head">
                                        <span className="stats-card-name" style={{ color: '#C58AF9' }}>Lightest Month</span>
                                        <span className="stats-card-sets">avg · ≥5 weigh-ins</span>
                                    </div>
                                    <div className="stats-card-record">
                                        <span className="stats-big">{weightStats.lightestMonths[0].avg.toFixed(1)}</span> lbs
                                    </div>
                                    <div className="stats-card-date">{fmtMonthKey(weightStats.lightestMonths[0].month)}</div>
                                    {expanded && (
                                        <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                            {weightStats.lightestMonths.map((m, i) => (
                                                <li key={i}>
                                                    <span className="stats-top-value">{m.avg.toFixed(1)} lbs</span>
                                                    <span className="stats-top-date">{fmtMonthKey(m.month)}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            )}

                            {weightStats.biggestLoss.length > 0 && (
                                <div
                                    className={`stats-card ${expanded ? 'expanded' : ''}`}
                                    style={{ borderLeftColor: '#93c47d' }}
                                    onClick={() => setExpanded((v) => !v)}
                                >
                                    <div className="stats-card-head">
                                        <span className="stats-card-name" style={{ color: '#93c47d' }}>Biggest Monthly Loss</span>
                                        <span className="stats-card-sets">first → last</span>
                                    </div>
                                    <div className="stats-card-record">
                                        <span className="stats-big">{weightStats.biggestLoss[0].change.toFixed(1)}</span> lbs
                                    </div>
                                    <div className="stats-card-date">{fmtMonthKey(weightStats.biggestLoss[0].month)}</div>
                                    {expanded && (
                                        <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                            {weightStats.biggestLoss.map((m, i) => (
                                                <li key={i}>
                                                    <span className="stats-top-value">{m.change.toFixed(1)} lbs</span>
                                                    <span className="stats-top-date">{fmtMonthKey(m.month)}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            )}

                            <div
                                className={`stats-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: '#C58AF9' }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: '#C58AF9' }}>Longest Streak</span>
                                    <span className="stats-card-sets">consecutive days</span>
                                </div>
                                <div className="stats-card-record">
                                    <span className="stats-big">{weightStats.streaks[0].len}</span> days
                                </div>
                                <div className="stats-card-date">
                                    {fmtDate(weightStats.streaks[0].start)} → {fmtDate(weightStats.streaks[0].end)}
                                </div>
                                {expanded && (
                                    <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                        {weightStats.streaks.map((s, i) => (
                                            <li key={i}>
                                                <span className="stats-top-value">{s.len} days</span>
                                                <span className="stats-top-date">{fmtDate(s.start)} → {fmtDate(s.end)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="stats-empty">No weight data in this range.</div>
                    )}
                </div>
            )}

            {mode === 'calories' && (
                <div className="stats-grid">
                    {calorieStats ? (
                        <>
                            <div
                                className={`stats-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: CAL_COLOR }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: CAL_COLOR }}>Lightest Day</span>
                                    <span className="stats-card-sets">{calorieStats.daysLogged} days</span>
                                </div>
                                <div className="stats-card-record">
                                    <span className="stats-big">{calorieStats.lowest[0].total}</span> kcal
                                    {calorieStats.lowest[0].count > 1 && (
                                        <span className="stats-tie-count" title="Same total on more than one day — earliest shown">
                                            ({calorieStats.lowest[0].count})
                                        </span>
                                    )}
                                </div>
                                <div className="stats-card-date">{fmtDate(calorieStats.lowest[0].dateKey)}</div>
                                {expanded && (
                                    <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                        {calorieStats.lowest.map((r, i) => (
                                            <li key={i}>
                                                <span className="stats-top-value">{r.total} kcal</span>
                                                <span className="stats-top-date">{fmtDate(r.dateKey)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            <div
                                className={`stats-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: CAL_COLOR }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: CAL_COLOR }}>Heaviest Day</span>
                                    <span className="stats-card-sets">{calorieStats.entries} entries</span>
                                </div>
                                <div className="stats-card-record">
                                    <span className="stats-big">{calorieStats.highest[0].total}</span> kcal
                                    {calorieStats.highest[0].count > 1 && (
                                        <span className="stats-tie-count">({calorieStats.highest[0].count})</span>
                                    )}
                                </div>
                                <div className="stats-card-date">{fmtDate(calorieStats.highest[0].dateKey)}</div>
                                {expanded && (
                                    <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                        {calorieStats.highest.map((r, i) => (
                                            <li key={i}>
                                                <span className="stats-top-value">{r.total} kcal</span>
                                                <span className="stats-top-date">{fmtDate(r.dateKey)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            <div
                                className={`stats-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: CAL_COLOR }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: CAL_COLOR }}>Daily Average</span>
                                    <span className="stats-card-sets">
                                        {calorieStats.under} under / {calorieStats.over} over
                                    </span>
                                </div>
                                <div className="stats-card-record">
                                    <span className="stats-big">{calorieStats.avg}</span> kcal
                                </div>
                                <div className="stats-card-date">across {calorieStats.daysLogged} logged days</div>
                            </div>

                            {calorieStats.deficits.length > 0 && (
                                <div
                                    className={`stats-card ${expanded ? 'expanded' : ''}`}
                                    style={{ borderLeftColor: CAL_COLOR }}
                                    onClick={() => setExpanded((v) => !v)}
                                >
                                    <div className="stats-card-head">
                                        <span className="stats-card-name" style={{ color: CAL_COLOR }}>Biggest Deficit</span>
                                        <span className="stats-card-sets">under goal</span>
                                    </div>
                                    <div className="stats-card-record">
                                        <span className="stats-big">{Math.abs(calorieStats.deficits[0].diff)}</span> kcal
                                    </div>
                                    <div className="stats-card-date">
                                        {calorieStats.deficits[0].total} of {calorieStats.deficits[0].goal} · {fmtDate(calorieStats.deficits[0].dateKey)}
                                    </div>
                                    {expanded && (
                                        <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                            {calorieStats.deficits.map((r, i) => (
                                                <li key={i}>
                                                    <span className="stats-top-value">{Math.abs(r.diff)} kcal</span>
                                                    <span className="stats-top-date">{fmtDate(r.dateKey)}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            )}

                            {calorieStats.underStreaks.length > 0 && (
                                <div
                                    className={`stats-card ${expanded ? 'expanded' : ''}`}
                                    style={{ borderLeftColor: CAL_COLOR }}
                                    onClick={() => setExpanded((v) => !v)}
                                >
                                    <div className="stats-card-head">
                                        <span className="stats-card-name" style={{ color: CAL_COLOR }}>Longest Under Goal</span>
                                        <span className="stats-card-sets">consecutive days</span>
                                    </div>
                                    <div className="stats-card-record">
                                        <span className="stats-big">{calorieStats.underStreaks[0].len}</span>
                                        {calorieStats.underStreaks[0].len === 1 ? ' day' : ' days'}
                                    </div>
                                    <div className="stats-card-date">
                                        {fmtDate(calorieStats.underStreaks[0].start)} → {fmtDate(calorieStats.underStreaks[0].end)}
                                    </div>
                                    {expanded && (
                                        <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                            {calorieStats.underStreaks.map((s, i) => (
                                                <li key={i}>
                                                    <span className="stats-top-value">{s.len} {s.len === 1 ? 'day' : 'days'}</span>
                                                    <span className="stats-top-date">{fmtDate(s.start)} → {fmtDate(s.end)}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            )}

                            <div
                                className={`stats-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: CAL_COLOR }}
                                onClick={() => setExpanded((v) => !v)}
                            >
                                <div className="stats-card-head">
                                    <span className="stats-card-name" style={{ color: CAL_COLOR }}>Longest Logging Streak</span>
                                    <span className="stats-card-sets">consecutive days</span>
                                </div>
                                <div className="stats-card-record">
                                    <span className="stats-big">{calorieStats.logStreaks[0].len}</span>
                                    {calorieStats.logStreaks[0].len === 1 ? ' day' : ' days'}
                                </div>
                                <div className="stats-card-date">
                                    {fmtDate(calorieStats.logStreaks[0].start)} → {fmtDate(calorieStats.logStreaks[0].end)}
                                </div>
                                {expanded && (
                                    <ol className="stats-top-list" onClick={(e) => e.stopPropagation()}>
                                        {calorieStats.logStreaks.map((s, i) => (
                                            <li key={i}>
                                                <span className="stats-top-value">{s.len} {s.len === 1 ? 'day' : 'days'}</span>
                                                <span className="stats-top-date">{fmtDate(s.start)} → {fmtDate(s.end)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="stats-empty">No calorie data in this range.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Stats;
