"use client";

import React, { useState, useEffect, useRef } from "react";
import { SearchScope, SuggestionItem, RecentItemRecord } from "../types";
import { getSearchSuggestions, getRecentItems } from "../api/search-api";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onSearchSubmit: (query: string, scope: SearchScope) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSearchSubmit,
}) => {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("GLOBAL");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItemRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      void getRecentItems().then(setRecentItems);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setSuggestions([]);
      } else {
        void getSearchSuggestions(query.trim(), scope).then(setSuggestions);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query, scope]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearchSubmit(query.trim(), scope);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Header */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center px-4 py-3 border-b border-gray-200"
        >
          <span className="text-gray-400 text-lg mr-3">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all records, orders, inventory, tickets... (Press Enter to search)"
            className="w-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-gray-400 hover:text-gray-600 text-xs px-2"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xs border border-gray-200 rounded px-1.5 py-0.5 ml-2"
          >
            ESC
          </button>
        </form>

        {/* Scope selector */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center space-x-2 text-xs overflow-x-auto">
          <span className="text-gray-400">Scope:</span>
          {(["GLOBAL", "CRM", "SALES", "INVENTORY", "FINANCE", "SERVICE"] as SearchScope[]).map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  scope === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {s}
              </button>
            ),
          )}
        </div>

        {/* Suggestions or Recent List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-gray-50">
          {query.trim() && suggestions.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-gray-400 px-3 py-1 uppercase tracking-wider">
                Instant Suggestions
              </div>
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (sug.url) onNavigate(sug.url);
                    else onSearchSubmit(sug.text, sug.scope);
                    onClose();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                      {sug.resourceType}
                    </span>
                    <span className="text-sm text-gray-800 group-hover:text-blue-600 font-medium">
                      {sug.text}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-blue-500">Jump →</span>
                </div>
              ))}
            </div>
          ) : !query.trim() && recentItems.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-gray-400 px-3 py-1 uppercase tracking-wider">
                Recently Viewed Records
              </div>
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.url);
                    onClose();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {item.resourceType}
                    </span>
                    <span className="text-gray-800 font-medium">{item.title}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {new Date(item.viewedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-gray-400">
              Type a keyword to discover cross-module records or jump to entities.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span>Search spans CRM, Sales, Inventory, Warehouse, Finance & more</span>
          <span>Press Enter to view full results</span>
        </div>
      </div>
    </div>
  );
};
