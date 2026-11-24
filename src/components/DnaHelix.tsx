// Pure server-rendered SVG double helix. The helix is periodic, so sliding it by exactly
// one period gives a seamless, GPU-cheap "rotating" loop with zero JS.
const P = 220; // vertical period
const A = 92; // amplitude
const CX = 160;
const PERIODS = 4;
const H = P * PERIODS;
const STEP = 8;

function strandPath(phase: number) {
  const pts: string[] = [];
  for (let y = -P; y <= H + P; y += STEP) {
    const x = CX + A * Math.sin((2 * Math.PI * y) / P + phase);
    pts.push(`${pts.length ? "L" : "M"}${x.toFixed(1)} ${y}`);
  }
  return pts.join(" ");
}

export default function DnaHelix() {
  const rungs: { y: number; x1: number; x2: number; z: number }[] = [];
  for (let y = -P; y <= H + P; y += 22) {
    const s = Math.sin((2 * Math.PI * y) / P);
    rungs.push({ y, x1: CX + A * s, x2: CX - A * s, z: Math.cos((2 * Math.PI * y) / P) });
  }
  const a = strandPath(0);
  const b = strandPath(Math.PI);

  return (
    <svg
      viewBox={`0 ${P} 320 ${P * 2.2}`}
      role="img"
      aria-label="Double helix DNA illustration"
      className="helix-svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="hx-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#72EAF0" />
          <stop offset="1" stopColor="#087F8C" />
        </linearGradient>
        <linearGradient id="hx-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#43DDE5" />
          <stop offset="1" stopColor="#0B4F63" />
        </linearGradient>
        <linearGradient id="hx-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.82" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="hx-mask" maskUnits="userSpaceOnUse" x="0" y={P} width="320" height={P * 2.2}>
          <rect x="0" y={P} width="320" height={P * 2.2} fill="url(#hx-fade)" />
        </mask>
        <filter id="hx-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <g mask="url(#hx-mask)">
        <g className="helix-flow">
          {/* back strand + back rungs */}
          <path d={b} fill="none" stroke="url(#hx-b)" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
          {rungs.map((r, i) => (
            <line
              key={`r${i}`}
              x1={r.x1}
              y1={r.y}
              x2={r.x2}
              y2={r.y}
              stroke="#72EAF0"
              strokeWidth="1.6"
              opacity={0.15 + 0.35 * Math.abs(1 - Math.abs(r.z)) }
            />
          ))}
          {rungs.map((r, i) => (
            <g key={`n${i}`}>
              <circle cx={r.x1} cy={r.y} r={4.5 + 2.5 * (r.z > 0 ? r.z : 0)} fill="#43DDE5" opacity={0.35 + 0.6 * (r.z > 0 ? r.z : 0)} />
              <circle cx={r.x2} cy={r.y} r={4.5 + 2.5 * (r.z < 0 ? -r.z : 0)} fill="#72EAF0" opacity={0.35 + 0.6 * (r.z < 0 ? -r.z : 0)} />
            </g>
          ))}
          {/* front strand */}
          <path d={a} fill="none" stroke="url(#hx-a)" strokeWidth="9" strokeLinecap="round" />
          <path d={a} fill="none" stroke="#72EAF0" strokeWidth="2" strokeLinecap="round" opacity="0.7" filter="url(#hx-soft)" />
        </g>
      </g>
    </svg>
  );
}
