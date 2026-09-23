"use client";

import React from "react";
import { DataOperationsDashboard } from "@/features/data-operations";

export default function AdminDataOperationsPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-6 px-4 sm:px-6 lg:px-8">
      <DataOperationsDashboard />
    </div>
  );
}
