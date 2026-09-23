"use client";

import React, { useState, useEffect } from "react";
import { MrrReport, ArrReport, InvoiceAgingReport, PaymentReliabilityReport } from "../types";
import {
  getMrrReport,
  getArrReport,
  getInvoiceAgingReport,
  getPaymentReliabilityReport,
} from "../api/billing-api";

export const BillingReportsPanel: React.FC = () => {
  const [mrr, setMrr] = useState<MrrReport | null>(null);
  const [arr, setArr] = useState<ArrReport | null>(null);
  const [aging, setAging] = useState<InvoiceAgingReport | null>(null);
  const [reliability, setReliability] = useState<PaymentReliabilityReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      getMrrReport(),
      getArrReport(),
      getInvoiceAgingReport(),
      getPaymentReliabilityReport(),
    ])
      .then(([m, a, ag, r]) => {
        if (!ignore) {
          setMrr(m);
          setArr(a);
          setAging(ag);
          setReliability(r);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const formatMoney = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-xs text-slate-400">
        Loading commercial reports...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Recurring Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Monthly Recurring Revenue (MRR)
          </div>
          <div className="text-2xl font-black text-slate-900">
            {mrr ? formatMoney(mrr.totalMrr, mrr.currency) : "$0"}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {mrr?.subscriptionCount || 0} active subscriptions
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Annual Recurring Revenue (ARR)
          </div>
          <div className="text-2xl font-black text-slate-900">
            {arr ? formatMoney(arr.totalArr, arr.currency) : "$0"}
          </div>
          <div className="mt-2 text-xs text-slate-500">MRR × 12 annualized</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Payment Success Rate
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {reliability?.successRatePercentage ?? 100}%
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {reliability?.succeededCount || 0} / {reliability?.totalAttempts || 0} attempts
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Revenue Collected
          </div>
          <div className="text-2xl font-black text-slate-900">
            {reliability ? formatMoney(reliability.totalVolumeCollected) : "$0"}
          </div>
          <div className="mt-2 text-xs text-slate-500">Settled payments volume</div>
        </div>
      </div>

      {/* MRR Breakdown by Plan */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">MRR Distribution by Plan</h3>
        {!mrr?.breakdownByPlan || mrr.breakdownByPlan.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-lg">
            No subscription revenue recorded.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4 text-left">Plan Name</th>
                  <th className="py-2.5 px-4 text-right">Active Tenants</th>
                  <th className="py-2.5 px-4 text-right">Monthly Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {mrr.breakdownByPlan.map((bp) => (
                  <tr key={bp.planKey} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{bp.planName}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">
                      {bp.subscriptionCount}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                      {formatMoney(bp.mrr, mrr.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Aging Buckets */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">
          Accounts Receivable & Invoice Aging
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
            <div className="text-xs text-slate-500 mb-1">Current (0–30 Days)</div>
            <div className="text-lg font-bold text-slate-900">
              {aging ? formatMoney(aging.current0To30Days, aging.currency) : "$0"}
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-amber-50/40 border-amber-200">
            <div className="text-xs text-amber-700 mb-1">Past Due (31–60 Days)</div>
            <div className="text-lg font-bold text-amber-700">
              {aging ? formatMoney(aging.pastDue31To60Days, aging.currency) : "$0"}
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-amber-50/70 border-amber-300">
            <div className="text-xs text-amber-800 mb-1">Past Due (61–90 Days)</div>
            <div className="text-lg font-bold text-amber-800">
              {aging ? formatMoney(aging.pastDue61To90Days, aging.currency) : "$0"}
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-rose-50/60 border-rose-200">
            <div className="text-xs text-rose-700 mb-1">Overdue (90+ Days)</div>
            <div className="text-lg font-bold text-rose-700">
              {aging ? formatMoney(aging.pastDue90PlusDays, aging.currency) : "$0"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
