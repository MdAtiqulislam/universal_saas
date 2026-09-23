import { Injectable } from '@nestjs/common';

export interface MetricSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { p50: number; p95: number; p99: number }>;
}

@Injectable()
export class MetricsService {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  private buildKey(key: string, labels?: Record<string, string>): string {
    if (!labels) return key;
    const labelStr = Object.entries(labels)
      .sort(([k1], [k2]) => k1.localeCompare(k2))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${key}{${labelStr}}`;
  }

  incrementCounter(key: string, labels?: Record<string, string>): void {
    const fullKey = this.buildKey(key, labels);
    const current = this.counters.get(fullKey) || 0;
    this.counters.set(fullKey, current + 1);
  }

  setGauge(key: string, value: number, labels?: Record<string, string>): void {
    const fullKey = this.buildKey(key, labels);
    this.gauges.set(fullKey, value);
  }

  recordHistogram(
    key: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    if (value < 0) return; // INV-342: Histogram values are non-negative
    const fullKey = this.buildKey(key, labels);
    let values = this.histograms.get(fullKey);
    if (!values) {
      values = [];
      this.histograms.set(fullKey, values);
    }
    values.push(value);
    if (values.length > 1000) {
      values.shift();
    }
  }

  getMetrics(): MetricSnapshot {
    const snapshot: MetricSnapshot = {
      counters: {},
      gauges: {},
      histograms: {},
    };
    for (const [k, v] of this.counters.entries()) snapshot.counters[k] = v;
    for (const [k, v] of this.gauges.entries()) snapshot.gauges[k] = v;

    for (const k of this.histograms.keys()) {
      const p = this.getHistogramPercentiles(k);
      if (p) snapshot.histograms[k] = p;
    }
    return snapshot;
  }

  getCounterValue(key: string): number {
    return this.counters.get(key) || 0;
  }

  getHistogramPercentiles(
    key: string,
  ): { p50: number; p95: number; p99: number } | null {
    const values = this.histograms.get(key);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const getP = (p: number) => {
      const idx = Math.floor(p * (sorted.length - 1));
      return sorted[idx];
    };

    return {
      p50: getP(0.5),
      p95: getP(0.95),
      p99: getP(0.99),
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}
