"use client";

import React, { useState, useEffect } from "react";
import { DeveloperOverviewData, ApiEndpointDefinition } from "./types";
import { getDeveloperOverview, getApiEndpoints } from "./api/developer-api";
import { DeveloperKpiRibbon } from "./components/DeveloperKpiRibbon";
import { ApiReferencePanel } from "./components/ApiReferencePanel";
import { ApiExplorerPanel } from "./components/ApiExplorerPanel";
import { ApiUsagePanel } from "./components/ApiUsagePanel";
import { ApiErrorPanel } from "./components/ApiErrorPanel";
import { ApiVersionPanel } from "./components/ApiVersionPanel";
import { WebhookDocsPanel } from "./components/WebhookDocsPanel";
import { ApiKeysPanel } from "../integrations/ApiKeysPanel";

type TabType =
  "OVERVIEW" | "KEYS" | "REFERENCE" | "EXPLORER" | "USAGE" | "ERRORS" | "WEBHOOKS" | "VERSIONS";

export const DeveloperDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("OVERVIEW");
  const [overview, setOverview] = useState<DeveloperOverviewData | null>(null);
  const [endpoints, setEndpoints] = useState<ApiEndpointDefinition[]>([]);
  const [selectedEndpointForExplorer, setSelectedEndpointForExplorer] =
    useState<ApiEndpointDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getDeveloperOverview(), getApiEndpoints()])
      .then(([ov, ep]) => {
        if (!ignore) {
          setOverview(ov);
          setEndpoints(ep);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(msg);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleSelectForExplorer = (endpoint: ApiEndpointDefinition) => {
    setSelectedEndpointForExplorer(endpoint);
    setActiveTab("EXPLORER");
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "OVERVIEW", label: "Overview" },
    { id: "KEYS", label: "API Keys" },
    { id: "REFERENCE", label: "API Reference" },
    { id: "EXPLORER", label: "API Explorer" },
    { id: "USAGE", label: "Usage & Telemetry" },
    { id: "ERRORS", label: "Error Catalog" },
    { id: "WEBHOOKS", label: "Webhooks" },
    { id: "VERSIONS", label: "Versions" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Developer Platform & API Portal
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tenant-isolated public REST APIs, scoped API key authentication, and interactive
            developer sandbox.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href="/api/v1/developer/docs/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            OpenAPI Spec (JSON) &nearr;
          </a>
        </div>
      </div>

      {/* KPI Ribbon */}
      {overview && <DeveloperKpiRibbon kpis={overview.kpis} rateLimit={overview.rateLimit} />}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-2 px-1 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <strong>Notice:</strong> {errorMessage}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 text-center text-xs text-gray-400">
          Initializing developer platform...
        </div>
      )}

      {/* Tab Panels */}
      {!isLoading && (
        <div>
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6">
              {/* Quick Start & Top Endpoints */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Quick Start Integration Guide
                  </h3>
                  <div className="mt-3 space-y-3 text-xs text-gray-600 dark:text-gray-400">
                    <p>
                      <strong>1. Generate an API Key:</strong> Navigate to the{" "}
                      <strong>API Keys</strong> tab to generate a cryptographically secure 256-bit
                      token.
                    </p>
                    <p>
                      <strong>2. Set Authorization Header:</strong> Pass your token with each REST
                      request:
                    </p>
                    <pre className="rounded bg-gray-900 p-3 font-mono text-[11px] text-green-400">
                      Authorization: Bearer sec_live_...
                    </pre>
                    <p>
                      <strong>3. Explore Endpoints:</strong> Browse documentation under{" "}
                      <strong>API Reference</strong> and execute real queries inside the{" "}
                      <strong>API Explorer</strong>.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Most Active Endpoints (30d)
                  </h3>
                  <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                    {overview?.topEndpoints.map((ep) => (
                      <div
                        key={`${ep.method}-${ep.route}`}
                        className="flex items-center justify-between py-2 text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-600">{ep.method}</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">
                            {ep.route}
                          </span>
                        </div>
                        <div className="text-right text-gray-500">
                          <strong>{ep.requests.toLocaleString()}</strong> reqs ({ep.avgDurationMs}ms
                          avg)
                        </div>
                      </div>
                    ))}
                    {(!overview?.topEndpoints || overview.topEndpoints.length === 0) && (
                      <div className="py-6 text-center text-xs text-gray-400">
                        No traffic recorded yet. Try running an explorer request!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "KEYS" && <ApiKeysPanel />}

          {activeTab === "REFERENCE" && (
            <ApiReferencePanel
              endpoints={endpoints}
              onSelectEndpointForExplorer={handleSelectForExplorer}
            />
          )}

          {activeTab === "EXPLORER" && (
            <ApiExplorerPanel endpoints={endpoints} initialEndpoint={selectedEndpointForExplorer} />
          )}

          {activeTab === "USAGE" && <ApiUsagePanel />}

          {activeTab === "ERRORS" && <ApiErrorPanel />}

          {activeTab === "WEBHOOKS" && <WebhookDocsPanel />}

          {activeTab === "VERSIONS" && <ApiVersionPanel />}
        </div>
      )}
    </div>
  );
};
