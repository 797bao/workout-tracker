// WatchView.js - Galaxy Watch data (Samsung Health, copied into /samsungHealth
// by the MyStats phone app): runs, pace, heart rate, VO2 max, steps and sleep.
import React, { useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useSamsungHealth } from './useSamsungHealth';
import { useBodyStats } from './useBodyStats';
import { useIsMobile } from './useIsMobile';
import { ageAt, fmt, signed } from './bodyStatsMetrics';
import { useChart, selectPlugin, bandsPlugin, tooltipBase, Sparkline } from './healthCharts';
import './HealthPages.css';
import './WatchView.css';

// Datalabels is passed per chart, never registered globally (see BodyStatsView).
Chart.register(...registerables);

// #region Constants + formatting
const RANGES = [
  { id: '7', label: '7D', days: 7 },
  { id: '30', label: '30D', days: 30 },
  { id: '90', label: '90D', days: 90 },
  { id: '365', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: null },
];
const TYPE_LABELS = { running: 'Runs', walking: 'Walks', hiking: 'Hikes', biking: 'Rides', swimming: 'Swims' };
const TYPE_COLORS = { running: '#f28b82', walking: '#81c995', hiking: '#fcad70', biking: '#8ab4f8', swimming: '#78d9ec' };
const titleCase = (s) => String(s || 'other').replace(/\b\w/g, (c) => c.toUpperCase());
const typeLabel = (t) => TYPE_LABELS[t] || titleCase(t);
const typeColor = (t) => TYPE_COLORS[t] || '#C58AF9';
const C = { pace: '#fdd663', hr: '#f28b82', miles: '#8ab4f8', steps: '#8ab4f8', vo2: '#e8eaed', rest: '#C58AF9' };
const SLEEP_STAGES = [
  { key: 'deepMin', label: 'Deep', color: '#4a74d9' },
  { key: 'remMin', label: 'REM', color: '#C58AF9' },
  { key: 'lightMin', label: 'Light', color: '#8ab4f8' },
  { key: 'sleepingMin', label: 'Asleep', color: '#7fa7ee' },
  { key: 'awakeMin', label: 'Awake', color: '#fcad70' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function addDays(day, n) {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
/** '2026-10-18' -> '10/18' (chart axis). */
const shortDay = (day) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
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
/** 412 -> '6h 52m'. */
const hm = (min) => `${Math.floor(min / 60)}h ${pad2(Math.round(min % 60))}m`;
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
function ago(ms) {
  if (!ms) return 'never';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** Every number the watch has for one workout, one tooltip line each. */
function workoutLines(w) {
  return [
    w.distanceMi ? `${fmt(w.distanceMi, 2)} mi in ${durText(w.durationMin)}` : `Time ${durText(w.durationMin)}`,
    w.paceMinPerMi ? `Pace ${w.pacePerMi || paceText(w.paceMinPerMi)} /mi` : null,
    w.avgHr ? `Heart rate avg ${Math.round(w.avgHr)}${w.maxHr ? `, max ${Math.round(w.maxHr)}` : ''} bpm` : null,
    w.calories ? `${w.calories} cal` : null,
    w.vo2max ? `VO2 max ${fmt(w.vo2max)}` : null,
  ].filter(Boolean);
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
const VO2_PCT = ['below the 40th', '40th–60th', '60th–80th', '80th–95th', 'top 5%'];
const VO2_COLORS = ['#f28b82', '#fcad70', '#fdd663', '#a8dab5', '#81c995'];

const vo2Row = (age) => VO2_MEN.find((r) => age >= r.from && age <= r.to) || VO2_MEN[0];

function vo2Rating(age, v) {
  const row = vo2Row(age);
  let i = row.floors.findIndex((f) => v < f);
  if (i === -1) i = 4;
  return {
    index: i, level: VO2_LEVELS[i], pct: VO2_PCT[i], color: VO2_COLORS[i],
    ageLabel: row.from === 0 ? '20–29' : row.to === 200 ? '70+' : `${row.from}–${row.to}`,
    next: i < 4 ? { level: VO2_LEVELS[i + 1], at: row.floors[i], gap: row.floors[i] - v } : null,
  };
}

/** Rating bands as [{ lo, hi, label, color }] for the gauge and the chart. */
function vo2Bands(age) {
  const f = vo2Row(age).floors;
  const edges = [f[0] - 8, ...f, f[3] + 6];
  return VO2_LEVELS.map((label, i) => ({ lo: edges[i], hi: edges[i + 1], label, color: VO2_COLORS[i] }));
}

function Vo2Gauge({ value, age }) {
  const bands = vo2Bands(age);
  const lo = bands[0].lo, hi = bands[bands.length - 1].hi;
  const pos = (v) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="bs-gauge wv-gauge">
      <div className="bs-gauge-track">
        {bands.map((b) => (
          <div key={b.label} className="bs-gauge-band" style={{ left: pos(b.lo), width: `calc(${pos(b.hi)} - ${pos(b.lo)})`, background: b.color + '55' }}>
            <span>{b.label}</span>
          </div>
        ))}
        <div className="bs-gauge-now" style={{ left: pos(value) }}><span>{fmt(value)}</span></div>
      </div>
      <div className="bs-gauge-scale">
        {bands.slice(1).map((b) => <span key={b.lo} style={{ left: pos(b.lo) }}>{fmt(b.lo)}</span>)}
      </div>
    </div>
  );
}
// #endregion

function WatchView({ database }) {
  const isMobile = useIsMobile();
  const { data, loaded } = useSamsungHealth(database);
  const { profile } = useBodyStats(database);
  const [range, setRange] = useState('30');
  const [type, setType] = useState(null); // null = runs when there are any, else everything
  const [selected, setSelected] = useState(null); // workout id

  const today = dayKey(new Date());
  const days = RANGES.find((r) => r.id === range).days;
  const from = days ? addDays(today, 1 - days) : '';
  const age = ageAt(profile?.dob, today) ?? 25;

  // #region Data in range
  const all = useMemo(() => {
    const d = data || {};
    const workouts = Object.entries(d.exercise || {}).map(([id, w]) => ({ id, ...w, type: w.type || 'other' }))
      .sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
    const counts = {};
    for (const w of workouts) counts[w.type] = (counts[w.type] || 0) + 1;
    return {
      workouts,
      types: Object.keys(counts).sort((a, b) => (b === 'running') - (a === 'running') || counts[b] - counts[a]),
      vo2: Object.values(d.vo2max || {}).sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0)),
      daily: d.daily || {},
      sleep: Object.values(d.sleep || {}).sort((a, b) => String(a.date).localeCompare(String(b.date))),
      meta: d.meta || {},
      error: d.error || null,
    };
  }, [data]);

  const activeType = type ?? (all.types.includes('running') ? 'running' : 'all');
  const workouts = useMemo(
    () => all.workouts.filter((w) => (!from || w.date >= from) && (activeType === 'all' || w.type === activeType)),
    [all, from, activeType]
  );
  const runs = useMemo(() => all.workouts.filter((w) => w.type === 'running' && (!from || w.date >= from)), [all, from]);
  const vo2 = useMemo(() => all.vo2.filter((v) => !from || v.date >= from), [all, from]);
  const sleep = useMemo(() => all.sleep.filter((s) => !from || s.date >= from), [all, from]);
  // Every calendar day from the start of the range (or of the data) to today,
  // so quiet days show as gaps instead of disappearing.
  const dailyRows = useMemo(() => {
    const keys = Object.keys(all.daily).sort();
    if (!keys.length) return [];
    const out = [];
    for (let d = from && from > keys[0] ? from : keys[0]; d <= today; d = addDays(d, 1)) out.push({ date: d, ...(all.daily[d] || {}) });
    return out;
  }, [all, from, today]);
  const dataSince = [Object.keys(all.daily).sort()[0], all.workouts[0]?.date].filter(Boolean).sort()[0] || null;
  const hrSince = Object.keys(all.daily).sort().find((d) => all.daily[d].hrAvg || all.daily[d].restingHr) || null;
  // #endregion

  // #region KPI cards
  const latestVo2 = all.vo2[all.vo2.length - 1] || null;
  const rating = latestVo2 ? vo2Rating(age, latestVo2.value) : null;
  const runMiles = sum(runs.map((w) => w.distanceMi));
  const runMinutes = sum(runs.filter((w) => w.distanceMi).map((w) => w.durationMin));
  const avgPace = runMiles > 0 ? runMinutes / runMiles : null;
  const fastest = runs.filter((w) => w.paceMinPerMi).reduce((b, w) => (!b || w.paceMinPerMi < b.paceMinPerMi ? w : b), null);
  const hrRuns = runs.filter((w) => w.avgHr && w.durationMin);
  const runHr = hrRuns.length ? sum(hrRuns.map((w) => w.avgHr * w.durationMin)) / sum(hrRuns.map((w) => w.durationMin)) : null;
  const peakHr = runs.reduce((m, w) => Math.max(m, w.maxHr || 0), 0) || null;
  const stepDays = dailyRows.filter((d) => d.steps);
  const avgSteps = stepDays.length ? sum(stepDays.map((d) => d.steps)) / stepDays.length : null;
  const restDays = dailyRows.filter((d) => d.restingHr);
  const lowDays = dailyRows.filter((d) => d.hrMin);
  const restKpi = restDays.length
    ? { label: 'Resting HR', v: restDays[restDays.length - 1].restingHr, sub: longDay(restDays[restDays.length - 1].date), series: dailyRows.map((d) => d.restingHr ?? null) }
    : lowDays.length
      ? { label: 'Lowest HR', v: Math.min(...lowDays.map((d) => d.hrMin)), sub: 'no resting HR synced', series: dailyRows.map((d) => d.hrMin ?? null) }
      : { label: 'Resting HR', v: null, sub: 'no heart rate yet', series: [] };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const kpis = [
    { id: 'vo2', label: 'VO2 max', value: latestVo2 ? fmt(latestVo2.value) : '—', unit: '',
      sub: rating ? `${rating.level} for men ${rating.ageLabel}` : 'no reading yet', subColor: rating?.color,
      series: vo2.map((v) => v.value), color: C.vo2 },
    { id: 'miles', label: 'Miles run', value: fmt(runMiles), unit: 'mi', sub: plural(runs.length, 'run'),
      series: runs.map((w) => w.distanceMi ?? null), color: C.miles },
    { id: 'pace', label: 'Avg run pace', value: paceText(avgPace), unit: '/mi',
      sub: fastest ? `best ${fastest.pacePerMi || paceText(fastest.paceMinPerMi)} (${longDay(fastest.date)})` : '—',
      series: runs.map((w) => (w.paceMinPerMi ? -w.paceMinPerMi : null)), color: C.pace }, // negated: faster plots higher
    { id: 'hr', label: 'Run heart rate', value: runHr ? Math.round(runHr) : '—', unit: runHr ? 'bpm' : '',
      sub: peakHr ? `avg across runs · peak ${Math.round(peakHr)}` : '—', series: runs.map((w) => w.avgHr ?? null), color: C.hr },
    { id: 'steps', label: 'Steps / day', value: avgSteps ? Math.round(avgSteps).toLocaleString('en-US') : '—', unit: '',
      sub: `average of ${plural(stepDays.length, 'day')}`, series: dailyRows.map((d) => d.steps ?? null), color: C.steps },
    { id: 'rest', label: restKpi.label, value: restKpi.v ?? '—', unit: restKpi.v ? 'bpm' : '', sub: restKpi.sub,
      series: restKpi.series, color: C.rest },
  ];
  // #endregion

  // #region Workout charts: pace + heart rate (top) over distance (bottom), one slot per workout.
  // Fixed axis widths on both sides keep the two plot areas aligned.
  const AXIS_W = isMobile ? 40 : 46;
  const fixAxis = (scale) => { scale.width = AXIS_W; };
  const selIdx = workouts.findIndex((w) => w.id === selected);
  const xTicks = { color: '#bdc1c6', font: { size: isMobile ? 9 : 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 };
  const workoutTooltip = {
    ...tooltipBase,
    displayColors: false,
    filter: (_item, i) => i === 0, // one block per workout, not one per line
    callbacks: {
      title: (items) => {
        const w = workouts[items[0].dataIndex];
        return `${longDay(w.date)} ${clock(w.start)} · ${titleCase(w.type)}`;
      },
      label: (ctx) => workoutLines(workouts[ctx.dataIndex]),
    },
  };
  const pickWorkout = (_e, els) => { if (els[0]) setSelected(workouts[els[0].index].id); };
  const showValueLabels = !isMobile || workouts.length <= 8;

  const paceCanvas = useRef(null);
  useChart(paceCanvas, () => {
    if (!workouts.length) return null;
    const paces = workouts.map((w) => w.paceMinPerMi ?? null);
    const known = paces.filter((v) => v !== null);
    return {
      type: 'line',
      data: {
        labels: workouts.map((w) => shortDay(w.date)),
        datasets: [
          {
            label: 'Pace', yAxisID: 'y', data: paces, spanGaps: true, tension: 0.2,
            borderColor: C.pace, backgroundColor: C.pace, borderWidth: 2.5,
            pointRadius: (ctx) => (ctx.dataIndex === selIdx ? 6 : 4),
            pointBackgroundColor: (ctx) => (ctx.dataIndex === selIdx ? '#fff' : C.pace),
            pointBorderColor: C.pace, pointBorderWidth: 2,
            datalabels: {
              display: (ctx) => paces[ctx.dataIndex] !== null && (showValueLabels || ctx.dataIndex === selIdx),
              color: C.pace, align: 'top', anchor: 'end', offset: 4, font: { size: 11, weight: '700' }, formatter: (v) => paceText(v),
            },
          },
          {
            label: 'Avg heart rate', yAxisID: 'y2', data: workouts.map((w) => w.avgHr ?? null), spanGaps: true, tension: 0.2,
            borderColor: C.hr, backgroundColor: C.hr, borderWidth: 2, borderDash: [5, 4],
            pointRadius: (ctx) => (ctx.dataIndex === selIdx ? 5 : 3), pointBackgroundColor: C.hr, pointBorderColor: C.hr,
            datalabels: { display: false },
          },
        ],
      },
      plugins: [ChartDataLabels, selectPlugin],
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 18 } },
        onClick: pickWorkout,
        plugins: { legend: { display: false }, selected: { idx: selIdx }, tooltip: workoutTooltip },
        scales: {
          x: { offset: true, ticks: { display: false }, grid: { display: false } }, // offset: centre on the bars below
          y: {
            reverse: true, // faster pace sits higher
            min: known.length ? Math.floor(Math.min(...known) - 0.5) : 6,
            max: known.length ? Math.ceil(Math.max(...known) + 0.5) : 14,
            afterFit: fixAxis,
            ticks: { color: C.pace, maxTicksLimit: 6, font: { size: isMobile ? 10 : 12 }, callback: (v) => paceText(v) },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y2: {
            position: 'right', afterFit: fixAxis, suggestedMin: 110, suggestedMax: 190,
            ticks: { color: C.hr, maxTicksLimit: 5 }, grid: { display: false },
          },
        },
      },
    };
  }, [workouts, selIdx, isMobile]);

  const distCanvas = useRef(null);
  useChart(distCanvas, () => {
    if (!workouts.length) return null;
    const color = (w) => (activeType === 'all' ? typeColor(w.type) : C.miles);
    return {
      type: 'bar',
      data: {
        labels: workouts.map((w) => shortDay(w.date)),
        datasets: [{
          label: 'Miles', data: workouts.map((w) => w.distanceMi ?? null),
          backgroundColor: workouts.map((w) => color(w) + 'b3'), borderColor: workouts.map(color), borderWidth: 1,
          barPercentage: 0.7, categoryPercentage: 0.9,
          datalabels: {
            display: showValueLabels, color: '#e8eaed', anchor: 'end', align: 'top', offset: 2,
            font: { size: 10, weight: '600' }, formatter: (v) => (v ? fmt(v, 2) : ''),
          },
        }],
      },
      plugins: [ChartDataLabels, selectPlugin],
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 14, right: AXIS_W } }, // stands in for the pace chart's right axis
        onClick: pickWorkout,
        plugins: { legend: { display: false }, selected: { idx: selIdx }, tooltip: workoutTooltip },
        scales: {
          x: { ticks: xTicks, grid: { display: false } },
          y: {
            beginAtZero: true, afterFit: fixAxis,
            ticks: { color: '#9aa0a6', maxTicksLimit: 4 }, grid: { color: 'rgba(255,255,255,0.07)' },
          },
        },
      },
    };
  }, [workouts, selIdx, isMobile, activeType]);
  // #endregion

  // #region VO2 max over the rating bands
  const vo2Canvas = useRef(null);
  useChart(vo2Canvas, () => {
    if (vo2.length < 2) return null;
    const vals = vo2.map((v) => v.value);
    return {
      type: 'line',
      data: {
        labels: vo2.map((v) => shortDay(v.date)),
        datasets: [{
          label: 'VO2 max', data: vals, borderColor: C.vo2, backgroundColor: C.vo2, borderWidth: 2.5, tension: 0.2, pointRadius: 4,
          datalabels: {
            display: !isMobile || vo2.length <= 8, color: C.vo2, align: 'top', anchor: 'end', offset: 4,
            font: { size: 11, weight: '700' }, formatter: (v) => fmt(v),
          },
        }],
      },
      plugins: [ChartDataLabels, bandsPlugin],
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 18, right: 62 } }, // band names sit in the right padding
        plugins: {
          legend: { display: false },
          bands: { bands: vo2Bands(age), axis: 'y' },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              title: (items) => `${longDay(vo2[items[0].dataIndex].date)} ${clock(vo2[items[0].dataIndex].time)}`,
              label: (ctx) => ` VO2 max ${fmt(ctx.parsed.y)} · ${vo2Rating(age, ctx.parsed.y).level}`,
            },
          },
        },
        scales: {
          x: { offset: true, ticks: xTicks, grid: { display: false } },
          y: {
            min: Math.floor((Math.min(...vals) - 3) / 2) * 2, max: Math.ceil((Math.max(...vals) + 3) / 2) * 2,
            ticks: { color: '#9aa0a6', maxTicksLimit: 5 }, grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    };
  }, [vo2, age, isMobile]);
  // #endregion

  // #region Daily steps + heart rate
  const dailyCanvas = useRef(null);
  useChart(dailyCanvas, () => {
    if (!dailyRows.length) return null;
    const hasHr = dailyRows.some((d) => d.hrAvg || d.restingHr);
    const line = (label, key, color, dash) => ({
      type: 'line', label, yAxisID: 'y2', data: dailyRows.map((d) => d[key] ?? null), order: 1,
      borderColor: color, backgroundColor: color, borderWidth: 2, borderDash: dash, pointRadius: 3, spanGaps: false,
    });
    return {
      type: 'bar',
      data: {
        labels: dailyRows.map((d) => shortDay(d.date)),
        datasets: [
          {
            type: 'bar', label: 'Steps', yAxisID: 'y', data: dailyRows.map((d) => d.steps ?? null), order: 2,
            backgroundColor: C.steps + '99', borderColor: C.steps, borderWidth: 1, barPercentage: 0.8, categoryPercentage: 0.9,
          },
          ...(hasHr ? [line('Avg HR', 'hrAvg', C.hr), line('Resting HR', 'restingHr', C.rest, [5, 4])] : []),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            callbacks: {
              title: (items) => longDay(dailyRows[items[0].dataIndex].date),
              label: (ctx) => (ctx.dataset.label === 'Steps'
                ? ` Steps ${Math.round(ctx.parsed.y).toLocaleString('en-US')}`
                : ` ${ctx.dataset.label} ${Math.round(ctx.parsed.y)} bpm`),
              afterBody: (items) => {
                const d = dailyRows[items[0].dataIndex];
                return [
                  d.hrMin && d.hrMax ? ` Heart rate range ${d.hrMin}–${d.hrMax} bpm` : null,
                  d.distanceKm ? ` ${fmt(d.distanceKm * 0.621371, 2)} mi on foot` : null,
                ].filter(Boolean);
              },
            },
          },
        },
        scales: {
          x: { ticks: { ...xTicks, maxTicksLimit: isMobile ? 7 : 16 }, grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { color: '#9aa0a6', maxTicksLimit: 5, callback: (v) => (v >= 1000 ? `${v / 1000}k` : v) },
            grid: { color: 'rgba(255,255,255,0.07)' },
          },
          y2: {
            display: hasHr, position: 'right', suggestedMin: 50, suggestedMax: 180,
            ticks: { color: C.hr, maxTicksLimit: 5 }, grid: { display: false },
          },
        },
      },
    };
  }, [dailyRows, isMobile]);
  // #endregion

  // #region Sleep stages per night
  const sleepStages = SLEEP_STAGES.filter((st) => sleep.some((s) => s.stages?.[st.key]));
  const sleepCanvas = useRef(null);
  useChart(sleepCanvas, () => {
    if (!sleep.length) return null;
    const datasets = sleepStages.length
      ? sleepStages.map((st) => ({
        label: st.label, stack: 'night', backgroundColor: st.color, barPercentage: 0.75, categoryPercentage: 0.9,
        data: sleep.map((s) => (s.stages?.[st.key] || 0) / 60),
      }))
      : [{ label: 'Asleep', stack: 'night', backgroundColor: '#8ab4f8', data: sleep.map((s) => (s.durationMin || 0) / 60) }];
    return {
      type: 'bar',
      data: { labels: sleep.map((s) => shortDay(s.date)), datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            filter: (item) => item.parsed.y > 0,
            callbacks: {
              title: (items) => {
                const s = sleep[items[0].dataIndex];
                return `${longDay(s.date)} · ${clock(s.start)} to ${clock(s.end)}`;
              },
              label: (ctx) => ` ${ctx.dataset.label} ${hm(ctx.parsed.y * 60)}`,
              footer: (items) => `In bed ${hm(sleep[items[0].dataIndex].durationMin || 0)}`,
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: xTicks, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: '#9aa0a6', callback: (v) => `${v}h` }, grid: { color: 'rgba(255,255,255,0.07)' } },
        },
      },
    };
  }, [sleep, isMobile]);
  const avgSleep = sleep.length ? sum(sleep.map((s) => s.durationMin)) / sleep.length : null;
  // #endregion

  const header = (
    <div className="stats-header">
      <h2 className="stats-title">Watch</h2>
      <span className="stats-subtitle">Galaxy Watch · runs, heart rate, VO2 max</span>
    </div>
  );
  if (!loaded) {
    return <div className="stats-page health-page watch-page">{header}<div className="stats-loading">Loading watch data…</div></div>;
  }
  if (all.error || (!all.workouts.length && !all.vo2.length && !Object.keys(all.daily).length)) {
    return (
      <div className="stats-page health-page watch-page">
        {header}
        <div className="hp-empty">
          {all.error ? `Couldn't read watch data (${all.error}).` : 'No watch data yet. The MyStats app copies it from Samsung Health every 3 hours.'}
        </div>
      </div>
    );
  }

  const label = activeType === 'all' ? 'workouts' : typeLabel(activeType).toLowerCase();
  const firstVo2 = vo2[0];
  return (
    <div className="stats-page health-page watch-page">
      {header}

      <div className="range-bar">
        <div className="view-toggle">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'active' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </div>
        <div className="view-toggle">
          {[...all.types, 'all'].map((t) => (
            <button key={t} className={activeType === t ? 'active' : ''} onClick={() => setType(t)}>{t === 'all' ? 'All' : typeLabel(t)}</button>
          ))}
        </div>
        <span className="range-info" title={all.meta.lastSync || ''}>
          Synced {ago(all.meta.lastSyncMs)}{dataSince ? ` · data since ${longDay(dataSince)}` : ''}
        </span>
      </div>

      <div className="bs-kpis wv-kpis">
        {kpis.map((k) => (
          <div key={k.id} className="bs-kpi">
            <div className="bs-kpi-label">{k.label}</div>
            <div className="bs-kpi-value">{k.value}<span className="bs-kpi-unit">{k.unit ? ' ' + k.unit : ''}</span></div>
            <div className="bs-kpi-delta" style={k.subColor ? { color: k.subColor } : undefined}>{k.sub}</div>
            <Sparkline values={k.series} index={-1} color={k.color} />
          </div>
        ))}
      </div>

      <div className="wv-row">
        <div className="bs-card">
          <div className="bs-panel-title">
            {activeType === 'all' ? 'Workouts' : typeLabel(activeType)} · pace, heart rate, distance
            <span className="bs-legend">
              <i className="line" style={{ background: C.pace }} />Pace
              <i className="line dashed" style={{ borderColor: C.hr }} />Avg HR
              <i style={{ background: activeType === 'all' ? '#9aa0a6' : C.miles }} />Miles
            </span>
          </div>
          {workouts.length ? (
            <>
              <div className="wv-pace-chart"><canvas ref={paceCanvas} /></div>
              <div className="wv-dist-chart"><canvas ref={distCanvas} /></div>
              <div className="bs-footnote">Top: pace per mile (faster is higher) and average heart rate. Bottom: miles. Click a workout to find it in the table.</div>
            </>
          ) : (
            <div className="hp-empty">No {label} in this range.</div>
          )}
        </div>

        <div className="bs-card">
          <div className="bs-panel-title">Cardio fitness · VO2 max</div>
          {latestVo2 ? (
            <>
              <div className="wv-vo2-head">
                <span className="wv-vo2-big" style={{ color: rating.color }}>{fmt(latestVo2.value)}</span>
                <span className="wv-vo2-level" style={{ color: rating.color }}>{rating.level}</span>
                <span className="wv-vo2-sub">{rating.pct} percentile, men {rating.ageLabel} · {longDay(latestVo2.date)}</span>
              </div>
              <Vo2Gauge value={latestVo2.value} age={age} />
              <div className="bs-since">
                {rating.next
                  ? <>Next: <b>{rating.next.level}</b> at {fmt(rating.next.at)}, <b>{fmt(rating.next.gap)}</b> to go.</>
                  : <>Top rating for your age group.</>}
                {vo2.length > 1 && (
                  <> Since {longDay(firstVo2.date)}: <b className={latestVo2.value >= firstVo2.value ? 'good' : 'bad'}>{signed(latestVo2.value - firstVo2.value)}</b>.</>
                )}
              </div>
              {vo2.length >= 2 && <div className="wv-vo2-chart"><canvas ref={vo2Canvas} /></div>}
              <div className="bs-footnote">Watch estimate in mL/kg/min, updated on outdoor runs. Ratings: Cooper Institute, men by age.</div>
            </>
          ) : (
            <div className="hp-empty">No VO2 max yet. Galaxy Watch estimates it on outdoor runs.</div>
          )}
        </div>
      </div>

      <div className="wv-row">
        <div className="bs-card">
          <div className="bs-panel-title">
            Daily steps and heart rate
            <span className="bs-legend">
              <i style={{ background: C.steps }} />Steps
              <i className="line" style={{ background: C.hr }} />Avg HR
              <i className="line dashed" style={{ borderColor: C.rest }} />Resting HR
            </span>
          </div>
          {dailyRows.length
            ? <div className="wv-daily-chart"><canvas ref={dailyCanvas} /></div>
            : <div className="hp-empty">No daily data in this range.</div>}
          <div className="bs-footnote">
            {hrSince ? `Heart rate per day from ${longDay(hrSince)} on.` : 'No daily heart rate synced yet.'}
          </div>
        </div>

        <div className="bs-card">
          <div className="bs-panel-title">
            Sleep
            {sleepStages.length > 0 && (
              <span className="bs-legend">
                {sleepStages.map((st) => <React.Fragment key={st.key}><i style={{ background: st.color }} />{st.label}</React.Fragment>)}
              </span>
            )}
          </div>
          {sleep.length ? (
            <>
              <div className="wv-sleep-chart"><canvas ref={sleepCanvas} /></div>
              <div className="bs-footnote">Average {hm(avgSleep)} in bed over {plural(sleep.length, 'night')}.</div>
            </>
          ) : (
            <div className="hp-empty">No sleep synced yet. Samsung Health may not be sharing sleep with Health Connect.</div>
          )}
        </div>
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">{activeType === 'all' ? 'All workouts' : typeLabel(activeType)} · click a row to find it on the chart</div>
        {workouts.length ? (
          <div className="bs-table-wrap">
            <table className="bs-table">
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Miles</th><th>Time</th><th>Pace /mi</th>
                  <th>Avg HR</th><th>Max HR</th><th>Cal</th><th>VO2 max</th>
                </tr>
              </thead>
              <tbody>
                {[...workouts].reverse().map((w) => (
                  <tr key={w.id} className={w.id === selected ? 'sel' : ''} onClick={() => setSelected(w.id === selected ? null : w.id)}>
                    <td>{longDay(w.date)}<span className="wv-clock">{clock(w.start)}</span></td>
                    <td><span className="bs-dot" style={{ background: typeColor(w.type) }} />{titleCase(w.type)}</td>
                    <td>{w.distanceMi ? fmt(w.distanceMi, 2) : '—'}</td>
                    <td>{durText(w.durationMin)}</td>
                    <td>{w.paceMinPerMi ? (w.pacePerMi || paceText(w.paceMinPerMi)) : '—'}</td>
                    <td>{w.avgHr ? Math.round(w.avgHr) : '—'}</td>
                    <td>{w.maxHr ? Math.round(w.maxHr) : '—'}</td>
                    <td>{w.calories ?? '—'}</td>
                    <td>{w.vo2max ? fmt(w.vo2max) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hp-empty">No {label} in this range.</div>
        )}
        <div className="bs-footnote">
          From Samsung Health on the Galaxy Watch, copied by the MyStats app every 3 hours.
          {all.meta.lastSync ? ` Last sync ${new Date(all.meta.lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : ''}
        </div>
      </div>
    </div>
  );
}

export default WatchView;
