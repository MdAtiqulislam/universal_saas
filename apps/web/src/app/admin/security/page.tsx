"use client";

import React, { useState } from "react";
import {
  SecurityDashboard,
  SecurityEventList,
  ActiveSessionList,
  SecurityPolicyPanel,
  SecurityReports,
} from "@/features/security";

type Tab = "dashboard" | "events" | "sessions" | "policies" | "reports";

export default function SecurityManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Security, Compliance & Platform Hardening
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Enterprise authentication throttling, session revocation, threat telemetry, API rate
            limiting, and compliance auditing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            Platform Guard Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "dashboard"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Security Posture
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "events"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Audit Events
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "sessions"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Active Sessions
        </button>
        <button
          onClick={() => setActiveTab("policies")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "policies"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Security Policies
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "reports"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Compliance Reports
        </button>
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === "dashboard" && <SecurityDashboard />}
        {activeTab === "events" && <SecurityEventList />}
        {activeTab === "sessions" && <ActiveSessionList />}
        {activeTab === "policies" && <SecurityPolicyPanel />}
        {activeTab === "reports" && <SecurityReports />}
      </div>
    </div>
  );
}
