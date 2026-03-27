"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  MOCK_PIPELINE_OUTPUT,
  MOCK_COPILOT_OUTPUT,
  formatDuration,
} from "@/lib/mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const USE_MOCK = true; // Toggle to false when real API is wired

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const TYPE_COLORS: Record<string, string> = {
  automate: "bg-blue-500/10 text-blue-400",
  eliminate: "bg-red-500/10 text-red-400",
  simplify: "bg-green-500/10 text-green-400",
  parallelize: "bg-purple-500/10 text-purple-400",
  reassign: "bg-yellow-500/10 text-yellow-400",
};

export default function ProcessPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<string>("loading");
  const [pipelineOutput, setPipelineOutput] = useState<AnyData | null>(null);
  const [copilotOutput, setCopilotOutput] = useState<AnyData | null>(null);

  useEffect(() => {
    if (USE_MOCK) {
      setPipelineOutput(MOCK_PIPELINE_OUTPUT);
      setCopilotOutput(MOCK_COPILOT_OUTPUT);
      setStatus("complete");
      return;
    }
    fetchStatus();
  }, [id]);

  async function fetchStatus() {
    try {
      const resp = await fetch(`${API_URL}/api/process/${id}`);
      if (resp.status === 202) {
        setStatus("processing");
        return;
      }
      if (resp.status === 404) {
        setStatus("not_found");
        return;
      }
      if (resp.ok) {
        const data = await resp.json();
        setPipelineOutput(data);
        setStatus("pipeline_complete");
        fetchCopilot();
      }
    } catch {
      setStatus("not_found");
    }
  }

  async function fetchCopilot() {
    try {
      const resp = await fetch(`${API_URL}/api/process/${id}/copilot`);
      if (resp.ok) {
        const data = await resp.json();
        setCopilotOutput(data);
        setStatus("complete");
      }
    } catch {
      // Copilot not ready yet
    }
  }

  async function triggerPipeline() {
    setStatus("processing");
    await fetch(`${API_URL}/api/process/${id}/run-pipeline`, { method: "POST" });
    setTimeout(fetchStatus, 2000);
  }

  async function triggerAnalysis() {
    setStatus("analyzing");
    await fetch(`${API_URL}/api/process/${id}/analyze`, { method: "POST" });
    setTimeout(fetchStatus, 2000);
  }

  if (status === "loading") {
    return <p className="text-zinc-500">Loading...</p>;
  }

  if (status === "not_found") {
    return (
      <div className="space-y-4">
        <p className="text-zinc-400">Process {id} not found.</p>
        <Link href="/">
          <Button variant="outline">Back to Upload</Button>
        </Link>
      </div>
    );
  }

  const stats = pipelineOutput?.statistics;
  const maxFreq = Math.max(
    ...(pipelineOutput?.process_steps?.map((s: AnyData) => s.frequency) || [1])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            &larr; Back
          </Link>
          <h2 className="text-xl font-semibold tracking-tight mt-1">
            Process{" "}
            <span className="font-[family-name:var(--font-geist-mono)]">{id}</span>
          </h2>
        </div>
        <Badge variant="secondary">{status}</Badge>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Pipeline Controls */}
      {!pipelineOutput && status !== "processing" && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              File uploaded. Run the pipeline to discover the process.
            </p>
            <Button onClick={triggerPipeline}>Run Pipeline</Button>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Cases", value: stats.total_cases },
            { label: "Events", value: stats.total_events?.toLocaleString() },
            { label: "Process Steps", value: stats.total_process_steps },
            { label: "Variants", value: stats.total_variants },
            { label: "Users", value: stats.total_users },
            { label: "Applications", value: stats.total_applications },
            {
              label: "Avg Duration",
              value: formatDuration(stats.avg_case_duration_seconds || 0),
            },
            {
              label: "Date Range",
              value: `${stats.date_range_start?.slice(5)} — ${stats.date_range_end?.slice(5)}`,
            },
          ].map((item) => (
            <Card key={item.label} className="border-zinc-800 bg-zinc-900">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-zinc-500">{item.label}</p>
                <p className="text-lg font-semibold font-[family-name:var(--font-geist-mono)]">
                  {item.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Process Steps */}
      {pipelineOutput?.process_steps && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base">Process Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pipelineOutput.process_steps
                .sort((a: AnyData, b: AnyData) => b.frequency - a.frequency)
                .map((step: AnyData) => (
                  <div key={step.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{step.name}</span>
                      <span className="font-[family-name:var(--font-geist-mono)] text-zinc-400">
                        {step.frequency}x · {formatDuration(step.avg_duration_seconds)} avg
                        {step.copy_paste_count > 50 && (
                          <span className="text-orange-400 ml-2">
                            ⚠ {step.copy_paste_count} copy-paste
                          </span>
                        )}
                      </span>
                    </div>
                    <Progress
                      value={(step.frequency / maxFreq) * 100}
                      className="h-2"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {step.applications?.map((app: string) => (
                        <span
                          key={app}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottlenecks */}
      {pipelineOutput?.bottlenecks?.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base">Bottlenecks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Transition</TableHead>
                  <TableHead className="text-zinc-400">Avg Wait</TableHead>
                  <TableHead className="text-zinc-400">Max Wait</TableHead>
                  <TableHead className="text-zinc-400">Cases</TableHead>
                  <TableHead className="text-zinc-400">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelineOutput.bottlenecks.map((bn: AnyData, i: number) => (
                  <TableRow key={i} className="border-zinc-800">
                    <TableCell className="font-medium">
                      {bn.from_step} → {bn.to_step}
                    </TableCell>
                    <TableCell className="font-[family-name:var(--font-geist-mono)]">
                      {formatDuration(bn.avg_wait_seconds)}
                    </TableCell>
                    <TableCell className="font-[family-name:var(--font-geist-mono)]">
                      {formatDuration(bn.max_wait_seconds)}
                    </TableCell>
                    <TableCell>{bn.case_count}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[bn.severity]}`}
                      >
                        {bn.severity}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Variants */}
      {pipelineOutput?.variants?.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base">Process Variants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipelineOutput.variants.map((v: AnyData) => (
              <div
                key={v.variant_id}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800"
              >
                <div className="text-right min-w-[60px]">
                  <p className="text-sm font-semibold font-[family-name:var(--font-geist-mono)]">
                    {v.percentage.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {v.case_count} cases
                  </p>
                </div>
                <div className="flex-1">
                  <div className="flex gap-1 flex-wrap items-center">
                    {v.sequence.map((step: string, i: number) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {step}
                        </span>
                        {i < v.sequence.length - 1 && (
                          <span className="text-zinc-600 text-xs">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                  {v.avg_total_duration_seconds && (
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Avg duration: {formatDuration(v.avg_total_duration_seconds)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Copilot Controls */}
      {pipelineOutput && !copilotOutput && status !== "analyzing" && (
        <>
          <Separator className="bg-zinc-800" />
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                Pipeline complete. Run the AI copilot for automation recommendations.
              </p>
              <Button onClick={triggerAnalysis}>Run AI Analysis</Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Copilot Summary */}
      {copilotOutput?.summary && (
        <>
          <Separator className="bg-zinc-800" />
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-base">AI Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {copilotOutput.summary}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recommendations */}
      {copilotOutput?.recommendations?.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base">
              Automation Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {copilotOutput.recommendations.map((rec: AnyData) => (
              <div
                key={rec.id}
                className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[rec.type]}`}
                    >
                      {rec.type}
                    </span>
                    {rec.automation_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                        {rec.automation_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        SEVERITY_COLORS[rec.impact] || SEVERITY_COLORS.medium
                      }`}
                    >
                      {rec.impact} impact
                    </span>
                    <span className="text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)]">
                      P{rec.priority}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-zinc-200">{rec.target}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {rec.reasoning}
                </p>
                <div className="flex gap-4 text-[10px] text-zinc-500 font-[family-name:var(--font-geist-mono)]">
                  {rec.estimated_time_saved_seconds && (
                    <span>
                      Est. saved: {formatDuration(rec.estimated_time_saved_seconds)}
                    </span>
                  )}
                  {rec.affected_cases_percentage && (
                    <span>Affects: {rec.affected_cases_percentage}% of cases</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Decision Rules */}
      {copilotOutput?.decision_rules?.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base">Decision Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Rule</TableHead>
                  <TableHead className="text-zinc-400">Condition</TableHead>
                  <TableHead className="text-zinc-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {copilotOutput.decision_rules.map((rule: AnyData) => (
                  <TableRow key={rule.rule_id} className="border-zinc-800">
                    <TableCell className="font-[family-name:var(--font-geist-mono)] text-xs">
                      {rule.rule_id}
                    </TableCell>
                    <TableCell className="text-xs">{rule.condition}</TableCell>
                    <TableCell className="text-xs">{rule.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* BPMN Placeholder */}
      {copilotOutput?.bpmn_xml && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base">Generated BPMN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
              <p className="text-sm text-zinc-600">
                BPMN diagram renderer (bpmn-js) will be integrated here
              </p>
            </div>
            <Button variant="outline" className="mt-3" size="sm">
              Download BPMN XML
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
