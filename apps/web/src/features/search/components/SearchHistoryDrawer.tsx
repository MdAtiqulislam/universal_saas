"use client";

import React from "react";
import { SearchHistoryItem } from "../types";

interface SearchHistoryDrawerProps {
  history: SearchHistoryItem[];
  onSelectQuery: (query: string) => void;
  onClearHistory: () => void;
}

export const SearchHistoryDrawer: React.FC<SearchHistoryDrawerProps> = ({
  history,
  onSelectQuery,
  onClearHistory,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          Recent Searches
        </h4>
        {history.length > 0 && (
          <button onClick={onClearHistory} className="text-xs text-gray-400 hover:text-red-600">
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">No search history yet.</p>
      ) : (
        <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg">
          {history.map((h) => (
            <div
              key={h.id}
              onClick={() => onSelectQuery(h.queryText)}
              className="p-2.5 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors text-xs"
            >
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">🕒</span>
                <span className="font-medium text-gray-800">{h.queryText}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {h.scope}
                </span>
              </div>
              <span className="text-gray-400 text-[11px]">{h.resultCount} results</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
