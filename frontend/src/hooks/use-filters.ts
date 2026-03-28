'use client';

import { useState, useMemo } from 'react';
import type { PipelineOutput, BottleneckSeverity } from '@/lib/types';

export interface Filters {
  users: string[];
  severities: BottleneckSeverity[];
  applications: string[];
  search: string;
  minDurationSeconds: number;
  minWaitSeconds: number;
  minVariantCases: number;
}

const INITIAL: Filters = {
  users: [],
  severities: [],
  applications: [],
  search: '',
  minDurationSeconds: 0,
  minWaitSeconds: 0,
  minVariantCases: 0,
};

export function useFilters(pipeline: PipelineOutput) {
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const availableUsers = useMemo(
    () => (pipeline.performer_stats ?? []).map((p) => p.user),
    [pipeline.performer_stats],
  );

  const availableApps = useMemo(
    () =>
      Array.from(new Set(pipeline.activities.flatMap((a) => a.applications))).sort(),
    [pipeline.activities],
  );

  const isActive =
    filters.users.length > 0 ||
    filters.severities.length > 0 ||
    filters.applications.length > 0 ||
    filters.search.length > 0 ||
    filters.minDurationSeconds > 0 ||
    filters.minWaitSeconds > 0 ||
    filters.minVariantCases > 0;

  const filteredActivities = useMemo(() => {
    return pipeline.activities.filter((act) => {
      if (filters.users.length > 0 && !filters.users.some((u) => act.performers.includes(u)))
        return false;
      if (
        filters.applications.length > 0 &&
        !filters.applications.some((app) => act.applications.includes(app))
      )
        return false;
      if (filters.search && !act.name.toLowerCase().includes(filters.search.toLowerCase()))
        return false;
      if (filters.minDurationSeconds > 0 && act.avg_duration_seconds < filters.minDurationSeconds)
        return false;
      return true;
    });
  }, [pipeline.activities, filters]);

  const filteredActivityNames = useMemo(
    () => new Set(filteredActivities.map((a) => a.name)),
    [filteredActivities],
  );

  const filteredBottlenecks = useMemo(() => {
    return pipeline.bottlenecks.filter((bn) => {
      if (filters.severities.length > 0 && !filters.severities.includes(bn.severity)) return false;
      if (filters.minWaitSeconds > 0 && bn.avg_wait_seconds < filters.minWaitSeconds) return false;
      if ((filters.users.length > 0 || filters.applications.length > 0) && filteredActivityNames.size > 0) {
        if (!filteredActivityNames.has(bn.from_activity) && !filteredActivityNames.has(bn.to_activity))
          return false;
      }
      return true;
    });
  }, [pipeline.bottlenecks, filters, filteredActivityNames]);

  const filteredPerformers = useMemo(() => {
    if (!pipeline.performer_stats) return [];
    if (filters.users.length === 0) return pipeline.performer_stats;
    return pipeline.performer_stats.filter((p) => filters.users.includes(p.user));
  }, [pipeline.performer_stats, filters.users]);

  const filteredVariants = useMemo(() => {
    if (!filters.users.length && !filters.applications.length && !filters.search && filters.minVariantCases === 0) {
      return pipeline.variants;
    }
    return pipeline.variants.filter((v) => {
      if (filters.minVariantCases > 0 && v.case_count < filters.minVariantCases) return false;
      if (filteredActivityNames.size > 0 && (filters.users.length > 0 || filters.applications.length > 0)) {
        if (!v.sequence.some((step) => filteredActivityNames.has(step))) return false;
      }
      return true;
    });
  }, [pipeline.variants, filteredActivityNames, filters]);

  function toggleUser(user: string) {
    setFilters((f) => ({
      ...f,
      users: f.users.includes(user) ? f.users.filter((u) => u !== user) : [...f.users, user],
    }));
  }

  function toggleSeverity(sev: BottleneckSeverity) {
    setFilters((f) => ({
      ...f,
      severities: f.severities.includes(sev)
        ? f.severities.filter((s) => s !== sev)
        : [...f.severities, sev],
    }));
  }

  function toggleApplication(app: string) {
    setFilters((f) => ({
      ...f,
      applications: f.applications.includes(app)
        ? f.applications.filter((a) => a !== app)
        : [...f.applications, app],
    }));
  }

  function setSearch(search: string) {
    setFilters((f) => ({ ...f, search }));
  }

  function setMinDuration(minDurationSeconds: number) {
    setFilters((f) => ({ ...f, minDurationSeconds }));
  }

  function setMinWait(minWaitSeconds: number) {
    setFilters((f) => ({ ...f, minWaitSeconds }));
  }

  function setMinVariantCases(minVariantCases: number) {
    setFilters((f) => ({ ...f, minVariantCases }));
  }

  function clearTabFilters(tab: 'overview' | 'bottlenecks' | 'variants') {
    if (tab === 'overview') {
      setFilters((f) => ({ ...f, users: [], applications: [], search: '', minDurationSeconds: 0 }));
    } else if (tab === 'bottlenecks') {
      setFilters((f) => ({ ...f, severities: [], minWaitSeconds: 0, users: [] }));
    } else if (tab === 'variants') {
      setFilters((f) => ({ ...f, users: [], minVariantCases: 0 }));
    }
  }

  function clearFilters() {
    setFilters(INITIAL);
  }

  return {
    filters,
    isActive,
    availableUsers,
    availableApps,
    filteredActivities,
    filteredBottlenecks,
    filteredPerformers,
    filteredVariants,
    toggleUser,
    toggleSeverity,
    toggleApplication,
    setSearch,
    setMinDuration,
    setMinWait,
    setMinVariantCases,
    clearTabFilters,
    clearFilters,
  };
}
