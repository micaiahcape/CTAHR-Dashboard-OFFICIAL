import { useState } from "react";

export default function LineChart({ entries, formatValue, color = "#d94801" }: { entries: [number, number][]; formatValue?: (v: number) => string; color?: string }) {
    const [hovered, setHovered] = useState<number | null>(null);

    if (entries.length < 2) return null;

    const W = 300, H = 90;
    const padL = 4, padR = 4, padT = 8, padB = 22;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxY = Math.max(...entries.map(([, v]) => v), 1);
    const minX = entries[0][0];
    const maxX = entries[entries.length - 1][0];
    const spanX = maxX - minX || 1;

    const toX = (year: number) => padL + ((year - minX) / spanX) * chartW;
    const toY = (val: number) => padT + chartH - (val / maxY) * chartH;

    const pts = entries.map(([yr, v]) => [toX(yr), toY(v)] as [number, number]);
    const bottomY = padT + chartH;

    const areaPath = [
        `M ${pts[0][0]} ${bottomY}`,
        ...pts.map(([x, y]) => `L ${x} ${y}`),
        `L ${pts[pts.length - 1][0]} ${bottomY}`,
        "Z",
    ].join(" ");

    const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");

    const labelIndices = new Set<number>([0, entries.length - 1]);
    if (entries.length > 3) {
        const step = Math.floor(entries.length / 3);
        for (let i = step; i < entries.length - step; i += step) labelIndices.add(i);
    }

    const formatK = (v: number) =>
        formatValue
        ? formatValue(v)
        : v >= 1_000_000
        ? `$${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
        ? `$${(v / 1_000).toFixed(0)}K`
        : `$${v.toFixed(0)}`;

    const tooltip = hovered !== null ? (() => {
        const [cx, cy] = pts[hovered];
        const [year, val] = entries[hovered];
        const label = formatK(val);
        const tipW = 68, tipH = 26, tipR = 3;
        const flipLeft = cx > W / 2;
        const tx = flipLeft ? cx - tipW - 6 : cx + 6;
        const ty = Math.max(padT, cy - tipH / 2);
        return { cx, cy, year, label, tx, ty, tipW, tipH, tipR };
    })() : null;

    return (
        <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        >
        <defs>
            <linearGradient id={`lineAreaGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
            </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#lineAreaGrad-${color.replace("#", "")})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />

        {pts.map(([x, y], i) => (
            <circle
            key={`hit-${i}`}
            cx={x} cy={y} r="8"
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            />
        ))}

        {pts.map(([x, y], i) => (
            <circle
            key={`dot-${i}`}
            cx={x} cy={y}
            r={hovered === i ? 4 : 2.5}
            fill={color}
            style={{ pointerEvents: "none", transition: "r 0.1s" }}
            />
        ))}

        {tooltip && (
            <line
            x1={tooltip.cx} y1={padT}
            x2={tooltip.cx} y2={bottomY}
            stroke={color} strokeWidth="0.8" strokeDasharray="3 2"
            style={{ pointerEvents: "none" }}
            />
        )}

        {tooltip && (
            <g style={{ pointerEvents: "none" }}>
            <rect
                x={tooltip.tx} y={tooltip.ty}
                width={tooltip.tipW} height={tooltip.tipH}
                rx={tooltip.tipR} ry={tooltip.tipR}
                fill="#1a1a1a" stroke={color} strokeWidth="0.8"
            />
            <text x={tooltip.tx + tooltip.tipW / 2} y={tooltip.ty + 10} textAnchor="middle" fontSize="7.5" fill="#888">
                {tooltip.year}
            </text>
            <text x={tooltip.tx + tooltip.tipW / 2} y={tooltip.ty + 20} textAnchor="middle" fontSize="8.5" fontWeight="bold" fill={color}>
                {tooltip.label}
            </text>
            </g>
        )}

        {[...labelIndices].map((i) => (
            <text
            key={entries[i][0]}
            x={toX(entries[i][0])}
            y={H - 5}
            textAnchor="middle"
            fontSize="8"
            fill="#666"
            >
            {entries[i][0]}
            </text>
        ))}
        </svg>
    );
}