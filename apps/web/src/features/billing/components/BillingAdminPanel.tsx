"use client";

import React, { useState } from "react";
import { BillingCredit } from "../types";
import { validateDiscount } from "../api/billing-api";

interface Props {
  credits: BillingCredit[];
  availableCredit: number;
}

export const BillingAdminPanel: React.FC<Props> = ({ credits, availableCredit }) => {
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const handleTestDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountCode.trim()) return;
    setIsValidating(true);
    setDiscountResult(null);

    try {
      const res = await validateDiscount(discountCode, 10000); // Test against $100.00
      setDiscountResult(
        `Valid! Discount: ${res.discount.name} (${
          res.discount.discountType === "PERCENTAGE"
            ? `${res.discount.value}% off`
            : formatMoney(res.discount.value)
        }). Deducts ${formatMoney(res.calculatedDeduction)} on $100.00 subtotal.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiscountResult(`Error: ${msg}`);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Credit Ledger Management */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Organization Credit Ledger</h3>
            <p className="text-xs text-slate-500">
              Credits automatically reduce balances on upcoming invoices.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Available Balance</span>
            <span className="text-xl font-bold text-emerald-600">
              {formatMoney(availableCredit)}
            </span>
          </div>
        </div>

        {credits.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-lg">
            No credit grants on record for this tenant.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4 text-left">Grant Date</th>
                  <th className="py-2.5 px-4 text-left">Reason / Note</th>
                  <th className="py-2.5 px-4 text-right">Granted</th>
                  <th className="py-2.5 px-4 text-right">Consumed</th>
                  <th className="py-2.5 px-4 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {credits.map((c) => {
                  const remaining = Math.max(0, c.amount - c.consumedAmount);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {c.reason || "Manual Credit Adjustment"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-700">
                        {formatMoney(c.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">
                        {formatMoney(c.consumedAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                        {formatMoney(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discount Code Validator */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Promotional Discount Verification
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Test and preview the impact of discount codes and promotions.
        </p>

        <form onSubmit={handleTestDiscount} className="max-w-md space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder="e.g. ENTERPRISE20, LAUNCH50"
              className="flex-1 text-xs rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase focus:ring-1 focus:ring-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isValidating || !discountCode.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isValidating ? "Validating..." : "Validate"}
            </button>
          </div>

          {discountResult && (
            <div
              className={`p-3 rounded-lg text-xs font-medium border ${
                discountResult.startsWith("Valid")
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {discountResult}
            </div>
          )}
        </form>
      </div>

      {/* Provider Status */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Payment Gateway & Provider Architecture
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Provider abstraction layer routing and security status.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <span className="text-slate-400 block mb-1">Active Adapter</span>
            <span className="font-bold text-slate-900">SandboxBillingProviderAdapter</span>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <span className="text-slate-400 block mb-1">PCI Scope</span>
            <span className="font-bold text-emerald-600">Zero Raw Card Data (SAQ-A)</span>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <span className="text-slate-400 block mb-1">Webhook Ingestion</span>
            <span className="font-bold text-emerald-600">HMAC-SHA256 Idempotent</span>
          </div>
        </div>
      </div>
    </div>
  );
};
