"use client";

import React from "react";
import { OperationsDashboard } from "@/features/operations";

export default function AdminOperationsPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time system health, API performance, and telemetry
        </p>
      </div>
      <OperationsDashboard />
    </div>
  );
}
