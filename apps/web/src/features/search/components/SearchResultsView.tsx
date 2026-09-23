"use client";

import React from "react";
import { SearchRecord } from "../types";

interface SearchResultsViewProps {
  records: SearchRecord[];
  isLoading: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  executionTimeMs: number;
  onPageChange: (newPage: number) => void;
  onToggleFavorite?: (record: SearchRecord) => void;
  favoritesSet?: Set<string>;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  records,
  isLoading,
  total,
  page,
  totalPages,
  executionTimeMs,
  onPageChange,
  onToggleFavorite,
  favoritesSet = new Set(),
}) => {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
        <p className="text-sm">Searching records across systems...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <div className="text-3xl mb-2">🔍</div>
        <h3 className="text-base font-semibold text-gray-800">No records found</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
          Try expanding your search query or switching to &apos;All Records&apos; scope.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Meta Bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>
          Found <strong>{total}</strong> matching record{total === 1 ? "" : "s"} in{" "}
          <strong>{executionTimeMs}ms</strong>
        </span>
        <span>
          Page {page} of {totalPages || 1}
        </span>
      </div>

      {/* Results List */}
      <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg shadow-sm">
        {records.map((rec) => {
          const isFavorited = favoritesSet.has(`${rec.resourceType}:${rec.id}`);

          return (
            <div
              key={`${rec.resourceType}-${rec.id}`}
              className="p-4 hover:bg-gray-50/80 transition-colors flex items-start justify-between group"
            >
              <div className="space-y-1 pr-4 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                    {rec.resourceType}
                  </span>
                  <a
                    href={rec.url}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
                  >
                    {rec.title}
                  </a>
                  {rec.score && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      Score: {rec.score}
                    </span>
                  )}
                </div>

                {rec.subtitle && (
                  <p className="text-xs text-gray-600 font-medium">{rec.subtitle}</p>
                )}

                {rec.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">{rec.description}</p>
                )}

                <div className="text-[11px] text-gray-400 pt-1">
                  Scope: {rec.scope} • Created: {new Date(rec.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {onToggleFavorite && (
                  <button
                    onClick={() => onToggleFavorite(rec)}
                    title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                    className={`p-1.5 rounded transition-colors ${
                      isFavorited
                        ? "text-yellow-500 hover:bg-yellow-50"
                        : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    ★
                  </button>
                )}
                <a
                  href={rec.url}
                  className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  View →
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
