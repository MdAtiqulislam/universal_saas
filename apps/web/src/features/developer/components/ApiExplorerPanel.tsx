"use client";

import React, { useState } from "react";
import { ApiEndpointDefinition, ApiExplorerResult } from "../types";
import { executeApiExplorer } from "../api/developer-api";

interface ApiExplorerPanelProps {
  endpoints: ApiEndpointDefinition[];
  initialEndpoint?: ApiEndpointDefinition | null;
}

export const ApiExplorerPanel: React.FC<ApiExplorerPanelProps> = ({
  endpoints,
  initialEndpoint,
}) => {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(
    initialEndpoint?.id || endpoints[0]?.id || "",
  );

  const endpoint = endpoints.find((e) => e.id === selectedEndpointId) || endpoints[0];

  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState<string>(() =>
    endpoint?.exampleRequest ? JSON.stringify(endpoint.exampleRequest, null, 2) : "",
  );

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ApiExplorerResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleEndpointChange = (id: string) => {
    setSelectedEndpointId(id);
    const ep = endpoints.find((e) => e.id === id);
    setResult(null);
    setErrorMessage(null);
    setPathParams({});
    setQueryParams({});
    setBodyText(ep?.exampleRequest ? JSON.stringify(ep.exampleRequest, null, 2) : "");
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpoint) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      let parsedBody: Record<string, unknown> | undefined;
      if (bodyText.trim()) {
        try {
          parsedBody = JSON.parse(bodyText) as Record<string, unknown>;
        } catch {
          throw new Error("Invalid JSON format in request body");
        }
      }

      const res = await executeApiExplorer({
        endpointId: endpoint.id,
        method: endpoint.method,
        path: endpoint.path,
        pathParams,
        queryParams,
        body: parsedBody,
      });

      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b pb-4 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Interactive API Explorer Sandbox
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Execute real-time test queries against registered API contracts within your tenant
            boundary.
          </p>
        </div>

        <form onSubmit={handleExecute} className="mt-4 space-y-4">
          {/* Target Endpoint Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Select Target API Endpoint
            </label>
            <select
              value={selectedEndpointId}
              onChange={(e) => handleEndpointChange(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 p-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  [{ep.method}] {ep.path} — {ep.operation}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Parameters */}
          {endpoint?.parameters && endpoint.parameters.length > 0 && (
            <div className="space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Parameters
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {endpoint.parameters.map((p) => (
                  <div key={p.name}>
                    <label className="block text-[11px] font-mono text-gray-700 dark:text-gray-300">
                      {p.name} {p.required && <span className="text-red-500">*</span>}{" "}
                      <span className="text-[10px] text-gray-400">({p.in})</span>
                    </label>
                    <input
                      type="text"
                      placeholder={p.description}
                      value={p.in === "path" ? pathParams[p.name] || "" : queryParams[p.name] || ""}
                      onChange={(e) => {
                        if (p.in === "path") {
                          setPathParams({ ...pathParams, [p.name]: e.target.value });
                        } else {
                          setQueryParams({ ...queryParams, [p.name]: e.target.value });
                        }
                      }}
                      className="mt-0.5 block w-full rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body Editor for POST/PUT/PATCH */}
          {["POST", "PUT", "PATCH"].includes(endpoint?.method || "") && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Request JSON Body
              </label>
              <textarea
                rows={6}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Enter JSON payload..."
              />
            </div>
          )}

          {/* Action Button */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center space-x-2 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <span>{isLoading ? "Executing..." : "Send Request"}</span>
              <span>&rarr;</span>
            </button>
          </div>
        </form>

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {/* Response Viewer */}
        {result && (
          <div className="mt-6 space-y-4 border-t pt-4 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    result.statusCode >= 200 && result.statusCode < 300
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  }`}
                >
                  HTTP {result.statusCode}
                </span>
                <span className="text-xs text-gray-500">
                  Duration: <strong>{result.durationMs}ms</strong>
                </span>
              </div>
              <div className="font-mono text-xs text-gray-500">
                Request ID: <code>{result.requestId}</code>
              </div>
            </div>

            {/* Response Headers */}
            <details className="rounded border border-gray-100 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900">
              <summary className="cursor-pointer font-semibold text-gray-600 dark:text-gray-400">
                Response Headers ({Object.keys(result.responseHeaders).length})
              </summary>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-gray-600 dark:text-gray-400">
                {Object.entries(result.responseHeaders).map(([k, v]) => (
                  <div key={k}>
                    <strong>{k}:</strong> {v}
                  </div>
                ))}
              </div>
            </details>

            {/* Response Body */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Response Body
              </label>
              <pre className="max-h-96 overflow-auto rounded bg-gray-900 p-4 font-mono text-xs text-green-400">
                {JSON.stringify(result.responseBody, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
