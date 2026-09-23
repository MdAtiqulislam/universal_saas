"use client";

import React from "react";
import Link from "next/link";
import { ApprovalInboxPanel } from "@/features/workflows";

export default function AdminWorkflowApprovalsPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Workflow Approvals Inbox
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Review and decide human approval requests across active workflow processes.
          </p>
        </div>
        <Link
          href="/admin/workflows"
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          &larr; Back to Workflows
        </Link>
      </div>

      <ApprovalInboxPanel />
    </div>
  );
}
