"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateBill } from "@/lib/bill";
import { formatAmount, formatNumber } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { CURRENT_TARIFF } from "@/lib/tariff";
import { groupLimits, priceColor } from "@/lib/tiers";

// The chart is drawn at its container's real width (one SVG unit = one pixel),
// so the labels keep a readable size on a phone as on a desktop.
const START_WIDTH = 640; // before the width is measured (the static build)
const PAD = { left: 48, right: 12, top: 36, bottom: 32 };
const DEFAULT_RANGE = 1200; // kWh shown on the x axis unless the consumption is higher

const total = (kwh: number) => calculateBill(kwh).totalPiasters;

/**
 * The bill (y) for every consumption (x). The line is drawn per group of tiers, so the
 * jumps at the group limits show as vertical drops. Tapping the chart picks a consumption.
 */
export function BillChart({
  kwh,
  lang,
  onPick,
  label,
  units,
}: {
  kwh: number | null;
  lang: Lang;
  onPick: (kwh: number) => void;
  label: string;
  /** The axis units, shown once each instead of after every number. */
  units: { money: string; kwh: string };
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(START_WIDTH);
  const H = Math.min(320, Math.max(240, Math.round(W * 0.55)));

  // Follow the container's width (window resize, phone rotation).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setW(Math.round(entry.contentRect.width));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Grow the x axis only when the consumption is beyond the default range.
  const xMax = kwh !== null && kwh > DEFAULT_RANGE ? Math.ceil((kwh * 1.15) / 100) * 100 : DEFAULT_RANGE;

  const chart = useMemo(() => {
    const maxEgp = total(xMax) / 100;
    const stepEgp = maxEgp > 3000 ? 1000 : 500;
    const yMaxEgp = Math.ceil((maxEgp * 1.08) / stepEgp) * stepEgp;

    const x = (k: number) => PAD.left + (k / xMax) * (W - PAD.left - PAD.right);
    const y = (piasters: number) => H - PAD.bottom - (piasters / (yMaxEgp * 100)) * (H - PAD.top - PAD.bottom);

    // One line per group of tiers, from its first kWh to its last (about one point per pixel at most).
    // 0 kWh is left out: its fixed fee is higher than the bill for 1 kWh.
    const sample = Math.max(1, Math.floor(xMax / W));
    const groups = CURRENT_TARIFF.groups;
    const segments = groups.flatMap((group, i) => {
      const start = i === 0 ? 1 : (groups[i - 1]!.upTo ?? xMax) + 1;
      const end = Math.min(group.upTo ?? xMax, xMax);
      if (start > end) return [];
      const points: number[] = [];
      for (let k = start; k < end; k += sample) points.push(k);
      points.push(end);
      const path = points.map((k, i) => `${i === 0 ? "M" : "L"}${x(k).toFixed(1)},${y(total(k)).toFixed(1)}`).join(" ");
      const topPrice = Math.max(...group.bands.map((b) => b.piasters));
      return [{ path, color: priceColor(topPrice) }];
    });

    const jumps = groupLimits()
      .filter((limit) => limit < xMax)
      .map((limit) => ({
        limit,
        x: x(limit),
        yFrom: y(total(limit)),
        yTo: y(total(limit + 1)),
        jump: total(limit + 1) - total(limit),
      }));

    const yTicks = Array.from({ length: yMaxEgp / stepEgp }, (_, i) => (i + 1) * stepEgp);
    return { x, y, segments, jumps, yTicks };
  }, [xMax, W, H]);

  function pickAt(clientX: number) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const svgX = ((clientX - box.left) / box.width) * W;
    const k = Math.round(((svgX - PAD.left) / (W - PAD.left - PAD.right)) * xMax);
    onPick(Math.min(Math.max(k, 0), xMax));
  }

  const marker = kwh !== null && kwh >= 1 && kwh <= xMax ? { x: chart.x(kwh), y: chart.y(total(kwh)) } : null;

  return (
    // Charts read left to right in Arabic too.
    <div dir="ltr" ref={boxRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="h-auto w-full cursor-crosshair touch-pan-y select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickAt(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pickAt(e.clientX);
        }}
      >
        {/* Horizontal guides with the bill in pounds. */}
        {chart.yTicks.map((egp) => (
          <g key={egp}>
            <line x1={PAD.left} x2={W - PAD.right} y1={chart.y(egp * 100)} y2={chart.y(egp * 100)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 8} y={chart.y(egp * 100) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {formatNumber(egp, lang)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth="1" />
        <text x={PAD.left - 8} y={PAD.top - 16} textAnchor="end" fontSize="12" fill="var(--muted)">
          {units.money}
        </text>
        <text x={W - PAD.right} y={H - PAD.bottom - 8} textAnchor="end" fontSize="12" fill="var(--muted)">
          {units.kwh}
        </text>

        {/* x axis: zero, each jump limit, and the end of the range. */}
        {[0, ...chart.jumps.map((j) => j.limit), xMax].map((k) => (
          <text
            key={k}
            x={chart.x(k)}
            y={H - PAD.bottom + 20}
            // The last label ends at the edge instead of being centred past it.
            textAnchor={k === xMax ? "end" : "middle"}
            fontSize="12"
            fill="var(--muted)"
          >
            {formatNumber(k, lang)}
          </text>
        ))}

        {chart.segments.map((s, i) => (
          <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* The cliffs: a dashed drop and how much one kWh past the limit adds. */}
        {chart.jumps.map((j) => (
          <g key={j.limit}>
            <line x1={j.x} x2={j.x} y1={j.yFrom} y2={j.yTo} stroke="var(--alert)" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={j.x} y={j.yTo - 9} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="var(--alert)">
              +{formatAmount(j.jump, lang)}
            </text>
          </g>
        ))}

        {marker && (
          <g>
            <line x1={marker.x} x2={marker.x} y1={H - PAD.bottom} y2={marker.y} stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={marker.x} cy={marker.y} r="7" fill="var(--ink)" stroke="var(--paper)" strokeWidth="3" />
          </g>
        )}
      </svg>
    </div>
  );
}
