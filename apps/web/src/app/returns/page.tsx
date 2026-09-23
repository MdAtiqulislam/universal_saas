"use client";

import React, { useState } from "react";
import {
  ReturnsDashboard,
  ReturnList,
  ReturnDetailPanel,
  ReturnPolicyPanel,
  ReturnsReports,
  ReturnCreateDialog,
} from "@/features/returns";

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "list" | "policy" | "reports">(
    "dashboard",
  );
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleSelectReturn = (returnId: string) => {
    setSelectedReturnId(returnId);
  };

  const handleBackToList = () => {
    setSelectedReturnId(null);
  };

  const handleCreateSuccess = (returnId: string) => {
    setSelectedReturnId(returnId);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation & Header */}
        {!selectedReturnId && (
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Returns, Reverse Logistics & RMA
              </h1>
              <p className="text-sm text-slate-500">
                Milestone M32 Reverse Logistics Orchestration Platform
              </p>
            </div>

            {/* Main Tabs */}
            <div className="flex space-x-1 rounded-xl bg-slate-200/80 p-1">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "dashboard"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("list")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "list"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Return Requests (RMAs)
              </button>
              <button
                onClick={() => setActiveTab("policy")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "policy"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Policy Rules
              </button>
              <button
                onClick={() => setActiveTab("reports")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "reports"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Reports
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        {selectedReturnId ? (
          <ReturnDetailPanel returnId={selectedReturnId} onBack={handleBackToList} />
        ) : (
          <>
            {activeTab === "dashboard" && (
              <ReturnsDashboard
                onSelectReturn={handleSelectReturn}
                onCreateClick={() => setIsCreateOpen(true)}
              />
            )}

            {activeTab === "list" && (
              <ReturnList
                onSelectReturn={handleSelectReturn}
                onCreateClick={() => setIsCreateOpen(true)}
              />
            )}

            {activeTab === "policy" && <ReturnPolicyPanel />}

            {activeTab === "reports" && <ReturnsReports />}
          </>
        )}

        {/* Create RMA Modal */}
        <ReturnCreateDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      </div>
    </div>
  );
}
