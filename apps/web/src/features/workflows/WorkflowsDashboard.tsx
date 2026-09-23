"use client";

import React, { useState } from "react";
import { WorkflowDefinition } from "./types";
import { WorkflowListPanel } from "./WorkflowListPanel";
import { WorkflowBuilderPanel } from "./WorkflowBuilderPanel";
import { ExecutionExplorerPanel } from "./ExecutionExplorerPanel";
import { ApprovalInboxPanel } from "./ApprovalInboxPanel";
import { ScheduleManagementPanel } from "./ScheduleManagementPanel";
import { WorkflowReportsPanel } from "./WorkflowReportsPanel";

export const WorkflowsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "WORKFLOWS" | "EXECUTIONS" | "APPROVALS" | "SCHEDULES" | "REPORTS"
  >("WORKFLOWS");

  const [selectedWorkflowForBuilder, setSelectedWorkflowForBuilder] =
    useState<WorkflowDefinition | null>(null);
  const [selectedWorkflowForExecutions, setSelectedWorkflowForExecutions] = useState<
    string | undefined
  >(undefined);

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Workflow Automation & Process Orchestration
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Model, version, trigger, evaluate, execute, approve, and monitor enterprise business
          processes.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab("WORKFLOWS");
              setSelectedWorkflowForBuilder(null);
            }}
            className={`border-b-2 py-3 px-1 text-sm font-medium ${
              activeTab === "WORKFLOWS"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Workflow Definitions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("EXECUTIONS")}
            className={`border-b-2 py-3 px-1 text-sm font-medium ${
              activeTab === "EXECUTIONS"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Execution Explorer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("APPROVALS")}
            className={`border-b-2 py-3 px-1 text-sm font-medium ${
              activeTab === "APPROVALS"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Approval Inbox
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SCHEDULES")}
            className={`border-b-2 py-3 px-1 text-sm font-medium ${
              activeTab === "SCHEDULES"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Schedules & Triggers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("REPORTS")}
            className={`border-b-2 py-3 px-1 text-sm font-medium ${
              activeTab === "REPORTS"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Telemetry & Reports
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "WORKFLOWS" &&
          (selectedWorkflowForBuilder ? (
            <WorkflowBuilderPanel
              workflow={selectedWorkflowForBuilder}
              onVersionPublished={() => setSelectedWorkflowForBuilder(null)}
              onClose={() => setSelectedWorkflowForBuilder(null)}
            />
          ) : (
            <WorkflowListPanel
              onSelectWorkflow={(wf) => setSelectedWorkflowForBuilder(wf)}
              onViewExecutions={(wfId) => {
                setSelectedWorkflowForExecutions(wfId);
                setActiveTab("EXECUTIONS");
              }}
            />
          ))}

        {activeTab === "EXECUTIONS" && (
          <ExecutionExplorerPanel initialWorkflowId={selectedWorkflowForExecutions} />
        )}

        {activeTab === "APPROVALS" && <ApprovalInboxPanel />}

        {activeTab === "SCHEDULES" && <ScheduleManagementPanel />}

        {activeTab === "REPORTS" && <WorkflowReportsPanel />}
      </div>
    </div>
  );
};
