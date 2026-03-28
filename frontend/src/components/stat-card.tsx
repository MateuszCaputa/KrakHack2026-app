import { Tooltip } from './tooltip';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tooltip?: string;
}

export function StatCard({ label, value, sub, tooltip }: StatCardProps) {
  return (
    <div className="card-premium card-shine border rounded-xl px-4 py-3.5">
      <p className="text-[11px] text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 font-medium">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </p>
      <p className="text-2xl font-semibold font-mono text-zinc-50 mt-1 tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
