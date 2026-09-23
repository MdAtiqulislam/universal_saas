"use client";

import React, { useState } from "react";
import { ApiEndpointDefinition } from "../types";

interface ApiReferencePanelProps {
  endpoints: ApiEndpointDefinition[];
  onSelectEndpointForExplorer: (endpoint: ApiEndpointDefinition) => void;
}

export const ApiReferencePanel: React.FC<ApiReferencePanelProps> = ({
  endpoints,
  onSelectEndpointForExplorer,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeEndpointId, setActiveEndpointId] = useState<string>(endpoints[0]?.id || "");

  const categories = ["ALL", ...Array.from(new Set(endpoints.map((e) => e.category)))];

  const filteredEndpoints = endpoints.filter((e) => {
    const matchesCat =
      selectedCategory === "ALL" || e.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      e.operation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const selectedEndpoint = endpoints.find((e) => e.id === activeEndpointId) || filteredEndpoints[0];

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      case "POST":
        return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
      case "PUT":
      case "PATCH":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
      case "DELETE":
        return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Sidebar: Endpoint Catalog */}
      <div className="space-y-4 lg:col-span-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Search API endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded border border-gray-300 p-2 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded border border-gray-300 p-2 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[600px] space-y-1.5 overflow-y-auto pr-1">
          {filteredEndpoints.map((ep) => (
            <button
              key={ep.id}
              type="button"
              onClick={() => setActiveEndpointId(ep.id)}
              className={`w-full rounded-md border p-3 text-left transition-all ${
                selectedEndpoint?.id === ep.id
                  ? "border-blue-500 bg-blue-50/50 shadow-sm dark:border-blue-500 dark:bg-blue-950/20"
                  : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getMethodBadgeClass(ep.method)}`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {ep.path}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">
                {ep.description}
              </p>
            </button>
          ))}
          {filteredEndpoints.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-400">
              No matching endpoints found
            </div>
          )}
        </div>
      </div>

      {/* Main Details Panel */}
      <div className="space-y-6 lg:col-span-8">
        {selectedEndpoint ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 dark:border-gray-700">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${getMethodBadgeClass(selectedEndpoint.method)}`}
                  >
                    {selectedEndpoint.method}
                  </span>
                  <h3 className="font-mono text-base font-bold text-gray-900 dark:text-gray-100">
                    {selectedEndpoint.path}
                  </h3>
                  {selectedEndpoint.deprecated && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      DEPRECATED
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {selectedEndpoint.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectEndpointForExplorer(selectedEndpoint)}
                className="flex items-center space-x-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <span>Try in Explorer</span>
                <span>&rarr;</span>
              </button>
            </div>

            {/* Scope & Auth Requirements */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Required Scopes
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selectedEndpoint.requiredScopes.map((scope) => (
                    <code
                      key={scope}
                      className="rounded bg-purple-50 px-2 py-0.5 font-mono text-xs text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                    >
                      {scope}
                    </code>
                  ))}
                </div>
              </div>

              <div className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Authentication Scheme
                </span>
                <div className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">
                  <code>Authorization: Bearer &lt;api-key&gt;</code>
                </div>
              </div>
            </div>

            {/* Parameters Table */}
            {selectedEndpoint.parameters.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Parameters
                </h4>
                <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                          Name
                        </th>
                        <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                          In
                        </th>
                        <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                          Type
                        </th>
                        <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                          Required
                        </th>
                        <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedEndpoint.parameters.map((p) => (
                        <tr key={p.name}>
                          <td className="px-3 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                            {p.name}
                          </td>
                          <td className="px-3 py-2 uppercase text-gray-500">{p.in}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{p.type}</td>
                          <td className="px-3 py-2">
                            {p.required ? (
                              <span className="font-semibold text-red-600">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                            {p.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Example Request / Response */}
            <div className="mt-6 space-y-4">
              {selectedEndpoint.exampleRequest && (
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Example Request Body
                  </h4>
                  <pre className="overflow-x-auto rounded bg-gray-900 p-3 font-mono text-xs text-gray-100">
                    {JSON.stringify(selectedEndpoint.exampleRequest, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEndpoint.exampleResponse && (
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Example Response (200 OK)
                  </h4>
                  <pre className="overflow-x-auto rounded bg-gray-900 p-3 font-mono text-xs text-green-400">
                    {JSON.stringify(selectedEndpoint.exampleResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-500">
            Select an endpoint from the catalog to view details
          </div>
        )}
      </div>
    </div>
  );
};
