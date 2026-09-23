"use client";

import React, { useState, useEffect } from "react";
import {
  ShipmentDashboard,
  ShipmentList,
  ShipmentDetail,
  ShipmentCreateDialog,
  CarrierManagement,
  ShipmentReports,
  shippingApi,
  Shipment,
  ShipmentCarrier,
  ShipmentSummaryReport,
} from "@/features/shipping";

export default function ShippingPage() {
  const [activeTab, setActiveTab] = useState<"shipments" | "carriers" | "reports">("shipments");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Shipments state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [totalShipments, setTotalShipments] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingShipments, setLoadingShipments] = useState(true);

  // Summary and Carriers
  const [summary, setSummary] = useState<ShipmentSummaryReport | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [carriers, setCarriers] = useState<ShipmentCarrier[]>([]);
  const [loadingCarriers, setLoadingCarriers] = useState(true);

  const reloadSummary = () => {
    shippingApi
      .getSummaryReport()
      .then((data) => setSummary(data))
      .catch((err) => console.error("Failed to reload summary", err));
  };

  const reloadCarriers = () => {
    shippingApi
      .getCarriers({ limit: 100 })
      .then((data) => setCarriers(data.carriers || []))
      .catch((err) => console.error("Failed to reload carriers", err));
  };

  const reloadShipments = () => {
    shippingApi
      .getShipments({
        page,
        limit: 20,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      })
      .then((data) => {
        setShipments(data.shipments || []);
        setTotalShipments(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .catch((err) => console.error("Failed to reload shipments", err));
  };

  useEffect(() => {
    let isMounted = true;
    shippingApi
      .getSummaryReport()
      .then((data) => {
        if (isMounted) {
          setSummary(data);
          setLoadingSummary(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load summary", err);
        if (isMounted) setLoadingSummary(false);
      });

    shippingApi
      .getCarriers({ limit: 100 })
      .then((data) => {
        if (isMounted) {
          setCarriers(data.carriers || []);
          setLoadingCarriers(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load carriers", err);
        if (isMounted) setLoadingCarriers(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === "shipments") {
      shippingApi
        .getShipments({
          page,
          limit: 20,
          status: statusFilter || undefined,
          search: searchTerm || undefined,
        })
        .then((data) => {
          if (isMounted) {
            setShipments(data.shipments || []);
            setTotalShipments(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setLoadingShipments(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load shipments", err);
          if (isMounted) setLoadingShipments(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [activeTab, page, statusFilter, searchTerm]);

  const handleSelectShipment = async (s: Shipment) => {
    try {
      const full = await shippingApi.getShipment(s.id);
      setSelectedShipment(full);
    } catch {
      setSelectedShipment(s);
    }
  };

  const handleRefreshDetail = async () => {
    if (selectedShipment) {
      const updated = await shippingApi.getShipment(selectedShipment.id);
      setSelectedShipment(updated);
      reloadShipments();
      reloadSummary();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Shipment & Logistics
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Multi-tenant customer fulfillment dispatch, tracking, and carrier management
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
            >
              + Create Shipment
            </button>
          </div>
        </div>

        {/* Dashboard KPIs */}
        <ShipmentDashboard
          summary={summary}
          loading={loadingSummary}
          onFilterStatus={(st) => {
            setStatusFilter(st);
            setSelectedShipment(null);
            setActiveTab("shipments");
          }}
        />

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => {
              setSelectedShipment(null);
              setActiveTab("shipments");
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === "shipments" && !selectedShipment
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            All Shipments ({totalShipments})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedShipment(null);
              setActiveTab("carriers");
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === "carriers"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            Carriers ({carriers.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedShipment(null);
              setActiveTab("reports");
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === "reports"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            Logistics Reports
          </button>
        </div>

        {/* Tab Content */}
        {selectedShipment ? (
          <ShipmentDetail
            shipment={selectedShipment}
            carriers={carriers}
            onBack={() => setSelectedShipment(null)}
            onRefresh={handleRefreshDetail}
          />
        ) : activeTab === "shipments" ? (
          <ShipmentList
            shipments={shipments}
            loading={loadingShipments}
            onSelectShipment={handleSelectShipment}
            statusFilter={statusFilter}
            onStatusFilterChange={(st) => {
              setStatusFilter(st);
              setPage(1);
            }}
            searchTerm={searchTerm}
            onSearchChange={(search) => {
              setSearchTerm(search);
              setPage(1);
            }}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : activeTab === "carriers" ? (
          <CarrierManagement
            carriers={carriers}
            loading={loadingCarriers}
            onRefresh={reloadCarriers}
          />
        ) : (
          <ShipmentReports />
        )}

        {/* Create Dialog */}
        {showCreateModal && (
          <ShipmentCreateDialog
            carriers={carriers}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              reloadShipments();
              reloadSummary();
            }}
          />
        )}
      </div>
    </div>
  );
}
