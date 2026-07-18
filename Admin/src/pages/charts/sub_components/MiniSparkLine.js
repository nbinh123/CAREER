export default function MiniSparkline({ data, predicted = null, color = "#22c55e", w = 110, h = 38 }) {
    if (!data || data.length < 2) return null;
    const allVals = predicted != null ? [...data, predicted] : data;
    const yMin = Math.min(...allVals), yMax = Math.max(...allVals), yr = yMax - yMin || 1;
    const total = data.length + (predicted != null ? 1 : 0);
    const toX = i => 3 + (i / (total - 1)) * (w - 6);
    const toY = v => h - 4 - ((v - yMin) / yr) * (h - 10);
    const pts = data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
    const last = { x: toX(data.length - 1), y: toY(data[data.length - 1]) };
    const pred = predicted != null ? { x: toX(data.length), y: toY(predicted) } : null;
    return (
        <svg width={w} height={h} style={{ overflow: "visible", display: "block" }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round" />
            {data.map((v, i) => (
                <circle key={i} cx={toX(i)} cy={toY(v)} r={i === data.length - 1 ? 3 : 1.5}
                    fill={i === data.length - 1 ? color : "white"} stroke={color} strokeWidth={1.2} />
            ))}
            {pred && <>
                <line x1={last.x} y1={last.y} x2={pred.x} y2={pred.y}
                    stroke="#f97316" strokeWidth={1.5} strokeDasharray="3 2" />
                <circle cx={pred.x} cy={pred.y} r={3.5} fill="#f97316" stroke="white" strokeWidth={1} />
            </>}
        </svg>
    );
}