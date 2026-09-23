import React from "react";
import { NotificationStatsData } from "../types";

interface NotificationReportsPanelProps {
  stats: NotificationStatsData | null;
}

export const NotificationReportsPanel: React.FC<NotificationReportsPanelProps> = ({ stats }) => {
  const channelBreakdown = [
    {
      channel: "In-App",
      key: "IN_APP",
      color: "bg-blue-500",
      count: stats?.channelDistribution.IN_APP ?? 0,
    },
    {
      channel: "Email",
      key: "EMAIL",
      color: "bg-emerald-500",
      count: stats?.channelDistribution.EMAIL ?? 0,
    },
    {
      channel: "Push",
      key: "PUSH",
      color: "bg-purple-500",
      count: stats?.channelDistribution.PUSH ?? 0,
    },
    {
      channel: "SMS",
      key: "SMS",
      color: "bg-amber-500",
      count: stats?.channelDistribution.SMS ?? 0,
    },
  ];

  const total = channelBreakdown.reduce((acc, c) => acc + c.count, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Channel Distribution Breakdown */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Omnichannel Volume Distribution
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Proportion of delivered dispatches by communication channel
          </p>

          <div className="space-y-4">
            {channelBreakdown.map((item) => {
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {item.channel}
                    </span>
                    <span className="text-gray-500">
                      {item.count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA & Reliability Metrics */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Platform Reliability & SLA Health
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Delivery confirmation rates, failover telemetry, and drop prevention
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-xs text-gray-500 block">Delivery Rate</span>
              <span className="text-2xl font-bold text-emerald-600">
                {stats?.deliveryRate ?? 100}%
              </span>
              <span className="text-[11px] text-gray-400 block mt-1">Target: &gt; 98.0%</span>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-xs text-gray-500 block">Failed / Bounced</span>
              <span className="text-2xl font-bold text-rose-600">{stats?.failedCount ?? 0}</span>
              <span className="text-[11px] text-gray-400 block mt-1">Permanent rejections</span>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-xs text-gray-500 block">Active Adapters</span>
              <span className="text-2xl font-bold text-blue-600">4</span>
              <span className="text-[11px] text-gray-400 block mt-1">In-App, Email, Push, SMS</span>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
              <span className="text-xs text-gray-500 block">Dead-Letter Count</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">0</span>
              <span className="text-[11px] text-gray-400 block mt-1">Exhausted retry queues</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
