import React from "react";
import { CommunicationProviderItem } from "../types";

interface NotificationProvidersPanelProps {
  providers: CommunicationProviderItem[];
}

export const NotificationProvidersPanel: React.FC<NotificationProvidersPanelProps> = ({
  providers,
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Omnichannel Provider Adapters & Routing
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Active gateway adapters, primary routing, and automatic failover configuration
          </p>
        </div>
        <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full font-medium">
          Failover Enabled
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Provider Name</th>
              <th className="px-4 py-3">Adapter Key</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Health Status</th>
              <th className="px-4 py-3">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {providers.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                  <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">
                    {p.channel}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                <td className="px-4 py-3 font-mono text-gray-500">{p.providerKey}</td>
                <td className="px-4 py-3">
                  {p.isPrimary ? (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">Primary</span>
                  ) : (
                    <span className="text-gray-500">Fallback</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">
                  #{p.priority}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {p.healthStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.isEnabled
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p.isEnabled ? "ACTIVE" : "DISABLED"}
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
