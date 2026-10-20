// MeasurementsView.js - Bao's tape measurements and blood pressure check-ins
// (/bodyMeasurements, 2019 on): a small trend per body part, blood pressure
// against the AHA categories, and every check-in side by side.
import React, { useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useBodyMeasurements } from './useBodyMeasurements';
import { useIsMobile } from './useIsMobile';
import { useChart, tooltipBase } from './healthCharts';
import BodyFigure from './MeasurementsBody';
import './HealthPages.css';
import './MeasurementsView.css';

// Datalabels is passed per chart, never registered globally (see BodyStatsView).
Chart.register(...registerables);

// #region Body parts, proportions, formatting
// Same colors as the workout chart's muscle groups; core has no group, so it borrows Calisthenics
const DELTS = '#ffad3f', CHEST = '#f44336', CORE = '#b4a4da', ARMS = '#93c47d', UPPER_LEGS = '#6d9eeb', LOWER_LEGS = '#cadcfd';
// Right side is the main value; the left is shown beside it when it was noted.
const PARTS = [
  { id: 'shoulder', label: 'Shoulders', color: DELTS, get: (e) => e.in?.shoulder },
  { id: 'chest', label: 'Chest', color: CHEST, get: (e) => e.in?.chest },
  { id: 'belowRib', label: 'Below rib', color: CORE, get: (e) => e.in?.belowRib },
  { id: 'waist', label: 'Waist', color: CORE, get: (e) => e.in?.waist },
  { id: 'stomach', label: 'Stomach', note: 'belly button', color: CORE, get: (e) => e.in?.stomach },
  { id: 'hips', label: 'Hips', color: CORE, get: (e) => e.in?.hips },
  { id: 'bicep', label: 'Biceps', color: ARMS, get: (e) => e.in?.bicepR, left: (e) => e.in?.bicepL },
  { id: 'bicepFlexed', label: 'Biceps flexed', color: ARMS, get: (e) => e.in?.bicepFlexedR },
  { id: 'forearm', label: 'Forearm', color: ARMS, get: (e) => e.in?.forearmR, left: (e) => e.in?.forearmL },
  { id: 'wrist', label: 'Wrist', color: ARMS, get: (e) => e.in?.wristR, left: (e) => e.in?.wristL },
  { id: 'thigh', label: 'Thigh', color: UPPER_LEGS, get: (e) => e.in?.thighR, left: (e) => e.in?.thighL },
  { id: 'calf', label: 'Calf', color: LOWER_LEGS, get: (e) => e.in?.calfR, left: (e) => e.in?.calfL },
];
const ratio = (a, b) => (a && b ? a / b : null);
const RATIOS = [
  { id: 'vShape', label: 'Shoulders ÷ stomach', note: 'higher = more V-shaped', color: '#e8eaed', get: (e) => ratio(e.in?.shoulder, e.in?.stomach) },
  { id: 'whr', label: 'Stomach ÷ hips', note: 'lower = slimmer middle', color: '#e8eaed', get: (e) => ratio(e.in?.stomach, e.in?.hips) },
];

const DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (day) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}, ${day.slice(0, 4)}`;
const monthYear = (day) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
const dayMs = (day) => Date.parse(day + 'T12:00:00');
const has = (v) => v !== null && v !== undefined;

const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
/** Tape reads in eighths: 37.625 -> '37⅝', 12.3 -> '12.3'. */
function inch(v) {
  if (!has(v)) return '—';
  const whole = Math.floor(v);
  const e = (v - whole) * 8;
  if (Math.abs(e - Math.round(e)) < 1e-6) return Math.round(e) === 8 ? String(whole + 1) : `${whole}${EIGHTHS[Math.round(e)]}`;
  return String(Math.round(v * 100) / 100);
}
const num2 = (v) => (has(v) ? v.toFixed(2) : '—');
/** Inch changes in tape eighths: +2½ / −⅜ / ±0 */
function deltaInch(d) {
  if (Math.abs(d) < 1e-9) return '±0';
  return (d > 0 ? '+' : '−') + inch(Math.abs(d)).replace(/^0(?=[⅛¼⅜½⅝¾⅞])/, '');
}
/** Ratio changes: +0.09 / −0.02 / ±0 */
function deltaNum(d) {
  const r = Math.round(d * 100) / 100;
  return r === 0 ? '±0' : (r > 0 ? '+' : '−') + Math.abs(r).toFixed(2);
}

// American Heart Association categories (2017 guideline).
function bpCategory(sys, dia) {
  if (sys >= 140 || dia >= 90) return { label: 'Stage 2', color: '#f28b82' };
  if (sys >= 130 || dia >= 80) return { label: 'Stage 1', color: '#fcad70' };
  if (sys >= 120) return { label: 'Elevated', color: '#fdd663' };
  return { label: 'Normal', color: '#81c995' };
}
// #endregion

// #region One small trend per measure
function TrendCard({ title, note, color, entries, get, left, show, unit, range }) {
  const pts = entries.map((e) => ({ e, v: get(e) })).filter((p) => has(p.v));
  const canvas = useRef(null);
  useChart(canvas, () => {
    if (!pts.length) return null;
    const vals = pts.map((p) => p.v);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max(unit ? 0.5 : 0.03, (hi - lo) * 0.25);
    return {
      type: 'line',
      data: {
        datasets: [{
          data: pts.map((p) => ({ x: dayMs(p.e.date), y: p.v, e: p.e })),
          borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0.2,
          pointRadius: 3.5, pointHoverRadius: 5, pointBorderWidth: 1.5, pointBorderColor: color,
          pointBackgroundColor: (ctx) => (ctx.raw?.e?.offsetIn ? '#2a2c33' : color), // hollow = soft tape, corrected
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        layout: { padding: { top: 4, right: 6 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase, displayColors: false,
            callbacks: {
              title: (items) => longDate(items[0].raw.e.date),
              label: (ctx) => {
                const e = ctx.raw.e;
                const l = left?.(e);
                return [
                  `${show(ctx.raw.y)}${unit}${has(l) && l !== ctx.raw.y ? ` (left ${show(l)}${unit})` : ''}`,
                  e.offsetIn ? `measured ${show(get({ ...e, in: e.rawIn }))}${unit} on the ${e.tape} tape, −${Math.abs(e.offsetIn)} in applied` : e.tape ? `${e.tape} tape` : null,
                ].filter(Boolean);
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time', min: range.min, max: range.max, time: { unit: 'year', displayFormats: { year: "''yy" } },
            ticks: { color: '#80868b', font: { size: 9 }, maxRotation: 0, autoSkipPadding: 6 }, grid: { display: false },
          },
          y: {
            min: lo - pad, max: hi + pad,
            ticks: { color: '#80868b', font: { size: 9 }, maxTicksLimit: 3, callback: (v) => (unit ? Math.round(v * 2) / 2 : v.toFixed(2)) },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    };
  }, [entries, range.min, range.max]);

  const first = pts[0], last = pts[pts.length - 1], prev = pts[pts.length - 2];
  const lastLeft = last && left?.(last.e);
  const fmtD = unit ? deltaInch : deltaNum;
  return (
    <div className="ms-card">
      <div className="ms-card-head">
        <span className="ms-card-title" style={{ color }}>{title}</span>
        {note && <span className="ms-card-note">{note}</span>}
      </div>
      {last ? (
        <>
          <div className="ms-card-value">
            {show(last.v)}<span className="bs-kpi-unit">{unit}</span>
            {has(lastLeft) && lastLeft !== last.v && <span className="ms-card-left">L {show(lastLeft)}</span>}
          </div>
          <div className="ms-card-sub">
            {monthYear(last.e.date)}{prev ? ` · ${fmtD(last.v - prev.v)} vs ${monthYear(prev.e.date)}` : ''}
          </div>
          <div className="ms-card-sub">
            {pts.length > 2 ? `${fmtD(last.v - first.v)} since ${monthYear(first.e.date)}` : pts.length === 1 ? 'measured once' : ' '}
          </div>
          <div className="ms-chart"><canvas ref={canvas} /></div>
        </>
      ) : (
        <div className="ms-card-sub">not measured yet</div>
      )}
    </div>
  );
}
// #endregion

function MeasurementsView({ database }) {
  const isMobile = useIsMobile();
  const { entries, loaded, error } = useBodyMeasurements(database);

  // Every trend shares one time axis, padded a few months each side
  const range = entries.length
    ? { min: dayMs(entries[0].date) - 90 * DAY, max: dayMs(entries[entries.length - 1].date) + 90 * DAY }
    : { min: 0, max: 0 };

  // #region Blood pressure
  const bp = entries.filter((e) => e.bp?.sys && e.bp?.dia);
  const bpCanvas = useRef(null);
  useChart(bpCanvas, () => {
    if (!bp.length) return null;
    const minX = dayMs(bp[0].date) - 120 * DAY, maxX = dayMs(bp[bp.length - 1].date) + 120 * DAY;
    const line = (label, color, key, extra = {}) => ({
      label, borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0.15, pointRadius: 4, pointHoverRadius: 6,
      data: bp.filter((e) => e.bp[key]).map((e) => ({ x: dayMs(e.date), y: e.bp[key], e })),
      datalabels: { display: false }, ...extra,
    });
    const limit = (label, y) => ({
      label, ref: true, borderColor: 'rgba(253,214,99,0.55)', borderWidth: 1, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 0,
      data: [{ x: minX, y }, { x: maxX, y }],
      datalabels: { display: (ctx) => ctx.dataIndex === 1, align: 'top', anchor: 'end', color: 'rgba(253,214,99,0.8)', font: { size: 10, weight: '600' }, formatter: () => `${y}` },
    });
    return {
      type: 'line',
      data: {
        datasets: [
          line('Systolic', '#f28b82', 'sys', {
            datalabels: {
              display: true, align: 'top', anchor: 'end', offset: 4, color: '#e8eaed', font: { size: isMobile ? 9 : 11, weight: '700' },
              formatter: (v) => `${v.e.bp.sys}/${v.e.bp.dia}`, // datalabels passes the data point, not ctx.raw
            },
          }),
          line('Diastolic', '#8ab4f8', 'dia'),
          line('Pulse', '#9aa0a6', 'pulse', { borderDash: [4, 4], borderWidth: 1.5, pointRadius: 3 }),
          limit('Systolic limit', 120),
          limit('Diastolic limit', 80),
        ],
      },
      plugins: [ChartDataLabels],
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        layout: { padding: { top: 22, right: 10 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase,
            filter: (item) => !item.dataset.ref,
            callbacks: {
              title: (items) => longDate(items[0].raw.e.date),
              label: (ctx) => ` ${ctx.dataset.label} ${ctx.parsed.y}`,
              footer: (items) => {
                const e = items[0].raw.e;
                return bpCategory(e.bp.sys, e.bp.dia).label;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time', min: minX, max: maxX, time: { unit: 'year', displayFormats: { year: 'yyyy' } },
            ticks: { color: '#bdc1c6', font: { size: isMobile ? 9 : 11 }, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: { min: 40, max: 145, ticks: { color: '#9aa0a6', maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    };
  }, [bp, isMobile]);
  // #endregion

  const header = (
    <div className="stats-header">
      <h2 className="stats-title">Measurements</h2>
      <span className="stats-subtitle">Tape measurements and blood pressure</span>
    </div>
  );
  if (!loaded) return <div className="stats-page health-page measurements-page">{header}<div className="stats-loading">Loading measurements…</div></div>;
  if (error || !entries.length) {
    return (
      <div className="stats-page health-page measurements-page">
        {header}
        <div className="hp-empty">{error ? `Couldn't read measurements (${error}).` : 'No measurements yet. They live in the database under bodyMeasurements.'}</div>
      </div>
    );
  }

  const lastBp = bp[bp.length - 1];
  const lastCat = lastBp ? bpCategory(lastBp.bp.sys, lastBp.bp.dia) : null;
  const corrected = entries.filter((e) => e.offsetIn);
  const cell = (part, e) => {
    const r = part.get(e), l = part.left?.(e);
    if (!has(r) && !has(l)) return '';
    if (has(l) && l !== r) return `${inch(r)} / ${inch(l)}`;
    return inch(r);
  };
  return (
    <div className="stats-page health-page measurements-page">
      {header}

      <div className="ms-note">
        Inches, unflexed unless it says flexed. Where only one side was measured it's the right side.
        {corrected.length > 0 && (
          <> From {monthYear(corrected[0].date)} on (Myo-body and Oiyaku tapes, which read about 0.3 in high) every value is shown
            0.3 in lower to match a regular ruler; hollow points mark those.</>
        )}
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">Body · from your tape measurements</div>
        <BodyFigure entries={entries} show={inch} delta={deltaInch} longDate={longDate} />
      </div>

      <div className="ms-grid">
        {PARTS.map((p) => (
          <TrendCard key={p.id} title={p.label} note={p.note} color={p.color} entries={entries} get={p.get} left={p.left} show={inch} unit=" in" range={range} />
        ))}
        {RATIOS.map((p) => (
          <TrendCard key={p.id} title={p.label} note={p.note} color={p.color} entries={entries} get={p.get} show={num2} unit="" range={range} />
        ))}
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">
          Blood pressure
          <span className="bs-legend">
            <i className="line" style={{ background: '#f28b82' }} />Systolic
            <i className="line" style={{ background: '#8ab4f8' }} />Diastolic
            <i className="line dashed" style={{ borderColor: '#9aa0a6' }} />Pulse
          </span>
        </div>
        {lastBp ? (
          <>
            <div className="ms-bp-head">
              <span className="ms-bp-big">{lastBp.bp.sys}/{lastBp.bp.dia}</span>
              <span className="ms-bp-cat" style={{ color: lastCat.color }}>{lastCat.label}</span>
              <span className="ms-card-sub">last reading {longDate(lastBp.date)}{lastBp.bp.pulse ? ` · pulse ${lastBp.bp.pulse}` : ''}</span>
            </div>
            <div className="ms-bp-chart"><canvas ref={bpCanvas} /></div>
            <div className="bs-footnote">
              Dashed lines: 120 systolic and 80 diastolic, where the American Heart Association's Normal range ends
              (Elevated 120–129 / under 80, Stage 1 from 130 or 80). Pulse is in beats per minute.
            </div>
          </>
        ) : (
          <div className="hp-empty">No blood pressure readings yet.</div>
        )}
      </div>

      <div className="bs-card">
        <div className="bs-panel-title">Every check-in</div>
        <div className="bs-table-wrap">
          <table className="bs-table ms-matrix">
            <thead>
              <tr>
                <th />
                {entries.map((e) => (
                  <th key={e.date} title={e.notes || ''}>
                    {MONTHS[Number(e.date.slice(5, 7)) - 1]} {Number(e.date.slice(8, 10))}<br />{e.date.slice(0, 4)}
                    {e.tape && <><br /><span className={`ms-tape ${e.offsetIn ? 'warn' : ''}`}>{e.tape}{e.offsetIn ? ` −${Math.abs(e.offsetIn)}` : ''}</span></>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="ms-group">
                <td>Weight (lbs)</td>
                {entries.map((e) => <td key={e.date}>{has(e.weightLbs) ? e.weightLbs : ''}</td>)}
              </tr>
              <tr>
                <td>Blood pressure</td>
                {entries.map((e) => (
                  <td key={e.date} style={e.bp ? { color: bpCategory(e.bp.sys, e.bp.dia).color } : undefined}>
                    {e.bp ? `${e.bp.sys}/${e.bp.dia}` : ''}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Pulse</td>
                {entries.map((e) => <td key={e.date}>{e.bp?.pulse || ''}</td>)}
              </tr>
              {PARTS.map((p, i) => (
                <tr key={p.id} className={i === 0 ? 'ms-group' : ''}>
                  <td><i className="ms-dot" style={{ background: p.color }} />{p.label}</td>
                  {entries.map((e) => <td key={e.date}>{cell(p, e)}</td>)}
                </tr>
              ))}
              {RATIOS.map((p, i) => (
                <tr key={p.id} className={i === 0 ? 'ms-group' : ''}>
                  <td>{p.label}</td>
                  {entries.map((e) => <td key={e.date}>{has(p.get(e)) ? num2(p.get(e)) : ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bs-footnote">
          Right / left where both sides were measured. Blood pressure is colored by AHA category.
          {entries.filter((e) => e.notes).length > 0 && ' Hover a date for how it was measured.'}
        </div>
      </div>
    </div>
  );
}

export default MeasurementsView;
