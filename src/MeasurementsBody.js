// MeasurementsBody.js - a front-view figure whose proportions come from one
// check-in's tape measurements, with a dashed outline of another check-in on
// top so growth and shrinkage show at a glance, and a callout per measure.
import React, { useMemo, useState } from 'react';

// #region Geometry
// Front-view width from a circumference. Torso sections are wider than deep,
// limbs roughly round; the divisors are eyeballed from typical male proportions.
const WIDTH = { shoulder: 2.75, chest: 3.0, stomach: 3.1, hips: 2.85, thigh: 3.4, calf: Math.PI, bicep: Math.PI, forearm: Math.PI, wrist: Math.PI };
const DEFAULTS = { shoulder: 47, chest: 40, stomach: 34, hips: 39, thigh: 23, calf: 15.5, bicep: 13, forearm: 11.5, wrist: 7 };
// Where each tape goes, top to bottom (inches below the top of the head)
const Y = { shoulder: 14.6, chest: 17.6, bicep: 19, waist: 23.5, stomach: 26.5, forearm: 28.5, hips: 32.5, wrist: 34.6, thigh: 40, calf: 56 };

/** Closed Catmull-Rom spline through points -> smooth SVG path. */
function smoothPath(pts) {
  const n = pts.length;
  const p = (i) => pts[(i + n) % n];
  let d = `M${p(0)[0].toFixed(2)},${p(0)[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Half-widths from circumferences -> torso, arm and band geometry. Person's right side is x < 0 (front view). */
function figure(m) {
  const half = (k) => m[k] / WIDTH[k] / 2;
  const sh = half('shoulder'), ch = half('chest'), st = half('stomach'), hp = half('hips');
  const th = half('thigh'), ca = half('calf'), bi = half('bicep'), fo = half('forearm'), wr = half('wrist');
  const legX = hp * 0.55;
  const ribs = (ch + st) / 2 + 0.15;

  // Right half of torso + leg, top to bottom and back up the inside of the leg
  const side = [
    [2.4, 9.6], [2.7, 11.1], [sh - 1.6, 12.2], [sh, 13.4], [sh - 0.5, 15], [ch + 0.25, 16.2],
    [ch, Y.chest + 0.4], [ribs, 21.8], [st, Y.stomach], [hp - 0.15, 30.4], [hp, Y.hips], [legX + th, Y.thigh],
    [legX + 2.25, 49.5], [legX + ca, Y.calf], [legX + 1.25, 65.5], [legX + 1.9, 69.3], [legX - 1.05, 69.6],
    [legX - 1.05, 65.5], [legX - ca * 0.8, Y.calf], [legX - 1.85, 49.5], [legX - th, Y.thigh], [0.25, 36.6],
  ];
  const mirror = ([x, y]) => [-x, y];
  const torso = smoothPath([...side, ...side.slice().reverse().map(mirror)]);

  // Arm: centre line angles out a little from the shoulder; widths from the tapes
  const arm = (s) => {
    const cx = (y) => s * (sh + 0.15 + (y - 14) * 0.085);
    const o = (y, w) => [cx(y) + s * w, y];
    const i = (y, w) => [cx(y) - s * w, y];
    const pts = [
      [s * (sh - 0.9), 12.3], o(14.2, bi + 0.55), o(Y.bicep, bi), o(24.8, 1.5), o(Y.forearm, fo), o(Y.wrist, wr),
      o(37.3, 1.45), [cx(40.2), 40.2], i(37.3, 1.25), i(Y.wrist, wr), i(Y.forearm, fo * 0.92), i(24.8, 1.35),
      i(Y.bicep, bi * 0.95), [s * (sh - 1.5), 15.6],
    ];
    return { d: smoothPath(s > 0 ? pts : pts.slice().reverse()), cx };
  };
  const armR = arm(-1), armL = arm(1);
  const delts = -armR.cx(Y.shoulder) + bi + 0.5; // outer edge of the deltoids

  // Tape lines across the measured spot ([x1, x2, y]); right limbs (x < 0) were the ones measured
  const bands = {
    shoulder: [-delts, delts, Y.shoulder],
    chest: [-ch, ch, Y.chest],
    waist: [-(ch + st) / 2, (ch + st) / 2, Y.waist],
    stomach: [-st, st, Y.stomach],
    hips: [-hp, hp, Y.hips],
    thigh: [-legX - th, -legX + th, Y.thigh],
    calf: [-legX - ca, -legX + ca * 0.8, Y.calf],
    bicep: [armR.cx(Y.bicep) - bi, armR.cx(Y.bicep) + bi * 0.95, Y.bicep],
    forearm: [armR.cx(Y.forearm) - fo, armR.cx(Y.forearm) + fo * 0.92, Y.forearm],
    wrist: [armR.cx(Y.wrist) - wr, armR.cx(Y.wrist) + wr, Y.wrist],
  };
  return { torso, armR: armR.d, armL: armL.d, bands };
}
// #endregion

// #region Values
const KEYS = { shoulder: 'shoulder', chest: 'chest', waist: 'waist', stomach: 'stomach', hips: 'hips', bicep: 'bicepR', forearm: 'forearmR', wrist: 'wristR', thigh: 'thighR', calf: 'calfR' };
const LABELS = { shoulder: 'Shoulders', chest: 'Chest', waist: 'Waist', stomach: 'Stomach', hips: 'Hips', bicep: 'Biceps', forearm: 'Forearm', wrist: 'Wrist', thigh: 'Thigh', calf: 'Calf' };
// Same colors as the workout chart's muscle groups (Delts, Chest, Arms, Upper / Lower Legs); core uses Calisthenics
const COLORS = { shoulder: '#ffad3f', chest: '#f44336', waist: '#b4a4da', stomach: '#b4a4da', hips: '#b4a4da', bicep: '#93c47d', forearm: '#93c47d', wrist: '#93c47d', thigh: '#6d9eeb', calf: '#cadcfd' };
// Torso callouts sit on the figure's left (viewer's right); the measured right limbs on the other side
const RIGHT_COLUMN = ['shoulder', 'chest', 'waist', 'stomach', 'hips'];
const LEFT_COLUMN = ['bicep', 'forearm', 'wrist', 'thigh', 'calf'];
const SHRINK_IS_GOOD = new Set(['waist', 'stomach', 'hips']);
const lbs = (d) => (Math.abs(d) < 0.05 ? '±0' : (d > 0 ? '+' : '−') + Math.abs(Math.round(d * 10) / 10));

/** Measure value for shape: this check-in's, else the nearest check-in that has it, else a default. */
function shapeValue(entries, idx, part) {
  const key = KEYS[part];
  const here = entries[idx]?.in?.[key];
  if (here) return here;
  const t = Date.parse(entries[idx].date);
  let best = null;
  for (const e of entries) {
    const v = e.in?.[key];
    if (!v) continue;
    const dt = Math.abs(Date.parse(e.date) - t);
    if (!best || dt < best.dt) best = { v, dt };
  }
  return best ? best.v : DEFAULTS[part] ?? 10;
}
const shapeOf = (entries, idx) => Object.fromEntries(Object.keys(WIDTH).map((p) => [p, shapeValue(entries, idx, p)]));
// #endregion

/** Spread label rows so two callouts never overlap. */
function spread(items, gap) {
  const out = items.map((it) => ({ ...it }));
  for (let i = 1; i < out.length; i++) if (out[i].ly - out[i - 1].ly < gap) out[i].ly = out[i - 1].ly + gap;
  return out;
}

export default function BodyFigure({ entries, show, delta, longDate }) {
  const [pick, setPick] = useState(null); // index of the check-in shown; null = latest
  const [cmpPick, setCmpPick] = useState(null); // index compared with; null = the one before, -1 = none
  const idx = pick ?? entries.length - 1;
  const cmpIdx = cmpPick === null ? idx - 1 : cmpPick;
  const cur = entries[idx], cmp = cmpIdx >= 0 ? entries[cmpIdx] : null;

  const fig = useMemo(() => figure(shapeOf(entries, idx)), [entries, idx]);
  const ghost = useMemo(() => (cmp ? figure(shapeOf(entries, cmpIdx)) : null), [entries, cmpIdx, cmp]);

  const callout = (part, side) => {
    const v = cur.in?.[KEYS[part]];
    if (part === 'waist' && v === undefined) return null; // only measured in 2019
    const was = cmp?.in?.[KEYS[part]];
    const d = v !== undefined && was !== undefined ? v - was : null;
    const good = d === null || Math.abs(d) < 1e-9 ? null : SHRINK_IS_GOOD.has(part) ? d < 0 : d > 0;
    const [x1, x2, y] = fig.bands[part];
    return { part, v, d, good, y, ly: y, ax: side < 0 ? x1 : x2, side };
  };
  const right = spread(RIGHT_COLUMN.map((p) => callout(p, 1)).filter(Boolean), 5.6);
  const left = spread(LEFT_COLUMN.map((p) => callout(p, -1)).filter(Boolean), 5.6);
  const flexed = cur.in?.bicepFlexedR;

  const LX = 34, LINE = 18.5;
  const label = (c) => {
    const x = c.side < 0 ? -LX : LX;
    const anchor = c.side < 0 ? 'start' : 'end';
    const deltaColor = c.good === null ? '#9aa0a6' : c.good ? '#81c995' : '#f28b82';
    return (
      <g key={c.part} className="mb-callout">
        <polyline
          points={`${c.ax},${c.y} ${c.side * LINE},${c.ly} ${c.side * (LINE + 1.2)},${c.ly}`}
          fill="none" stroke={COLORS[c.part]} strokeOpacity="0.55" strokeWidth="0.18"
        />
        <circle cx={c.ax} cy={c.y} r="0.42" fill={COLORS[c.part]} />
        <text x={x} y={c.ly - 0.9} textAnchor={anchor} className="mb-name" fill={COLORS[c.part]}>{LABELS[c.part].toUpperCase()}</text>
        <text x={x} y={c.ly + 1.9} textAnchor={anchor} className="mb-value">
          {c.v === undefined ? '—' : show(c.v)}
          <tspan className="mb-unit">{c.v === undefined ? '' : ' in'}</tspan>
          {c.d !== null && <tspan className="mb-delta" fill={deltaColor}>{` ${delta(c.d)}`}</tspan>}
        </text>
        {c.part === 'bicep' && flexed && (
          <text x={x} y={c.ly + 4.1} textAnchor={anchor} className="mb-sub">flexed {show(flexed)}</text>
        )}
      </g>
    );
  };

  return (
    <div className="mb-wrap">
      <div className="mb-controls">
        <label>Showing</label>
        <select value={idx} onChange={(e) => setPick(Number(e.target.value))}>
          {entries.map((e, i) => <option key={e.date} value={i}>{longDate(e.date)}</option>).reverse()}
        </select>
        <label>vs</label>
        <select value={cmpIdx} onChange={(e) => setCmpPick(Number(e.target.value))}>
          <option value={-1}>nothing</option>
          {entries.map((e, i) => (i === idx ? null : <option key={e.date} value={i}>{longDate(e.date)}</option>)).reverse()}
        </select>
        {cur.weightLbs && <span className="mb-weight">{cur.weightLbs} lbs{cmp?.weightLbs ? ` (${lbs(cur.weightLbs - cmp.weightLbs)})` : ''}</span>}
      </div>

      <svg className="mb-svg" viewBox="-36 -1 72 72" role="img" aria-label={`Body measurements on ${longDate(cur.date)}`}>
        <defs>
          <linearGradient id="mbSkin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b4168" />
            <stop offset="55%" stopColor="#3a3354" />
            <stop offset="100%" stopColor="#2d2942" />
          </linearGradient>
          <radialGradient id="mbGlow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#C58AF9" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#C58AF9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="0" cy="30" rx="20" ry="34" fill="url(#mbGlow)" />
        {ghost && (
          <g className="mb-ghost-fill">
            <path d={ghost.armR} />
            <path d={ghost.armL} />
            <path d={ghost.torso} />
          </g>
        )}
        <g className="mb-body">
          <circle cx="0" cy="5" r="4.2" />
          <path d={fig.armR} />
          <path d={fig.armL} />
          <path d={fig.torso} />
        </g>
        {ghost && (
          <g className="mb-ghost">
            <path d={ghost.armR} />
            <path d={ghost.armL} />
            <path d={ghost.torso} />
          </g>
        )}
        <g className="mb-bands">
          {Object.entries(fig.bands).map(([part, [x1, x2, y]]) => (part === 'waist' && cur.in?.waist === undefined ? null : (
            <line key={part} x1={x1} x2={x2} y1={y} y2={y} stroke={COLORS[part]} />
          )))}
        </g>
        {right.map(label)}
        {left.map(label)}
      </svg>

      <div className="mb-legend">
        <span><i className="mb-swatch" />{longDate(cur.date)}</span>
        {cmp && <span><i className="mb-swatch ghost" />{longDate(cmp.date)}</span>}
        <span className="mb-hint">Drawn from your tape numbers, so it widens and narrows with them. Stylized, not to scale. Limbs are your right side.</span>
      </div>
    </div>
  );
}
