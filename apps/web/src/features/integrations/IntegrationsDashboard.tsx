"use client";

import React, { useState, useEffect } from "react";
import { IntegrationHealthSummary } from "./types";
import { getIntegrationHealth } from "./api";
import { ConnectionsPanel } from "./ConnectionsPanel";
import { ApiKeysPanel } from "./ApiKeysPanel";
import { WebhooksPanel } from "./WebhooksPanel";

type TabType = "connections" | "apikeys" | "webhooks";

export function IntegrationsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("connections");
  const [health, setHealth] = useState<IntegrationHealthSummary | null>(null);
  useEffect(() => {
    getIntegrationHealth()
      .then((data) => setHealth(data))
      .catch(() => undefined);
  }, []);

  const totalConnections = health
    ? Object.values(health.connections).reduce((a, b) => a + b, 0)
    : 0;
  const connectedCount = health?.connections["CONNECTED"] ?? 0;

  const totalDeliveries = health
    ? Object.values(health.last24hDeliveries).reduce((a, b) => a + b, 0)
    : 0;
  const successfulDeliveries = health?.last24hDeliveries["SUCCESS"] ?? 0;
  const successRate =
    totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Connections
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-bold text-gray-900">{connectedCount}</span>
            <span className="ml-2 text-sm text-gray-500">/ {totalConnections} active</span>
          </div>
          <div className="mt-1 text-xs text-green-600 font-medium">Provider Integrations</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Active API Keys
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-bold text-gray-900">{health?.activeApiKeys ?? 0}</span>
          </div>
          <div className="mt-1 text-xs text-indigo-600 font-medium">Programmatic Credentials</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Webhook Subscriptions
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-bold text-gray-900">
              {health?.webhookSubscriptions["ACTIVE"] ?? 0}
            </span>
          </div>
          <div className="mt-1 text-xs text-purple-600 font-medium">Outbound Event Handlers</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            24h Delivery Success
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-bold text-gray-900">{successRate}%</span>
            <span className="ml-2 text-sm text-gray-500">
              ({successfulDeliveries}/{totalDeliveries})
            </span>
          </div>
          <div
            className={`mt-1 text-xs font-medium ${successRate >= 95 ? "text-green-600" : "text-amber-600"}`}
          >
            Reliability Score
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("connections")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "connections"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Integration Connections
          </button>
          <button
            onClick={() => setActiveTab("apikeys")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "apikeys"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            API Keys
          </button>
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "webhooks"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Outbound Webhooks
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        {activeTab === "connections" && <ConnectionsPanel />}
        {activeTab === "apikeys" && <ApiKeysPanel />}
        {activeTab === "webhooks" && <WebhooksPanel />}
      </div>
    </div>
  );
}
