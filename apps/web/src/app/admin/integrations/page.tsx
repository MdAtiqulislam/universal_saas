"use client";

import React from "react";
import { IntegrationsDashboard } from "@/features/integrations";

export default function AdminIntegrationsPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integration Platform</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage third-party connections, programmatic API keys, and outbound webhooks
        </p>
      </div>
      <IntegrationsDashboard />
    </div>
  );
}
