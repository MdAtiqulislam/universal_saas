"use client";

import React from "react";
import { BillingPayment } from "../types";

interface Props {
  payments: BillingPayment[];
}

export const PaymentHistoryPanel: React.FC<Props> = ({ payments }) => {
  const formatMoney = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCEEDED":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "FAILED":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "REFUNDED":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "PENDING":
      default:
        return "bg-amber-100 text-amber-800 border-amber-300";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Payment Transactions</h2>
        <p className="text-xs text-slate-500">
          Audit trail of gateway payments, transaction identifiers, and reconciliation statuses.
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-10 text-xs text-slate-400 border border-dashed rounded-lg">
          No payment transactions found.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-4 text-left">Date</th>
                <th className="py-2.5 px-4 text-left">Invoice #</th>
                <th className="py-2.5 px-4 text-left">Provider</th>
                <th className="py-2.5 px-4 text-left">Transaction Ref</th>
                <th className="py-2.5 px-4 text-left">Status</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-800">
                    {p.invoice?.invoiceNumber || "—"}
                  </td>
                  <td className="py-3 px-4 uppercase text-[11px] font-semibold text-slate-600">
                    {p.providerKey}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                    {p.providerTransactionId || "—"}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(
                        p.status,
                      )}`}
                    >
                      {p.status}
                    </span>
                    {p.failureReason && (
                      <span className="block text-[10px] text-rose-600 mt-0.5">
                        {p.failureReason}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatMoney(p.amount, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
