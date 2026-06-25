"use client";

/**
 * Security Metrics Dashboard Component
 * 
 * Real-time monitoring dashboard for XDR parser security metrics.
 * Displays attack detection, error rates, and performance statistics.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface SecurityMetrics {
  status: "healthy" | "warning" | "critical";
  attackDetected: boolean;
  timestamp: string;
  metrics: {
    totalParses: number;
    successfulParses: number;
    rejectedParses: number;
    successRate: number;
    rejectionRate: number;
  };
  errors: {
    byType: Record<string, number>;
    total: number;
  };
  performance: {
    maxDepthReached: number;
    maxPayloadSizeSeen: number;
    maxParseTimeSeen: number;
  };
  limits: {
    maxRecursionDepth: number;
    maxPayloadSizeBytes: number;
    maxParseTimeMs: number;
    maxCollectionSize: number;
  };
  recommendations: string[];
}

export function SecurityMetricsDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/security/metrics");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Refresh every 10 seconds
    const interval = setInterval(fetchMetrics, 10000);

    // Cleanup interval on unmount to prevent memory leaks
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading security metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
        <div className="flex items-center gap-2">
          <span className="text-destructive">⚠️</span>
          <span className="text-destructive">Error loading metrics: {error}</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const statusColors = {
    healthy: "bg-green-500",
    warning: "bg-yellow-500",
    critical: "bg-red-500",
  };

  const statusLabels = {
    healthy: "Healthy",
    warning: "Warning",
    critical: "Critical",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Metrics</h2>
          <p className="text-sm text-muted-foreground">
            XDR Parser monitoring and attack detection
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge
            className={`${statusColors[metrics.status]} text-white`}
            variant="default"
          >
            {statusLabels[metrics.status]}
          </Badge>
          
          {metrics.attackDetected && (
            <Badge variant="destructive" className="animate-pulse">
              🚨 Attack Detected
            </Badge>
          )}
          
          <div className="text-xs text-muted-foreground">
            Updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Parses"
          value={metrics.metrics.totalParses.toLocaleString()}
          description="All parsing attempts"
          icon="📊"
        />
        
        <MetricCard
          title="Success Rate"
          value={`${metrics.metrics.successRate.toFixed(1)}%`}
          description={`${metrics.metrics.successfulParses.toLocaleString()} successful`}
          icon="✅"
          status={metrics.metrics.successRate > 95 ? "healthy" : "warning"}
        />
        
        <MetricCard
          title="Rejection Rate"
          value={`${metrics.metrics.rejectionRate.toFixed(1)}%`}
          description={`${metrics.metrics.rejectedParses.toLocaleString()} rejected`}
          icon="🚫"
          status={metrics.metrics.rejectionRate < 5 ? "healthy" : metrics.metrics.rejectionRate < 10 ? "warning" : "critical"}
        />
        
        <MetricCard
          title="Total Errors"
          value={metrics.errors.total.toLocaleString()}
          description="Security violations"
          icon="⚠️"
          status={metrics.errors.total < 10 ? "healthy" : "warning"}
        />
      </div>

      {/* Error Breakdown */}
      {metrics.errors.total > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Error Breakdown</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(metrics.errors.byType).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm font-medium">{formatErrorType(type)}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Performance Metrics</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <PerformanceMetric
            label="Max Depth Reached"
            value={metrics.performance.maxDepthReached}
            limit={metrics.limits.maxRecursionDepth}
            unit="levels"
          />
          
          <PerformanceMetric
            label="Max Payload Size"
            value={metrics.performance.maxPayloadSizeSeen}
            limit={metrics.limits.maxPayloadSizeBytes}
            unit="bytes"
            formatter={(v) => formatBytes(v)}
          />
          
          <PerformanceMetric
            label="Max Parse Time"
            value={metrics.performance.maxParseTimeSeen}
            limit={metrics.limits.maxParseTimeMs}
            unit="ms"
          />
        </div>
      </div>

      {/* Recommendations */}
      {metrics.recommendations.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Recommendations</h3>
          <div className="space-y-2">
            {metrics.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 text-sm ${
                  rec.includes("⚠️") || rec.includes("🚨")
                    ? "bg-destructive/10 text-destructive"
                    : rec.includes("✅")
                    ? "bg-green-500/10 text-green-600"
                    : "bg-muted"
                }`}
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: string;
  status?: "healthy" | "warning" | "critical";
}

function MetricCard({ title, value, description, icon, status }: MetricCardProps) {
  const statusColors = {
    healthy: "border-green-500/50",
    warning: "border-yellow-500/50",
    critical: "border-red-500/50",
  };

  return (
    <div className={`rounded-lg border bg-card p-6 ${status ? statusColors[status] : ""}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

interface PerformanceMetricProps {
  label: string;
  value: number;
  limit: number;
  unit: string;
  formatter?: (value: number) => string;
}

function PerformanceMetric({
  label,
  value,
  limit,
  unit,
  formatter,
}: PerformanceMetricProps) {
  const percentage = (value / limit) * 100;
  const displayValue = formatter ? formatter(value) : value.toLocaleString();
  const displayLimit = formatter ? formatter(limit) : limit.toLocaleString();
  
  let barColor = "bg-green-500";
  if (percentage > 80) {
    barColor = "bg-red-500";
  } else if (percentage > 60) {
    barColor = "bg-yellow-500";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {displayValue} / {displayLimit} {unit}
        </span>
      </div>
      
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <div className="text-xs text-muted-foreground">
        {percentage.toFixed(1)}% of limit
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatErrorType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
