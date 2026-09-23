"use client";

import React, { useState } from "react";
import { SearchFilterNode } from "../types";

interface AdvancedFilterBuilderProps {
  onApplyFilters: (filters: SearchFilterNode | undefined) => void;
  onClose: () => void;
}

export const AdvancedFilterBuilder: React.FC<AdvancedFilterBuilderProps> = ({
  onApplyFilters,
  onClose,
}) => {
  const [field, setField] = useState("status");
  const [operator, setOperator] = useState("eq");
  const [value, setValue] = useState("");

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !value.trim()) {
      onApplyFilters(undefined);
      return;
    }

    const node: SearchFilterNode = {
      field,
      operator,
      value: value.trim(),
    };

    onApplyFilters(node);
  };

  const handleClear = () => {
    setValue("");
    onApplyFilters(undefined);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4 shadow-inner">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          Structured Filter Builder
        </h4>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <form onSubmit={handleApply} className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Field</label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="status">Status</option>
            <option value="code">Code / SKU</option>
            <option value="email">Email</option>
            <option value="amount">Amount</option>
            <option value="title">Title / Name</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Operator</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="eq">Equals (=)</option>
            <option value="neq">Not Equals (≠)</option>
            <option value="contains">Contains (~)</option>
            <option value="startsWith">Starts With</option>
            <option value="gt">Greater Than (&gt;)</option>
            <option value="lt">Less Than (&lt;)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Value</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. ACTIVE or 1000"
            className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-end space-x-2">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white text-xs font-medium py-1.5 px-3 rounded hover:bg-blue-700 transition-colors"
          >
            Apply Filter
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="bg-white border border-gray-300 text-gray-700 text-xs font-medium py-1.5 px-3 rounded hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};
