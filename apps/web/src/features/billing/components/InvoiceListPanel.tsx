"use client";

import React, { useState } from "react";
import { BillingInvoice } from "../types";

interface Props {
  invoices: BillingInvoice[];
  onPayInvoice?: (invoiceId: string, amount: number) => Promise<void>;
  isLoading?: boolean;
}

export const InvoiceListPanel: React.FC<Props> = ({
  invoices,
  onPayInvoice,
  isLoading = false,
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  const formatMoney = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "OPEN":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "PARTIALLY_PAID":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-300";
      case "VOID":
      case "UNCOLLECTIBLE":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const handlePay = async (invoice: BillingInvoice) => {
    if (!onPayInvoice) return;
    setIsProcessingPay(true);
    try {
      await onPayInvoice(invoice.id, invoice.amountDue);
      setSelectedInvoice(null);
    } finally {
      setIsProcessingPay(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Invoices & Billing Ledger</h2>
          <p className="text-xs text-slate-500">
            Immutable financial statements, line-item itemizations, and payment receipts.
          </p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-10 text-xs text-slate-400 border border-dashed rounded-lg">
          No invoices have been issued yet.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-4 text-left">Invoice #</th>
                <th className="py-2.5 px-4 text-left">Issue Date</th>
                <th className="py-2.5 px-4 text-left">Due Date</th>
                <th className="py-2.5 px-4 text-left">Status</th>
                <th className="py-2.5 px-4 text-right">Total</th>
                <th className="py-2.5 px-4 text-right">Paid</th>
                <th className="py-2.5 px-4 text-right">Amount Due</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(inv.issueDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(inv.dueDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(
                        inv.status,
                      )}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">
                    {formatMoney(inv.totalAmount, inv.currency)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                    {formatMoney(inv.amountPaid, inv.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatMoney(inv.amountDue, inv.currency)}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(inv)}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      View
                    </button>
                    {inv.amountDue > 0 && onPayInvoice && (
                      <button
                        type="button"
                        disabled={isLoading || isProcessingPay}
                        onClick={() => handlePay(inv)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[11px] font-semibold"
                      >
                        Pay Now
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Invoice {selectedInvoice.invoiceNumber}
                </h3>
                <span
                  className={`inline-flex px-2 py-0.5 mt-1 rounded text-[11px] font-semibold border ${getStatusBadge(
                    selectedInvoice.status,
                  )}`}
                >
                  {selectedInvoice.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Line items table */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Line Items
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2 px-3 text-left">Description</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedInvoice.lineItems?.map((li) => (
                      <tr key={li.id}>
                        <td className="py-2 px-3 text-slate-800 font-medium">{li.description}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{li.quantity}</td>
                        <td className="py-2 px-3 text-right text-slate-500">
                          {formatMoney(li.unitAmount, selectedInvoice.currency)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">
                          {formatMoney(li.totalAmount, selectedInvoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial summary breakdown */}
            <div className="border-t border-slate-100 pt-4 mb-6 space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
              </div>
              {selectedInvoice.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount Applied:</span>
                  <span>
                    -{formatMoney(selectedInvoice.discountAmount, selectedInvoice.currency)}
                  </span>
                </div>
              )}
              {selectedInvoice.taxAmount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Taxes:</span>
                  <span>{formatMoney(selectedInvoice.taxAmount, selectedInvoice.currency)}</span>
                </div>
              )}
              {selectedInvoice.creditApplied > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Credit Balance Applied:</span>
                  <span>
                    -{formatMoney(selectedInvoice.creditApplied, selectedInvoice.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-2">
                <span>Invoice Total:</span>
                <span>{formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Amount Paid:</span>
                <span>{formatMoney(selectedInvoice.amountPaid, selectedInvoice.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-amber-600">
                <span>Balance Due:</span>
                <span>{formatMoney(selectedInvoice.amountDue, selectedInvoice.currency)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {selectedInvoice.amountDue > 0 && onPayInvoice && (
                <button
                  type="button"
                  disabled={isProcessingPay}
                  onClick={() => handlePay(selectedInvoice)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  {isProcessingPay
                    ? "Processing..."
                    : `Pay ${formatMoney(selectedInvoice.amountDue, selectedInvoice.currency)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
