// RunningView.js - runs from the Galaxy Watch (Samsung Health, copied into
// /samsungHealth by the MyStats phone app): VO2 max, distance and pace over time.
import React, { useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useSamsungHealth } from './useSamsungHealth';
import { useBodyStats } from './useBodyStats';
import { useIsMobile } from './useIsMobile';
import { ageAt, fmt, signed } from './bodyStatsMetrics';
import { useChart, bandsPlugin, tooltipBase } from './healthCharts';
import './HealthPages.css';
import './RunningView.css';

Chart.register(...registerables);

// #region Constants + formatting
const RANGES = [
  { id: '3m', label: '3M', months: 3 },
  { id: '6m', label: '6M', months: 6 },
  { id: '1y', label: '1Y', months: 12 },
  { id: 'all', label: 'All', months: null },
];
const RUN_TYPES = new Set(['running', 'treadmill run']);
// Paces outside this band are a treadmill run without distance, walk breaks or a
// GPS dropout (one 0.6 mi "run" took 72 min); they stay in the table but not in pace stats.
const PACE_OK = (w) => w.paceMinPerMi >= 4.5 && w.paceMinPerMi <= 20;
const C = { vo2: '#e8eaed', miles: '#8ab4f8', pace: '#fdd663', trend: '#C58AF9' };
const DAY = 86400000;
const TABLE_ROWS = 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** '2026-10-18' -> 'Oct 18' ('Oct 18, 2025' outside this year). */
function longDay(day) {
  const y = Number(day.slice(0, 4));
  const base = `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
  return y === new Date().getFullYear() ? base : `${base}, ${y}`;
}
/** 8.87 min per mile -> '8:52'. */
function paceText(min) {
  if (!min || !isFinite(min)) return '—';
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}
/** 13.6 -> '13:36', 69.8 -> '1:09:48'. */
function durText(min) {
  if (min === null || min === undefined) return '—';
  const s = Math.round(min * 60);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
}
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
function ago(ms) {
  if (!ms) return 'never';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Runs table: click a header to sort by it, click again to flip. `first` is the
// direction a fresh click starts in; `words` say it in the title (desc, asc).
const COLUMNS = [
  { id: 'date', label: 'Date', get: (w) => w.startMs, first: 'desc', words: ['newest', 'oldest'],
    cell: (w) => <>{longDay(w.date)}<span className="rv-clock">{clock(w.start)}</span></> },
  { id: 'miles', label: 'Miles', get: (w) => w.distanceMi, first: 'desc', words: ['longest', 'shortest'],
    cell: (w) => (w.distanceMi ? fmt(w.distanceMi, 2) : '—') },
  { id: 'time', label: 'Time', get: (w) => w.durationMin, first: 'desc', words: ['longest time', 'shortest time'],
    cell: (w) => durText(w.durationMin) },
  { id: 'pace', label: 'Pace /mi', get: (w) => w.paceMinPerMi, first: 'asc', words: ['slowest', 'fastest'],
    cell: (w) => (!w.paceMinPerMi ? '—' : PACE_OK(w)
      ? (w.pacePerMi || paceText(w.paceMinPerMi))
      : <span className="rv-off" title="Left out of pace stats: distance or time looks wrong">{w.pacePerMi || paceText(w.paceMinPerMi)}</span>) },
  { id: 'avgHr', label: 'Avg HR', get: (w) => w.avgHr, first: 'desc', words: ['highest avg HR', 'lowest avg HR'],
    cell: (w) => (w.avgHr ? Math.round(w.avgHr) : '—') },
  { id: 'maxHr', label: 'Max HR', get: (w) => w.maxHr, first: 'desc', words: ['highest max HR', 'lowest max HR'],
    cell: (w) => (w.maxHr ? Math.round(w.maxHr) : '—') },
  { id: 'vo2', label: 'VO2 max', get: (w) => w.vo2max, first: 'desc', words: ['highest VO2 max', 'lowest VO2 max'],
    cell: (w) => (w.vo2max ? fmt(w.vo2max) : '—') },
];

/** Start of the day, week (Monday) or month holding `day`, and the start of the next one. */
function period(day, unit) {
  const d = new Date(day + 'T00:00:00');
  if (unit === 'day') {
    return { start: d.getTime(), end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() };
  }
  if (unit === 'month') {
    return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
  }
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return { start: monday.getTime(), end: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).getTime() };
}
// #endregion

// #region VO2 max ratings
// Cooper Institute ratings for men (mL/kg/min), as printed in Garmin's watch
// manuals: the floor of Fair, Good, Excellent and Superior, which sit at the
// 40th, 60th, 80th and 95th percentile for the age group.
const VO2_MEN = [
  { from: 0, to: 29, floors: [41.7, 45.4, 51.1, 55.4] },
  { from: 30, to: 39, floors: [40.5, 44.0, 48.3, 54.0] },
  { from: 40, to: 49, floors: [38.5, 42.4, 46.4, 52.5] },
  { from: 50, to: 59, floors: [35.6, 39.2, 43.4, 48.9] },
  { from: 60, to: 69, floors: [32.3, 35.5, 39.5, 45.7] },
  { from: 70, to: 200, floors: [29.4, 32.3, 36.7, 42.1] },
];
const VO2_LEVELS = ['Poor', 'Fair', 'Good', 'Excellent', 'Superior'];
const VO2_COLORS = ['#f28b82', '#fcad70', '#fdd663', '#a8dab5', '#81c995'];

const vo2Row = (age) => VO2_MEN.find((r) => age >= r.from && age <= r.to) || VO2_MEN[0];

function vo2Rating(age, v) {
  const row = vo2Row(age);
  let i = row.floors.findIndex((f) => v < f);
  if (i === -1) i = 4;
  return {
    level: VO2_LEVELS[i], color: VO2_COLORS[i],
    ageLabel: row.from === 0 ? '20–29' : row.to === 200 ? '70+' : `${row.from}–${row.to}`,
    next: i < 4 ? { level: VO2_LEVELS[i + 1], at: row.floors[i] } : null,
  };
}

/** Rating bands as [{ lo, hi, label, color }] behind the VO2 max line. */
function vo2Bands(age) {
  const f = vo2Row(age).floors;
  const edges = [0, ...f, 100];
  return VO2_LEVELS.map((label, i) => ({ lo: edges[i], hi: edges[i + 1], label, color: VO2_COLORS[i] }));
}
// #endregion

function RunningView({ database }) {
  const isMobile = useIsMobile();
  const { data, loaded } = useSamsungHealth(database);
  const { profile } = useBodyStats(database);
  const [range, setRange] = useState('all');
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' });

  const today = dayKey(new Date());
  const age = ageAt(profile?.dob, today) ?? 25;

  // #region Runs and VO2 max in range
  const all = useMemo(() => {
    const d = data || {};
    return {
      runs: Object.entries(d.exercise || {}).map(([id, w]) => ({ id, ...w }))
        .filter((w) => RUN_TYPES.has(w.type))
        .sort((a, b) => (a.startMs || 0) - (b.startMs || 0)),
      vo2: Object.values(d.vo2max || {}).filter((v) => v.value).sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0)),
      meta: d.meta || {},
      error: d.error || null,
    };
  }, [data]);

  const firstDay = [all.runs[0]?.date, all.vo2[0]?.date].filter(Boolean).sort()[0] || today;
  const months = RANGES.find((r) => r.id === range).months;
  let from = firstDay;
  if (months) {
    const d = new Date(today + 'T00:00:00');
    d.setMonth(d.getMonth() - months);
    from = dayKey(d);
  }
  // Days, weeks or months depending on the span. The axis runs from the start
  // of the first period to the end of the current one, the same on all charts.
  const span = Date.parse(today) - Date.parse(from);
  const unit = span > 183 * DAY ? 'month' : span > 62 * DAY ? 'week' : 'day';
  const xMin = period(from, unit).start;
  const xMax = period(today, unit).end;

  const runs = useMemo(() => all.runs.filter((w) => w.date >= from), [all, from]);
  const vo2 = useMemo(() => all.vo2.filter((v) => v.date >= from), [all, from]);

  const buckets = useMemo(() => {
    const map = new Map();
    for (const w of runs) {
      const p = period(w.date, unit);
      const b = map.get(p.start) || { ...p, miles: 0, runs: 0, timedMiles: 0, minutes: 0 };
      b.miles += w.distanceMi || 0;
      b.runs += 1;
      if (PACE_OK(w)) { b.timedMiles += w.distanceMi; b.minutes += w.durationMin; }
      map.set(p.start, b);
    }
    return [...map.values()].sort((a, b) => a.start - b.start).map((b) => ({ ...b, mid: (b.start + b.end) / 2 }));
  }, [runs, unit]);
  // #endregion

  // #region Headline numbers
  const latestVo2 = all.vo2[all.vo2.length - 1] || null;
  const rating = latestVo2 ? vo2Rating(age, latestVo2.value) : null;
  const vo2Change = vo2.length > 1 ? vo2[vo2.length - 1].value - vo2[0].value : null;
  const miles = runs.reduce((s, w) => s + (w.distanceMi || 0), 0);
  const paced = runs.filter(PACE_OK);
  const offPace = runs.filter((w) => w.paceMinPerMi && !PACE_OK(w)).length;
  const timedMiles = paced.reduce((s, w) => s + w.distanceMi, 0);
  const avgPace = timedMiles > 0 ? paced.reduce((s, w) => s + w.durationMin, 0) / timedMiles : null;
  const best = paced.reduce((b, w) => (!b || w.paceMinPerMi < b.paceMinPerMi ? w : b), null);
  const longest = runs.filter((w) => w.distanceMi).reduce((b, w) => (!b || w.distanceMi > b.distanceMi ? w : b), null);
  // #endregion

  // #region Charts: three stacked time charts with matching axes, so a date lines up down the page
  const AXIS_W = isMobile ? 40 : 48;
  const fixAxis = (scale) => { scale.width = AXIS_W; };
  const base = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
    layout: { padding: { right: 8 } },
  };
  const xAxis = {
    type: 'time', min: xMin, max: xMax,
    time: { minUnit: 'day', displayFormats: { day: 'MMM d', week: 'MMM d', month: isMobile ? 'MMM' : 'MMM yyyy', quarter: 'MMM yyyy', year: 'yyyy' } },
    ticks: { color: '#bdc1c6', font: { size: isMobile ? 9 : 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 14 },
    grid: { color: 'rgba(255,255,255,0.05)' },
  };
  const yTicks = { color: '#9aa0a6', maxTicksLimit: 5 };

  const vo2Canvas = useRef(null);
  useChart(vo2Canvas, () => {
    if (!vo2.length) return null;
    const vals = vo2.map((v) => v.value);
    return {
      type: 'line',
      data: {
        datasets: [{
          label: 'VO2 max', data: vo2.map((v) => ({ x: v.timeMs, y: v.value })),
          borderColor: C.vo2, backgroundColor: C.vo2, borderWidth: 2.5, tension: 0.25,
          pointRadius: vo2.length > 60 ? 0 : 3.5, pointHoverRadius: 6,
        }],
      },
      plugins: [bandsPlugin],
      options: {
        ...base,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          bands: { bands: vo2Bands(age), axis: 'y', inside: true },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              title: (items) => longDay(vo2[items[0].dataIndex].date),
              label: (ctx) => ` VO2 max ${fmt(ctx.parsed.y)} · ${vo2Rating(age, ctx.parsed.y).level}`,
            },
          },
        },
        scales: {
          x: xAxis,
          y: {
            min: Math.floor((Math.min(...vals) - 3) / 2) * 2, max: Math.ceil((Math.max(...vals) + 3) / 2) * 2,
            afterFit: fixAxis, ticks: yTicks, grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    };
  }, [vo2, age, xMin, xMax, isMobile]);

  const distCanvas = useRef(null);
  useChart(distCanvas, () => {
    if (!buckets.length) return null;
    return {
      type: 'bar',
      data: {
        datasets: [{
          label: 'Miles', data: buckets.map((b) => ({ x: b.mid, y: Math.round(b.miles * 100) / 100 })),
          backgroundColor: C.miles + 'b3', borderColor: C.miles, borderWidth: 1, borderRadius: 3,
          barPercentage: 0.85, categoryPercentage: 0.9, maxBarThickness: 40,
        }],
      },
      options: {
        ...base,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              title: (items) => {
                const b = buckets[items[0].dataIndex];
                const day = dayKey(new Date(b.start));
                if (unit === 'month') return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
                return unit === 'week' ? `Week of ${longDay(day)}` : longDay(day);
              },
              label: (ctx) => {
                const b = buckets[ctx.dataIndex];
                return ` ${fmt(b.miles, 2)} mi in ${plural(b.runs, 'run')}${b.timedMiles ? ` · avg ${paceText(b.minutes / b.timedMiles)} /mi` : ''}`;
              },
            },
          },
        },
        scales: {
          x: { ...xAxis, offset: false }, // bar charts pad the time axis by default; keep it lined up with the others
          y: { beginAtZero: true, afterFit: fixAxis, ticks: yTicks, grid: { color: 'rgba(255,255,255,0.07)' } },
        },
      },
    };
  }, [buckets, unit, xMin, xMax, isMobile]);

  const paceCanvas = useRef(null);
  useChart(paceCanvas, () => {
    const timed = runs.filter(PACE_OK);
    if (!timed.length) return null;
    const trend = buckets.filter((b) => b.timedMiles).map((b) => ({ x: b.mid, y: b.minutes / b.timedMiles }));
    const paces = [...timed.map((w) => w.paceMinPerMi), ...trend.map((t) => t.y)];
    return {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Run', data: timed.map((w) => ({ x: w.startMs, y: w.paceMinPerMi, w })), showLine: false,
            pointRadius: timed.length > 150 ? 2.5 : 4, pointHoverRadius: 6,
            pointBackgroundColor: C.pace, pointBorderColor: C.pace,
          },
          ...(unit !== 'day' && trend.length > 1 ? [{
            label: unit === 'month' ? 'Monthly average' : 'Weekly average', data: trend,
            borderColor: C.trend, backgroundColor: C.trend, borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4,
          }] : []),
        ],
      },
      options: {
        ...base,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            displayColors: false,
            callbacks: {
              title: (items) => {
                const raw = items[0].raw;
                return raw.w ? `${longDay(raw.w.date)} ${clock(raw.w.start)}` : items[0].dataset.label;
              },
              label: (ctx) => {
                const w = ctx.raw.w;
                if (!w) return ` Average ${paceText(ctx.parsed.y)} /mi`;
                return [
                  ` ${w.pacePerMi || paceText(w.paceMinPerMi)} /mi over ${fmt(w.distanceMi, 2)} mi`,
                  ` Time ${durText(w.durationMin)}`,
                  w.avgHr ? ` Heart rate avg ${Math.round(w.avgHr)}${w.maxHr ? `, max ${Math.round(w.maxHr)}` : ''}` : null,
                ].filter(Boolean);
              },
            },
          },
        },
        scales: {
          x: xAxis,
          y: {
            reverse: true, // faster is higher
            min: Math.floor(Math.min(...paces) - 0.5), max: Math.ceil(Math.max(...paces) + 0.5),
            afterFit: fixAxis, ticks: { ...yTicks, callback: (v) => paceText(v) }, grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    };
  }, [runs, buckets, unit, xMin, xMax, isMobile]);
  // #endregion

  // #region Runs table order
  const sortCol = COLUMNS.find((c) => c.id === sort.col);
  const sortedRuns = useMemo(() => {
    const has = (w) => Number.isFinite(sortCol.get(w)) && sortCol.get(w) > 0;
    const sign = sort.dir === 'asc' ? 1 : -1;
    // Runs without the value sink to the bottom, newest first
    return [
      ...runs.filter(has).sort((a, b) => sign * (sortCol.get(a) - sortCol.get(b)) || b.startMs - a.startMs),
      ...runs.filter((w) => !has(w)).sort((a, b) => b.startMs - a.startMs),
    ];
  }, [runs, sortCol, sort.dir]);
  const onSort = (c) => setSort((s) => (s.col === c.id ? { col: c.id, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { col: c.id, dir: c.first }));
  // #endregion

  const header = (
    <div className="stats-header">
      <h2 className="stats-title">Running</h2>
      <span className="stats-subtitle">Galaxy Watch runs and VO2 max</span>
    </div>
  );
  if (!loaded) {
    return <div className="stats-page health-page running-page">{header}<div className="stats-loading">Loading runs…</div></div>;
  }
  if (all.error || (!all.runs.length && !all.vo2.length)) {
    return (
      <div className="stats-page health-page running-page">
        {header}
        <div className="hp-empty">
          {all.error ? `Couldn't read watch data (${all.error}).` : 'No runs yet. The MyStats app copies them from Samsung Health every 3 hours.'}
        </div>
      </div>
    );
  }

  const shortHistory = Date.parse(today) - Date.parse(firstDay) < 45 * DAY;
  const tableRuns = showAllRuns ? sortedRuns : sortedRuns.slice(0, TABLE_ROWS);
  return (
    <div className="stats-page health-page running-page">
      {header}

      <div className="range-bar">
        <div className="view-toggle">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'active' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </div>
        <span className="range-info" title={all.meta.lastSync || ''}>
          Since {longDay(firstDay)} · synced {ago(all.meta.lastSyncMs)}
        </span>
      </div>

      {shortHistory && (
        <div className="rv-note">
          Only the last 30 days are here so far: that is all Samsung Health handed over when syncing started.
          Your older runs and VO2 max are still in Samsung Health and can be imported from its data export.
        </div>
      )}

      <div className="bs-kpis rv-kpis">
        <div className="bs-kpi">
          <div className="bs-kpi-label">VO2 max</div>
          <div className="bs-kpi-value" style={rating ? { color: rating.color } : undefined}>{latestVo2 ? fmt(latestVo2.value) : '—'}</div>
          <div className="bs-kpi-delta">
            {rating ? `${rating.level}${rating.next ? ` · ${rating.next.level} at ${fmt(rating.next.at)}` : ''}` : 'no reading yet'}
          </div>
          {vo2Change !== null && <div className={`bs-kpi-delta ${vo2Change >= 0 ? 'good' : 'bad'}`}>{signed(vo2Change)} in this range</div>}
        </div>
        <div className="bs-kpi">
          <div className="bs-kpi-label">Distance</div>
          <div className="bs-kpi-value">{fmt(miles)}<span className="bs-kpi-unit"> mi</span></div>
          <div className="bs-kpi-delta">{plural(runs.length, 'run')}</div>
        </div>
        <div className="bs-kpi">
          <div className="bs-kpi-label">Average pace</div>
          <div className="bs-kpi-value">{paceText(avgPace)}<span className="bs-kpi-unit"> /mi</span></div>
          <div className="bs-kpi-delta">{best ? `best ${best.pacePerMi || paceText(best.paceMinPerMi)} on ${longDay(best.date)}` : '—'}</div>
        </div>
        <div className="bs-kpi">
          <div className="bs-kpi-label">Longest run</div>
          <div className="bs-kpi-value">{longest ? fmt(longest.distanceMi, 2) : '—'}<span className="bs-kpi-unit">{longest ? ' mi' : ''}</span></div>
          <div className="bs-kpi-delta">{longest ? longDay(longest.date) : '—'}</div>
        </div>
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">
          VO2 max
          <span className="rv-title-note">cardio fitness · shaded by rating for men {rating?.ageLabel || '20–29'}</span>
        </div>
        {vo2.length
          ? <div className="rv-chart"><canvas ref={vo2Canvas} /></div>
          : <div className="hp-empty">No VO2 max in this range. The watch measures it on outdoor runs.</div>}
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">
          Distance
          <span className="rv-title-note">miles run per {unit}</span>
        </div>
        {buckets.length
          ? <div className="rv-chart rv-chart-short"><canvas ref={distCanvas} /></div>
          : <div className="hp-empty">No runs in this range.</div>}
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">
          Pace
          <span className="bs-legend">
            <i style={{ background: C.pace, borderRadius: '50%' }} />Each run
            {unit !== 'day' && <><i className="line" style={{ background: C.trend }} />{unit === 'month' ? 'Monthly' : 'Weekly'} average</>}
          </span>
          <span className="rv-title-note">minutes per mile · faster is higher</span>
        </div>
        {runs.some(PACE_OK)
          ? <div className="rv-chart"><canvas ref={paceCanvas} /></div>
          : <div className="hp-empty">No runs with distance in this range.</div>}
        {offPace > 0 && (
          <div className="bs-footnote">
            {plural(offPace, 'run')} slower than 20:00 /mi left out of pace (treadmill, walk breaks or GPS dropouts); they're still in the list below.
          </div>
        )}
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">
          Runs
          <span className="rv-title-note">{sortCol.words[sort.dir === 'desc' ? 0 : 1]} first · tap a column to sort</span>
        </div>
        {runs.length ? (
          <>
            <div className="bs-table-wrap">
              <table className="bs-table rv-table">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.id}
                        className={`rv-sort ${sort.col === c.id ? 'on' : ''}`}
                        aria-sort={sort.col === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        onClick={() => onSort(c)}
                      >
                        {c.label}<span className="rv-arrow">{sort.col === c.id ? (sort.dir === 'desc' ? '▼' : '▲') : ''}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRuns.map((w) => (
                    <tr key={w.id}>
                      {COLUMNS.map((c) => <td key={c.id} className={sort.col === c.id ? 'on' : ''}>{c.cell(w)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {runs.length > TABLE_ROWS && (
              <button className="range-clear rv-more" onClick={() => setShowAllRuns((v) => !v)}>
                {showAllRuns ? 'Show fewer' : `Show all ${runs.length} runs`}
              </button>
            )}
          </>
        ) : (
          <div className="hp-empty">No runs in this range.</div>
        )}
      </div>
    </div>
  );
}

export default RunningView;
