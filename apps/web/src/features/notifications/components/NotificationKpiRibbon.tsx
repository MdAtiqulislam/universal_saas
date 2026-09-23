import React from "react";
import { NotificationStatsData } from "../types";

interface NotificationKpiRibbonProps {
  stats: NotificationStatsData | null;
  isLoading: boolean;
}

export const NotificationKpiRibbon: React.FC<NotificationKpiRibbonProps> = ({
  stats,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Dispatched",
      value: stats?.totalSent?.toLocaleString() ?? "0",
      subtitle: `${stats?.deliveredCount ?? 0} delivered successfully`,
      badge: `${stats?.deliveryRate ?? 100}% SLA`,
      badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    {
      title: "Active Templates",
      value: stats?.activeTemplates ?? 0,
      subtitle: "Published & versioned",
      badge: "SHA-256 Verified",
      badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    {
      title: "Scheduled Jobs",
      value: stats?.scheduledCount ?? 0,
      subtitle: "Queued for future delivery",
      badge: "Idempotent",
      badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    },
    {
      title: "In-App Unread",
      value: stats?.inAppUnreadCount ?? 0,
      subtitle: "Pending recipient review",
      badge: (stats?.inAppUnreadCount ?? 0) > 0 ? "Action Required" : "All Read",
      badgeColor:
        (stats?.inAppUnreadCount ?? 0) > 0
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {card.title}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
              {card.badge}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
};
