"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { WarehouseStockPosition } from "../types/warehouse.types";

export function WarehouseStock() {
  const [positions, setPositions] = useState<WarehouseStockPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const res = await warehouseApi.getStockPositions({
        search: search || undefined,
        page,
        limit: 25,
      });
      setPositions(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load stock positions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPositions();
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Search by SKU, Item Name, Location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </form>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPositions()}
            className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium transition"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stock Positions Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Location / Bin</th>
                <th className="px-4 py-3 font-semibold">Location Type</th>
                <th className="px-4 py-3 font-semibold">Item SKU & Name</th>
                <th className="px-4 py-3 font-semibold text-right">On Hand</th>
                <th className="px-4 py-3 font-semibold text-right">Reserved</th>
                <th className="px-4 py-3 font-semibold text-right">Available</th>
                <th className="px-4 py-3 font-semibold text-right">Quarantined</th>
                <th className="px-4 py-3 font-semibold text-right">Damaged</th>
                <th className="px-4 py-3 font-semibold text-right">Staged</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Loading inventory positions...
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No stock positions found matching current criteria.
                  </td>
                </tr>
              ) : (
                positions.map((p, idx) => (
                  <tr
                    key={`${p.locationId}-${p.itemId}-${idx}`}
                    className="hover:bg-muted/30 transition"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="font-semibold text-foreground">{p.locationCode}</div>
                      <div className="text-xs text-muted-foreground">{p.locationName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
                        {p.locationType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.itemSku}</div>
                      <div className="text-xs text-muted-foreground">{p.itemName}</div>
                      {p.variantSku && (
                        <div className="text-xs text-primary font-mono">Var: {p.variantSku}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{p.onHand}</td>
                    <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">
                      {p.reserved}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      {p.available}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-600 dark:text-purple-400">
                      {p.quarantined}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">
                      {p.damaged}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
                      {p.staged}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing {positions.length} of {total} records
          </div>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded hover:bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded hover:bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
