import React, { useState } from "react";
import { NotificationItem } from "../types";

interface NotificationCenterPanelProps {
  notifications: NotificationItem[];
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

export const NotificationCenterPanel: React.FC<NotificationCenterPanelProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
}) => {
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const handleMarkOne = async (id: string) => {
    await onMarkRead(id);
    setReadIds((prev) => new Set([...prev, id]));
  };

  const handleMarkAll = async () => {
    await onMarkAllRead();
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  const filtered = notifications.filter((n) => {
    if (filter === "UNREAD") {
      return !readIds.has(n.id);
    }
    return true;
  });

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            In-App Notification Center
          </h2>
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
            {notifications.length} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 text-xs">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "ALL"
                  ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("UNREAD")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "UNREAD"
                  ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Unread
            </button>
          </div>
          <button
            onClick={handleMarkAll}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium px-2 py-1"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No notifications to display in this view.
          </div>
        ) : (
          filtered.map((item) => {
            const isRead = readIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                  isRead
                    ? "bg-white dark:bg-gray-900 opacity-75"
                    : "bg-blue-50/20 dark:bg-blue-950/10"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isRead ? "bg-gray-300 dark:bg-gray-700" : "bg-blue-600"
                      }`}
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.title || item.eventType}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        item.priority === "URGENT"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 pl-4">
                    {item.content || "No content provided"}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 pl-4">
                    {new Date(item.createdAt).toLocaleString()} • Event: {item.eventType}
                  </p>
                </div>

                {!isRead && (
                  <button
                    onClick={() => handleMarkOne(item.id)}
                    className="shrink-0 text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 transition-colors"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
