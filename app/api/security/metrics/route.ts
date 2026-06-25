/**
 * Security Metrics API
 * GET /api/security/metrics
 * 
 * Returns real-time security metrics for XDR parser monitoring.
 * Used by monitoring dashboards, alerting systems, and health checks.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSecurityMetrics,
  detectAttackPattern,
  MAX_RECURSION_DEPTH,
  MAX_PAYLOAD_SIZE_BYTES,
  MAX_PARSE_TIME_MS,
  MAX_COLLECTION_SIZE,
} from "@/lib/translator/parser-security";

export async function GET(request: NextRequest) {
  try {
    const metrics = getSecurityMetrics();
    const attackDetected = detectAttackPattern();
    
    // Calculate derived metrics
    const rejectionRate = metrics.totalParses > 0
      ? (metrics.rejectedParses / metrics.totalParses) * 100
      : 0;
    
    const successRate = metrics.totalParses > 0
      ? (metrics.successfulParses / metrics.totalParses) * 100
      : 0;
    
    // Determine health status
    let status: "healthy" | "warning" | "critical" = "healthy";
    
    if (attackDetected) {
      status = "critical";
    } else if (rejectionRate > 5) {
      status = "warning";
    }
    
    const response = {
      status,
      attackDetected,
      timestamp: new Date().toISOString(),
      
      // Core metrics
      metrics: {
        totalParses: metrics.totalParses,
        successfulParses: metrics.successfulParses,
        rejectedParses: metrics.rejectedParses,
        successRate: Math.round(successRate * 100) / 100,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
      },
      
      // Error breakdown
      errors: {
        byType: metrics.errorsByType,
        total: Object.values(metrics.errorsByType).reduce((a, b) => a + b, 0),
      },
      
      // Performance metrics
      performance: {
        maxDepthReached: metrics.maxDepthReached,
        maxPayloadSizeSeen: metrics.maxPayloadSizeSeen,
        maxParseTimeSeen: metrics.maxParseTimeSeen,
      },
      
      // Configuration limits
      limits: {
        maxRecursionDepth: MAX_RECURSION_DEPTH,
        maxPayloadSizeBytes: MAX_PAYLOAD_SIZE_BYTES,
        maxParseTimeMs: MAX_PARSE_TIME_MS,
        maxCollectionSize: MAX_COLLECTION_SIZE,
      },
      
      // Recommendations
      recommendations: generateRecommendations(metrics, attackDetected),
    };
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
    
  } catch (error) {
    console.error("[security-metrics] Error:", error);
    
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Generates actionable recommendations based on metrics.
 */
function generateRecommendations(
  metrics: ReturnType<typeof getSecurityMetrics>,
  attackDetected: boolean
): string[] {
  const recommendations: string[] = [];
  
  // Attack detection
  if (attackDetected) {
    recommendations.push(
      "⚠️ ATTACK PATTERN DETECTED - Review logs immediately and consider rate limiting"
    );
  }
  
  // High rejection rate
  const rejectionRate = metrics.totalParses > 0
    ? (metrics.rejectedParses / metrics.totalParses) * 100
    : 0;
  
  if (rejectionRate > 10) {
    recommendations.push(
      `High rejection rate (${rejectionRate.toFixed(1)}%) - Investigate sources of malformed payloads`
    );
  }
  
  // Depth errors
  const depthErrors = metrics.errorsByType["MAX_DEPTH_EXCEEDED"] ?? 0;
  if (depthErrors > 10) {
    recommendations.push(
      `Frequent depth errors (${depthErrors}) - Possible deep nesting attack or legitimate deeply nested contracts`
    );
  }
  
  // Size errors
  const sizeErrors = metrics.errorsByType["MAX_PAYLOAD_SIZE_EXCEEDED"] ?? 0;
  if (sizeErrors > 10) {
    recommendations.push(
      `Frequent size errors (${sizeErrors}) - Possible OOM attack or unusually large legitimate payloads`
    );
  }
  
  // Timeout errors
  const timeoutErrors = metrics.errorsByType["MAX_PARSE_TIME_EXCEEDED"] ?? 0;
  if (timeoutErrors > 5) {
    recommendations.push(
      `Parsing timeouts detected (${timeoutErrors}) - Possible DoS attack or performance issues`
    );
  }
  
  // High depth usage
  if (metrics.maxDepthReached > MAX_RECURSION_DEPTH * 0.8) {
    recommendations.push(
      `Maximum depth usage high (${metrics.maxDepthReached}/${MAX_RECURSION_DEPTH}) - Monitor for potential limit issues`
    );
  }
  
  // All good
  if (recommendations.length === 0) {
    recommendations.push("✅ All metrics within normal ranges");
  }
  
  return recommendations;
}
