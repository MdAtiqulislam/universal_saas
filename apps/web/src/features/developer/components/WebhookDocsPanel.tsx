"use client";

import React, { useState, useEffect } from "react";
import { WebhookDocsData } from "../types";
import { getWebhookDocs } from "../api/developer-api";

export const WebhookDocsPanel: React.FC = () => {
  const [data, setData] = useState<WebhookDocsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getWebhookDocs()
      .then((res) => {
        if (!ignore) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error("Failed to load webhook docs:", err);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-xs text-gray-500">
        Loading webhook documentation...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Webhook Architecture & Security Guide
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Reliable, asynchronous event delivery using HMAC-SHA256 cryptographic signatures.
        </p>

        {/* Security & Transport Grid */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Transport
            </span>
            <div className="mt-1 text-xs font-semibold text-gray-900 dark:text-gray-100">
              {data?.deliveryModel.transport} (JSON)
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">SSRF-validated HTTPS endpoints only</p>
          </div>

          <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Signature Algorithm
            </span>
            <div className="mt-1 text-xs font-semibold text-gray-900 dark:text-gray-100">
              {data?.deliveryModel.signingAlgorithm}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Header: <code>X-Webhook-Signature</code>
            </p>
          </div>

          <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Retry Policy
            </span>
            <div className="mt-1 text-xs font-semibold text-gray-900 dark:text-gray-100">
              {data?.deliveryModel.retryPolicy.maxAttempts} Attempts Max
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {data?.deliveryModel.retryPolicy.backoffStrategy}
            </p>
          </div>
        </div>

        {/* Signature Verification Code */}
        <div className="mt-6 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Verifying Webhook Signatures in Node.js
          </h4>
          <pre className="overflow-x-auto rounded bg-gray-900 p-4 font-mono text-xs text-green-400">
            {data?.signatureVerificationExample.code}
          </pre>
        </div>

        {/* Supported Event Types */}
        <div className="mt-6 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Supported Integration Event Types
          </h4>
          <div className="flex flex-wrap gap-2">
            {data?.supportedEvents.map((evt) => (
              <span
                key={evt}
                className="rounded bg-blue-50 px-2.5 py-1 font-mono text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              >
                {evt}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
