"use client";

import React, { useState, useEffect } from "react";
import {
  NotificationStatsData,
  NotificationItem,
  NotificationTemplateItem,
  NotificationPreferenceItem,
  CommunicationProviderItem,
  NotificationScheduleItem,
} from "./types";
import {
  getNotificationOverview,
  listNotifications,
  listTemplates,
  getPreferences,
  updatePreferences,
  listProviders,
  listSchedules,
  markNotificationRead,
  markAllNotificationsRead,
} from "./api/notifications-api";

import { NotificationKpiRibbon } from "./components/NotificationKpiRibbon";
import { NotificationCenterPanel } from "./components/NotificationCenterPanel";
import { NotificationTemplatesPanel } from "./components/NotificationTemplatesPanel";
import { NotificationPreferencesPanel } from "./components/NotificationPreferencesPanel";
import { NotificationProvidersPanel } from "./components/NotificationProvidersPanel";
import { NotificationDeliveriesPanel } from "./components/NotificationDeliveriesPanel";
import { NotificationSchedulesPanel } from "./components/NotificationSchedulesPanel";
import { NotificationReportsPanel } from "./components/NotificationReportsPanel";

type TabType =
  | "OVERVIEW"
  | "INBOX"
  | "TEMPLATES"
  | "DELIVERIES"
  | "PREFERENCES"
  | "PROVIDERS"
  | "SCHEDULES"
  | "REPORTS";

export const NotificationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("OVERVIEW");
  const [stats, setStats] = useState<NotificationStatsData | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplateItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferenceItem | null>(null);
  const [providers, setProviders] = useState<CommunicationProviderItem[]>([]);
  const [schedules, setSchedules] = useState<NotificationScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getNotificationOverview(),
      listNotifications(),
      listTemplates(),
      getPreferences(),
      listProviders(),
      listSchedules(),
    ])
      .then(([st, notifs, tmpls, prefs, provs, scheds]) => {
        if (!mounted) return;
        setStats(st);
        setNotifications(notifs);
        setTemplates(tmpls);
        setPreferences(prefs);
        setProviders(provs);
        setSchedules(scheds);
        setIsLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "DELIVERED" } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  const handleSavePreferences = async (updated: Partial<NotificationPreferenceItem>) => {
    const res = await updatePreferences(updated);
    setPreferences(res);
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "OVERVIEW", label: "Overview" },
    { key: "INBOX", label: "Notification Center" },
    { key: "TEMPLATES", label: "Templates" },
    { key: "DELIVERIES", label: "Deliveries" },
    { key: "PREFERENCES", label: "Preferences" },
    { key: "PROVIDERS", label: "Providers" },
    { key: "SCHEDULES", label: "Schedules" },
    { key: "REPORTS", label: "Analytics & SLA" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Notifications & Omnichannel Messaging
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            M43 Platform — In-app, Email, Push, and SMS routing with safe template rendering and
            quiet hours
          </p>
        </div>
      </div>

      {/* Top KPI Ribbon */}
      <NotificationKpiRibbon stats={stats} isLoading={isLoading} />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-6 overflow-x-auto pb-px" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-xs transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          <NotificationCenterPanel
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
          <NotificationReportsPanel stats={stats} />
        </div>
      )}

      {activeTab === "INBOX" && (
        <NotificationCenterPanel
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}

      {activeTab === "TEMPLATES" && <NotificationTemplatesPanel templates={templates} />}

      {activeTab === "DELIVERIES" && <NotificationDeliveriesPanel notifications={notifications} />}

      {activeTab === "PREFERENCES" && (
        <NotificationPreferencesPanel preferences={preferences} onSave={handleSavePreferences} />
      )}

      {activeTab === "PROVIDERS" && <NotificationProvidersPanel providers={providers} />}

      {activeTab === "SCHEDULES" && <NotificationSchedulesPanel schedules={schedules} />}

      {activeTab === "REPORTS" && <NotificationReportsPanel stats={stats} />}
    </div>
  );
};
