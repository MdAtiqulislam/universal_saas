"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  SearchScope,
  SearchRecord,
  SavedViewItem,
  SearchHistoryItem,
  FavoriteItemRecord,
  SearchAlertItem,
  SearchAnalyticsSummary,
  SearchFilterNode,
} from "./types";
import {
  executeSearch,
  listSavedViews,
  createSavedView,
  deleteSavedView,
  getSearchHistory,
  clearSearchHistory,
  getFavorites,
  toggleFavorite,
  listSearchAlerts,
  getSearchAnalytics,
} from "./api/search-api";
import { SearchScopeBar } from "./components/SearchScopeBar";
import { SearchResultsView } from "./components/SearchResultsView";
import { AdvancedFilterBuilder } from "./components/AdvancedFilterBuilder";
import { SavedViewsPanel } from "./components/SavedViewsPanel";
import { SearchHistoryDrawer } from "./components/SearchHistoryDrawer";
import { FavoritesDrawer } from "./components/FavoritesDrawer";
import { SearchAlertsPanel } from "./components/SearchAlertsPanel";
import { SearchAnalyticsPanel } from "./components/SearchAnalyticsPanel";
import { GlobalSearchModal } from "./components/GlobalSearchModal";

export const SearchDashboard: React.FC = () => {
  // Search state
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("GLOBAL");
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<SearchFilterNode | undefined>();
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<
    "results" | "saved_views" | "history" | "favorites" | "alerts" | "analytics"
  >("results");

  // Data state
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [savedViews, setSavedViews] = useState<SavedViewItem[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItemRecord[]>([]);
  const [alerts, setAlerts] = useState<SearchAlertItem[]>([]);
  const [analytics, setAnalytics] = useState<SearchAnalyticsSummary | null>(null);

  // Set of favorited IDs for quick star lookup
  const favoritesSet = new Set(favorites.map((f) => `${f.resourceType}:${f.resourceId}`));

  // Load secondary data
  const loadAuxiliaryData = useCallback(() => {
    listSavedViews().then(setSavedViews);
    getSearchHistory().then(setHistory);
    getFavorites().then(setFavorites);
    listSearchAlerts().then(setAlerts);
    getSearchAnalytics().then(setAnalytics);
  }, []);

  useEffect(() => {
    loadAuxiliaryData();
  }, [loadAuxiliaryData]);

  // Execute search
  const runSearch = useCallback(
    async (currentPage = 1, currentQuery = query, currentScope = scope) => {
      setIsLoading(true);
      try {
        const res = await executeSearch({
          q: currentQuery.trim() || undefined,
          scope: currentScope,
          page: currentPage,
          filters: activeFilters,
          recordHistory: Boolean(currentQuery.trim()),
        });
        setRecords(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
        setExecutionTimeMs(res.meta.executionTimeMs);
      } finally {
        setIsLoading(false);
      }
    },
    [query, scope, activeFilters],
  );

  // Trigger search on parameter change
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        void runSearch(page, query, scope);
      }
    }, 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [page, scope, activeFilters, runSearch, query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    runSearch(1, query, scope);
    setActiveTab("results");
  };

  const handleScopeChange = (newScope: SearchScope) => {
    setScope(newScope);
    setPage(1);
  };

  const handleLoadSavedView = (view: SavedViewItem) => {
    setScope(view.scope);
    setQuery(view.queryText || "");
    setActiveFilters(view.filters);
    setPage(1);
    setActiveTab("results");
  };

  const handleCreateSavedView = async (data: Partial<SavedViewItem>) => {
    await createSavedView({
      ...data,
      queryText: query || undefined,
      filters: activeFilters,
    });
    listSavedViews().then(setSavedViews);
  };

  const handleDeleteSavedView = async (id: string) => {
    await deleteSavedView(id);
    listSavedViews().then(setSavedViews);
  };

  const handleToggleFavorite = async (rec: SearchRecord) => {
    await toggleFavorite({
      resourceType: rec.resourceType,
      resourceId: rec.id,
      title: rec.title,
      url: rec.url,
    });
    getFavorites().then(setFavorites);
  };

  const handleClearHistory = async () => {
    await clearSearchHistory();
    setHistory([]);
  };

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Unified Search & Discovery</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Cross-domain search, custom saved views, structured AST filters & alerts
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium border border-gray-300 shadow-sm transition-colors"
        >
          <span>Spotlight Search</span>
          <kbd className="bg-white px-1.5 py-0.5 rounded border border-gray-300 text-[10px] text-gray-500 font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Main Search Input & Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all modules (customers, orders, inventory, tickets, invoices)..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => setShowFilterBuilder(!showFilterBuilder)}
            className={`px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${
              showFilterBuilder || activeFilters
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {activeFilters ? "Filters Active (1) ▼" : "Filters ▼"}
          </button>
        </form>

        {/* Advanced Filter Builder Collapsible */}
        {showFilterBuilder && (
          <AdvancedFilterBuilder
            onApplyFilters={(f) => {
              setActiveFilters(f);
              setPage(1);
            }}
            onClose={() => setShowFilterBuilder(false)}
          />
        )}

        {/* Scope Pill Bar */}
        <SearchScopeBar selectedScope={scope} onSelectScope={handleScopeChange} />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6 text-xs font-medium">
          {[
            { id: "results", label: `Results (${total})` },
            { id: "saved_views", label: `Saved Views (${savedViews.length})` },
            { id: "history", label: `Recent Searches (${history.length})` },
            { id: "favorites", label: `Favorites (${favorites.length})` },
            { id: "alerts", label: `Alerts (${alerts.length})` },
            { id: "analytics", label: "Analytics" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(
                  tab.id as
                    "results" | "saved_views" | "history" | "favorites" | "alerts" | "analytics",
                )
              }
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "results" && (
          <SearchResultsView
            records={records}
            isLoading={isLoading}
            total={total}
            page={page}
            limit={20}
            totalPages={totalPages}
            executionTimeMs={executionTimeMs}
            onPageChange={setPage}
            onToggleFavorite={handleToggleFavorite}
            favoritesSet={favoritesSet}
          />
        )}

        {activeTab === "saved_views" && (
          <SavedViewsPanel
            savedViews={savedViews}
            onSelectView={handleLoadSavedView}
            onCreateView={handleCreateSavedView}
            onDeleteView={handleDeleteSavedView}
          />
        )}

        {activeTab === "history" && (
          <SearchHistoryDrawer
            history={history}
            onSelectQuery={(q) => {
              setQuery(q);
              setActiveTab("results");
            }}
            onClearHistory={handleClearHistory}
          />
        )}

        {activeTab === "favorites" && (
          <FavoritesDrawer
            favorites={favorites}
            onRemoveFavorite={(fav) => {
              void toggleFavorite({
                resourceType: fav.resourceType,
                resourceId: fav.resourceId,
                title: fav.title,
                url: fav.url,
              }).then(() => {
                void getFavorites().then(setFavorites);
              });
            }}
          />
        )}

        {activeTab === "alerts" && (
          <SearchAlertsPanel
            alerts={alerts}
            savedViews={savedViews}
            onCreateAlert={async (data) => {
              // API call can be hooked up here
              listSearchAlerts().then(setAlerts);
            }}
          />
        )}

        {activeTab === "analytics" && analytics && <SearchAnalyticsPanel analytics={analytics} />}
      </div>

      {/* Cmd+K Global Search Modal */}
      <GlobalSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onNavigate={(url) => {
          window.location.href = url;
        }}
        onSearchSubmit={(q, s) => {
          setQuery(q);
          setScope(s);
          setPage(1);
          setActiveTab("results");
        }}
      />
    </div>
  );
};
