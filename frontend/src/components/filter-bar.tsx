'use client';

import { useState, useRef, useEffect } from 'react';
import type { Filters } from '@/hooks/use-filters';
import type { BottleneckSeverity } from '@/lib/types';

// ─── Shared primitives ───────────────────────────────────────────────────────

const SEV_STYLE: Record<BottleneckSeverity, { idle: string; active: string; dot: string }> = {
  critical: {
    idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-red-700 hover:text-red-400',
    active: 'border-red-500 bg-red-900/40 text-red-300 shadow-sm shadow-red-900/30',
    dot: 'bg-red-500',
  },
  high: {
    idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-orange-700 hover:text-orange-400',
    active: 'border-orange-500 bg-orange-900/40 text-orange-300 shadow-sm shadow-orange-900/30',
    dot: 'bg-orange-500',
  },
  medium: {
    idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-yellow-700 hover:text-yellow-400',
    active: 'border-yellow-500 bg-yellow-900/40 text-yellow-300 shadow-sm shadow-yellow-900/30',
    dot: 'bg-yellow-500',
  },
  low: {
    idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300',
    active: 'border-zinc-400 bg-zinc-700 text-zinc-200 shadow-sm',
    dot: 'bg-zinc-400',
  },
};

function SeverityToggle({
  sev,
  active,
  onToggle,
}: {
  sev: BottleneckSeverity;
  active: boolean;
  onToggle: () => void;
}) {
  const s = SEV_STYLE[sev];
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border capitalize transition-all ${
        active ? s.active : s.idle
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? s.dot : 'bg-zinc-600'}`} />
      {sev}
    </button>
  );
}

function PresetChips({
  label,
  presets,
  value,
  onChange,
}: {
  label: string;
  presets: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
      <div className="flex gap-1">
        {presets.map((p) => {
          const active = value === p.value;
          return (
            <button
              key={p.value}
              onClick={() => onChange(active ? 0 : p.value)}
              aria-pressed={active}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                active
                  ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UserDropdown({
  users,
  selected,
  onToggle,
}: {
  users: string[];
  selected: string[];
  onToggle: (u: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const labels = Object.fromEntries(users.map((u, i) => [u, `User ${String.fromCharCode(65 + i)}`]));
  const count = selected.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
          count > 0
            ? 'border-blue-500 bg-blue-900/30 text-blue-300'
            : 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="5.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M1.5 9.5c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Users
        {count > 0 ? (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-[9px] font-bold text-white leading-none">
            {count}
          </span>
        ) : (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && users.length > 0 && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 min-w-[180px] overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Filter by user</p>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {users.map((u) => {
              const checked = selected.includes(u);
              return (
                <label
                  key={u}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer transition-colors ${
                    checked ? 'bg-blue-900/20 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center transition-all ${
                      checked ? 'bg-blue-600 border-blue-600' : 'border-zinc-600 bg-transparent'
                    }`}
                  >
                    {checked && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <input type="checkbox" checked={checked} onChange={() => onToggle(u)} className="sr-only" />
                  <span className="truncate">{labels[u] ?? u.slice(0, 8) + '…'}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AppDropdown({
  apps,
  selected,
  onToggle,
}: {
  apps: string[];
  selected: string[];
  onToggle: (a: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const count = selected.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
          count > 0
            ? 'border-blue-500 bg-blue-900/30 text-blue-300'
            : 'border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <rect x="1.5" y="1.5" width="3.5" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="6" y="1.5" width="3.5" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="1.5" y="6" width="3.5" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="6" y="6" width="3.5" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        Apps
        {count > 0 ? (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-[9px] font-bold text-white leading-none">
            {count}
          </span>
        ) : (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && apps.length > 0 && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 min-w-[200px] overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Filter by application</p>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {apps.map((app) => {
              const checked = selected.includes(app);
              return (
                <label
                  key={app}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer transition-colors ${
                    checked ? 'bg-blue-900/20 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center transition-all ${
                      checked ? 'bg-blue-600 border-blue-600' : 'border-zinc-600 bg-transparent'
                    }`}
                  >
                    {checked && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <input type="checkbox" checked={checked} onChange={() => onToggle(app)} className="sr-only" />
                  <span className="truncate max-w-[160px]">{app}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ClearButton({ onClear, count }: { onClear: () => void; count: number }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md border border-transparent hover:border-zinc-700 transition-all"
      aria-label="Clear filters"
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      Clear{count > 1 ? ` (${count})` : ''}
    </button>
  );
}

function ActiveUserPills({
  users,
  selected,
  onToggle,
}: {
  users: string[];
  selected: string[];
  onToggle: (u: string) => void;
}) {
  if (selected.length === 0) return null;
  const labels = Object.fromEntries(users.map((u, i) => [u, `User ${String.fromCharCode(65 + i)}`]));
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {selected.map((u) => (
        <span
          key={u}
          className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 text-[11px] bg-blue-900/30 border border-blue-700/60 text-blue-300 rounded-full"
        >
          {labels[u] ?? u.slice(0, 8) + '…'}
          <button
            onClick={() => onToggle(u)}
            className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-blue-600 transition-colors"
            aria-label={`Remove ${labels[u] ?? u}`}
          >
            <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
              <path d="M1 1L5 5M5 1L1 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Duration / wait presets ─────────────────────────────────────────────────

const DURATION_PRESETS = [
  { label: '>30s', value: 30 },
  { label: '>5m', value: 300 },
  { label: '>30m', value: 1800 },
];

const WAIT_PRESETS = [
  { label: '>30s', value: 30 },
  { label: '>2m', value: 120 },
  { label: '>10m', value: 600 },
];

const CASE_PRESETS = [
  { label: '>5', value: 5 },
  { label: '>10', value: 10 },
  { label: '>25', value: 25 },
];

// ─── Tab-specific filter bars ─────────────────────────────────────────────────

interface BaseProps {
  filters: Filters;
  availableUsers: string[];
  availableApps: string[];
  onToggleUser: (u: string) => void;
  onToggleSeverity: (s: BottleneckSeverity) => void;
  onToggleApplication: (a: string) => void;
  onSetSearch: (s: string) => void;
  onSetMinDuration: (n: number) => void;
  onSetMinWait: (n: number) => void;
  onSetMinVariantCases: (n: number) => void;
  onClear: () => void;
}

function FilterShell({ isActive, count, children, onClear }: { isActive: boolean; count: number; children: React.ReactNode; onClear: () => void }) {
  return (
    <div className={`rounded-xl border px-4 py-3 transition-colors ${isActive ? 'border-zinc-700 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900/40'}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest select-none mr-1">
          Filter
        </span>
        {children}
        {isActive && <ClearButton onClear={onClear} count={count} />}
      </div>
    </div>
  );
}

export function OverviewFilterBar({
  filters,
  availableUsers,
  availableApps,
  onToggleUser,
  onToggleApplication,
  onSetSearch,
  onSetMinDuration,
  onClear,
}: Omit<BaseProps, 'onToggleSeverity' | 'onSetMinWait' | 'onSetMinVariantCases'>) {
  const count =
    filters.users.length + filters.applications.length +
    (filters.search ? 1 : 0) + (filters.minDurationSeconds > 0 ? 1 : 0);
  const isActive = count > 0;

  return (
    <div className="space-y-1.5">
      <FilterShell isActive={isActive} count={count} onClear={onClear}>
        {/* Search */}
        <div className="relative">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            <circle cx="4.5" cy="4.5" r="3" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 7L9.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search activities…"
            value={filters.search}
            onChange={(e) => onSetSearch(e.target.value)}
            className="pl-7 pr-3 py-1 text-[11px] bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-40 transition-colors"
          />
        </div>

        {/* Divider */}
        <span className="w-px h-4 bg-zinc-700 self-center" />

        {availableUsers.length > 0 && (
          <UserDropdown users={availableUsers} selected={filters.users} onToggle={onToggleUser} />
        )}
        {availableApps.length > 0 && (
          <AppDropdown apps={availableApps} selected={filters.applications} onToggle={onToggleApplication} />
        )}

        <span className="w-px h-4 bg-zinc-700 self-center" />

        <PresetChips
          label="Avg duration"
          presets={DURATION_PRESETS}
          value={filters.minDurationSeconds}
          onChange={onSetMinDuration}
        />
      </FilterShell>

      <ActiveUserPills users={availableUsers} selected={filters.users} onToggle={onToggleUser} />
    </div>
  );
}

export function BottleneckFilterBar({
  filters,
  availableUsers,
  onToggleUser,
  onToggleSeverity,
  onSetMinWait,
  onClear,
}: Omit<BaseProps, 'availableApps' | 'onToggleApplication' | 'onSetSearch' | 'onSetMinDuration' | 'onSetMinVariantCases'>) {
  const count =
    filters.severities.length + filters.users.length + (filters.minWaitSeconds > 0 ? 1 : 0);
  const isActive = count > 0;

  return (
    <div className="space-y-1.5">
      <FilterShell isActive={isActive} count={count} onClear={onClear}>
        {/* Severity */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide whitespace-nowrap">
            Severity
          </span>
          <div className="flex gap-1">
            {(['critical', 'high', 'medium', 'low'] as BottleneckSeverity[]).map((sev) => (
              <SeverityToggle
                key={sev}
                sev={sev}
                active={filters.severities.includes(sev)}
                onToggle={() => onToggleSeverity(sev)}
              />
            ))}
          </div>
        </div>

        <span className="w-px h-4 bg-zinc-700 self-center" />

        <PresetChips
          label="Min wait"
          presets={WAIT_PRESETS}
          value={filters.minWaitSeconds}
          onChange={onSetMinWait}
        />

        {availableUsers.length > 0 && (
          <>
            <span className="w-px h-4 bg-zinc-700 self-center" />
            <UserDropdown users={availableUsers} selected={filters.users} onToggle={onToggleUser} />
          </>
        )}
      </FilterShell>

      <ActiveUserPills users={availableUsers} selected={filters.users} onToggle={onToggleUser} />
    </div>
  );
}

export function VariantFilterBar({
  filters,
  availableUsers,
  onToggleUser,
  onSetMinVariantCases,
  onClear,
}: Omit<BaseProps, 'availableApps' | 'onToggleApplication' | 'onSetSearch' | 'onSetMinDuration' | 'onToggleSeverity' | 'onSetMinWait'>) {
  const count = filters.users.length + (filters.minVariantCases > 0 ? 1 : 0);
  const isActive = count > 0;

  return (
    <div className="space-y-1.5">
      <FilterShell isActive={isActive} count={count} onClear={onClear}>
        {availableUsers.length > 0 && (
          <UserDropdown users={availableUsers} selected={filters.users} onToggle={onToggleUser} />
        )}

        {availableUsers.length > 0 && <span className="w-px h-4 bg-zinc-700 self-center" />}

        <PresetChips
          label="Min cases"
          presets={CASE_PRESETS}
          value={filters.minVariantCases}
          onChange={onSetMinVariantCases}
        />
      </FilterShell>

      <ActiveUserPills users={availableUsers} selected={filters.users} onToggle={onToggleUser} />
    </div>
  );
}
