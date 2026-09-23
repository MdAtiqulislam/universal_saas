import React from "react";
import { NotificationScheduleItem } from "../types";

interface NotificationSchedulesPanelProps {
  schedules: NotificationScheduleItem[];
}

export const NotificationSchedulesPanel: React.FC<NotificationSchedulesPanelProps> = ({
  schedules,
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Scheduled Dispatches & Future Jobs
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            INV-471: Guaranteed future dispatch via M36 JobService with idempotency
          </p>
        </div>
        <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-2.5 py-1 rounded-full font-medium">
          {schedules.length} Active Schedules
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">Schedule ID</th>
              <th className="px-4 py-3">Template Key</th>
              <th className="px-4 py-3">Channels</th>
              <th className="px-4 py-3">Target Recipients</th>
              <th className="px-4 py-3">Scheduled Delivery (UTC)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {schedules.map((sched) => (
              <tr key={sched.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-3 font-mono text-gray-500">{sched.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {sched.templateKey || "Direct Broadcast"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {sched.channels.map((ch) => (
                      <span
                        key={ch}
                        className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">{sched.recipientCount} users</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(sched.sendAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    {sched.status}
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
