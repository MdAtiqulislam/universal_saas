import React from "react";
import { NotificationItem } from "../types";

interface NotificationDeliveriesPanelProps {
  notifications: NotificationItem[];
}

export const NotificationDeliveriesPanel: React.FC<NotificationDeliveriesPanelProps> = ({
  notifications,
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Delivery Log & Attempt Tracking
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time delivery status, transient retries, and audit confirmation
          </p>
        </div>
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 px-2.5 py-1 rounded-full font-medium">
          {notifications.length} dispatches logged
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">Event / Intent</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Deliveries</th>
              <th className="px-4 py-3">Dispatched At</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.map((notif) => (
              <tr key={notif.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {notif.title || notif.eventType}
                  </div>
                  <div className="text-[11px] font-mono text-gray-400">ID: {notif.id}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      notif.priority === "URGENT"
                        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {notif.priority}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">{notif.recipientsCount ?? 1}</td>
                <td className="px-4 py-3 font-mono">{notif.deliveriesCount ?? 1}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(notif.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {notif.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
