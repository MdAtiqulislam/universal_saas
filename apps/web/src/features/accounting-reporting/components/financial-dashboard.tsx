"use client";

import React, { useEffect, useState } from "react";
import { FinancialKpisReport } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function FinancialDashboard({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
  const [kpis, setKpis] = useState<FinancialKpisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKpis();
  }, []);

  async function loadKpis() {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportingApi.getFinancialKpis();
      setKpis(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load KPIs");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to load financial dashboard</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadKpis}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            ${Number(kpis.profitability.revenue).toLocaleString()}
          </h3>
          <p className="mt-1 text-xs text-emerald-600 font-medium">
            Gross Margin: {kpis.profitability.grossMarginPercent}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Net Profit
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            ${Number(kpis.profitability.netProfit).toLocaleString()}
          </h3>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Net Margin: {kpis.profitability.netMarginPercent}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Cash Position
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            ${Number(kpis.liquidity.cashPosition).toLocaleString()}
          </h3>
          <p className="mt-1 text-xs text-indigo-600 font-medium">
            Working Capital: ${Number(kpis.liquidity.workingCapital).toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Current Ratio
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{kpis.liquidity.currentRatio}</h3>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Quick Ratio: {kpis.liquidity.quickRatio}
          </p>
        </div>
      </div>

      {/* Profitability & Liquidity Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h4 className="font-semibold text-slate-800">Profitability Breakdown</h4>
            {onSelectTab && (
              <button
                onClick={() => onSelectTab("profit-loss")}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                View Full P&L &rarr;
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Revenue</span>
              <span className="font-semibold text-slate-900">
                ${Number(kpis.profitability.revenue).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cost of Goods Sold (COGS)</span>
              <span className="font-medium text-slate-700">
                -${Number(kpis.profitability.cogs).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-900 border-t border-slate-100 pt-2">
              <span>Gross Profit</span>
              <span className="text-emerald-700">
                ${Number(kpis.profitability.grossProfit).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Operating Expenses</span>
              <span className="font-medium text-slate-700">
                -${Number(kpis.profitability.operatingExpenses).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-900 border-t border-slate-100 pt-2">
              <span>Operating Profit</span>
              <span>${Number(kpis.profitability.operatingProfit).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t-2 border-slate-200 pt-2">
              <span>Net Income</span>
              <span
                className={
                  Number(kpis.profitability.netProfit) >= 0 ? "text-emerald-600" : "text-red-600"
                }
              >
                ${Number(kpis.profitability.netProfit).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h4 className="font-semibold text-slate-800">Working Capital & Balances</h4>
            {onSelectTab && (
              <button
                onClick={() => onSelectTab("balance-sheet")}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                View Balance Sheet &rarr;
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cash & Equivalents</span>
              <span className="font-semibold text-slate-900">
                ${Number(kpis.liquidity.cashPosition).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Accounts Receivable (AR)</span>
              <span className="font-medium text-slate-700">
                ${Number(kpis.workingCapitalMetrics.accountsReceivable).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Inventory Valuation</span>
              <span className="font-medium text-slate-700">
                ${Number(kpis.workingCapitalMetrics.inventoryValue).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-900 border-t border-slate-100 pt-2">
              <span>Total Current Assets</span>
              <span>${Number(kpis.liquidity.currentAssets).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Accounts Payable (AP)</span>
              <span className="font-medium text-slate-700">
                ${Number(kpis.workingCapitalMetrics.accountsPayable).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-900 border-t border-slate-100 pt-2">
              <span>Total Current Liabilities</span>
              <span>${Number(kpis.liquidity.currentLiabilities).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t-2 border-slate-200 pt-2">
              <span>Net Working Capital</span>
              <span className="text-indigo-600">
                ${Number(kpis.liquidity.workingCapital).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
