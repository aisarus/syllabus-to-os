import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { demoProgram } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/app/graph")({
  head: () => ({ meta: [{ title: "גרף ידע · Lamdan AI" }] }),
  component: GraphPage,
});

function GraphPage() {
  const courses = demoProgram.courses;
  // simple radial layout
  const cx = 400, cy = 300, r = 220;
  const nodes = courses.slice(0, 30).map((c, i, arr) => {
    const angle = (i / arr.length) * Math.PI * 2;
    const rr = c.year === 1 ? r * 0.4 : c.year === 2 ? r * 0.7 : r;
    return {
      id: c.id, x: cx + Math.cos(angle) * rr, y: cy + Math.sin(angle) * rr,
      label: c.number, full: c.titleHe, status: c.status, size: c.type === "פרויקט" || c.type === "סמינריון" ? 18 : 12,
    };
  });
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges: [any, any][] = [];
  courses.forEach((c) => c.prerequisites.forEach((p) => {
    if (nodeMap[p] && nodeMap[c.id]) edges.push([nodeMap[p], nodeMap[c.id]]);
  }));

  const color = (s: string) => s === "risky" ? "oklch(0.62 0.22 25)" : s === "studying" ? "oklch(0.72 0.16 290)" : s === "completed" || s === "mastered" ? "oklch(0.72 0.16 155)" : "oklch(0.5 0.02 260)";

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="גרף ידע" subtitle="ויזואליזציה בסגנון Obsidian של קורסים, דרישות קדם ונושאים" />
      <Card className="bg-card border-border overflow-hidden">
        <svg viewBox="0 0 800 600" className="w-full h-[600px] grid-bg">
          <defs>
            <radialGradient id="glow">
              <stop offset="0%" stopColor="oklch(0.72 0.16 290)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="oklch(0.72 0.16 290)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {edges.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="oklch(0.4 0.03 260 / 0.5)" strokeWidth={1} />
          ))}
          {nodes.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={n.size + 8} fill="url(#glow)" />
              <circle cx={n.x} cy={n.y} r={n.size} fill={color(n.status)} stroke="oklch(0.95 0 0 / 0.9)" strokeWidth={1.5} />
              <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize={9} fill="white" fontWeight={700}>{n.label}</text>
              <text x={n.x} y={n.y + n.size + 12} textAnchor="middle" fontSize={9} fill="oklch(0.75 0.02 260)">{n.full.slice(0, 14)}</text>
            </g>
          ))}
        </svg>
      </Card>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {[["primary", "בלמידה"], ["success", "הושלם"], ["destructive", "בסיכון"], ["muted-foreground", "טרם"]].map(([c, l]) => (
          <div key={l as string} className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full bg-${c}`} />{l}</div>
        ))}
      </div>
    </div>
  );
}
