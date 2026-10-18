// Chart plumbing shared by the Body Stats and Watch pages.
import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';

/**
 * Create the chart once, then update it in place when deps change. A canvas
 * that was unmounted and rendered again (empty range, then data) gets a
 * fresh chart instead of updating the detached one.
 */
export function useChart(canvasRef, build, deps) {
  const inst = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const config = build();
    if (!config) return;
    if (inst.current && inst.current.canvas === canvasRef.current) {
      // Plugins are fixed at creation (Chart.js v4); they read their inputs from
      // options.plugins.<id>, which is what changes here.
      inst.current.data = config.data;
      inst.current.options = config.options;
      inst.current.update();
    } else {
      inst.current?.destroy();
      inst.current = new Chart(canvasRef.current.getContext('2d'), config);
    }
  }, deps);
  useEffect(() => () => { inst.current?.destroy(); inst.current = null; }, []);
}

// Chart plugins: fixed objects that read their inputs from options.plugins.<id>.

/** Soft column behind the selected category. options: { idx } */
export const selectPlugin = {
  id: 'selected',
  beforeDatasetsDraw(chart, _args, opts) {
    const idx = opts.idx ?? -1;
    const n = chart.data.labels?.length || 0;
    if (idx < 0 || idx >= n) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(idx);
    const w = n > 1
      ? Math.abs(scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0))
      : chartArea.right - chartArea.left;
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.clip();
    ctx.fillStyle = 'rgba(138,180,248,0.12)';
    ctx.fillRect(x - w / 2, chartArea.top, w, chartArea.bottom - chartArea.top);
    ctx.restore();
  },
};

/** Shaded value bands, labelled in the right padding. options: { bands: [{ lo, hi, label, color }], axis } */
export const bandsPlugin = {
  id: 'bands',
  beforeDatasetsDraw(chart, _args, opts) {
    const bands = opts.bands || [];
    const { ctx, chartArea, scales } = chart;
    const axis = scales[opts.axis || 'y'];
    if (!axis) return;
    ctx.save();
    for (const b of bands) {
      const top = axis.getPixelForValue(Math.min(b.hi, axis.max));
      const bottom = axis.getPixelForValue(Math.max(b.lo, axis.min));
      if (bottom <= top) continue;
      ctx.fillStyle = b.color + '14';
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
      ctx.fillStyle = b.color + 'cc';
      ctx.font = '600 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(b.label, chartArea.right + 8, (top + bottom) / 2 + 3);
    }
    ctx.restore();
  },
};

export const tooltipBase = { backgroundColor: 'rgba(0,0,0,0.92)', titleColor: '#fff', bodyColor: '#e8eaed', footerColor: '#C58AF9' };

/** Tiny trend line for a KPI card; `index` gets a white dot. */
export function Sparkline({ values, index, color }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v !== null && p.v !== undefined);
  if (pts.length < 2) return <div className="bs-spark" />;
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const X = (i) => (values.length === 1 ? 50 : (i / (values.length - 1)) * 100);
  const Y = (v) => (hi === lo ? 13 : 23 - ((v - lo) / (hi - lo)) * 20);
  const cur = pts.find((p) => p.i === index);
  return (
    <svg className="bs-spark" viewBox="0 0 100 26" preserveAspectRatio="none">
      <polyline points={pts.map((p) => `${X(p.i)},${Y(p.v)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {cur && <circle cx={X(cur.i)} cy={Y(cur.v)} r="2.6" fill="#fff" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
