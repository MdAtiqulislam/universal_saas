"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { WarehouseZone } from "../types/warehouse.types";

export function WarehouseZones() {
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [locationId, setLocationId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [zoneType, setZoneType] = useState("STORAGE");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await warehouseApi.getZones({ search: search || undefined });
      setZones(res.data);
    } catch (err) {
      console.error("Failed to load zones", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await warehouseApi.createZone({
        locationId,
        code,
        name,
        zoneType,
        description,
      });
      setShowCreateModal(false);
      setLocationId("");
      setCode("");
      setName("");
      setDescription("");
      fetchZones();
    } catch (err: any) {
      alert(err.message || "Failed to create zone");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search zones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => fetchZones()}
            className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition"
          >
            + Add Zone
          </button>
        </div>
      </div>

      {/* Zones Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Zone Code</th>
              <th className="px-4 py-3 font-semibold">Zone Name</th>
              <th className="px-4 py-3 font-semibold">Warehouse / Location</th>
              <th className="px-4 py-3 font-semibold">Zone Type</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading warehouse zones...
                </td>
              </tr>
            ) : zones.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No warehouse zones created yet. Click "Add Zone" to define picking/storage zones.
                </td>
              </tr>
            ) : (
              zones.map((z) => (
                <tr key={z.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono font-bold text-primary">{z.code}</td>
                  <td className="px-4 py-3 font-medium">{z.name}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{z.location?.code || "-"}</div>
                    <div className="text-xs text-muted-foreground">{z.location?.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-muted font-medium">
                      {z.zoneType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {z.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        z.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {z.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Create Warehouse Zone</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Warehouse Location ID *</label>
                <input
                  type="text"
                  required
                  placeholder="UUID of Warehouse Location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Zone Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ZONE-A, BULK-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Zone Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bulk Pallet Racks A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Zone Type</label>
                <select
                  value={zoneType}
                  onChange={(e) => setZoneType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                >
                  <option value="STORAGE">STORAGE</option>
                  <option value="PICKING">PICKING</option>
                  <option value="BULK">BULK</option>
                  <option value="COLD_STORAGE">COLD_STORAGE</option>
                  <option value="HAZMAT">HAZMAT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  placeholder="Optional details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Save Zone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
