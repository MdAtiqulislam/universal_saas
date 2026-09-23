"use client";

import React from "react";
import { SearchScope } from "../types";

interface SearchScopeBarProps {
  selectedScope: SearchScope;
  onSelectScope: (scope: SearchScope) => void;
}

const SCOPES: Array<{ id: SearchScope; label: string; icon: string }> = [
  { id: "GLOBAL", label: "All Records", icon: "🌐" },
  { id: "CRM", label: "CRM", icon: "👥" },
  { id: "SALES", label: "Sales Orders", icon: "💼" },
  { id: "INVENTORY", label: "Inventory", icon: "📦" },
  { id: "WAREHOUSE", label: "Warehouses", icon: "🏭" },
  { id: "QUALITY", label: "Quality", icon: "🔬" },
  { id: "RETURNS", label: "Returns / RMA", icon: "🔄" },
  { id: "SERVICE", label: "Service", icon: "🛠️" },
  { id: "FINANCE", label: "Finance", icon: "💳" },
  { id: "WORKFLOWS", label: "Workflows", icon: "⚡" },
  { id: "NOTIFICATIONS", label: "Notifications", icon: "🔔" },
  { id: "USERS", label: "Team", icon: "👤" },
];

export const SearchScopeBar: React.FC<SearchScopeBarProps> = ({ selectedScope, onSelectScope }) => {
  return (
    <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-gray-200">
      {SCOPES.map((s) => {
        const isSelected = selectedScope === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelectScope(s.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
};
