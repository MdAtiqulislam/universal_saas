import React, { useState } from "react";
import { NotificationPreferenceItem } from "../types";

interface NotificationPreferencesPanelProps {
  preferences: NotificationPreferenceItem | null;
  onSave: (updated: Partial<NotificationPreferenceItem>) => Promise<void>;
}

export const NotificationPreferencesPanel: React.FC<NotificationPreferencesPanelProps> = ({
  preferences,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<NotificationPreferenceItem>>({
    inAppEnabled: preferences?.inAppEnabled ?? true,
    emailEnabled: preferences?.emailEnabled ?? true,
    pushEnabled: preferences?.pushEnabled ?? true,
    smsEnabled: preferences?.smsEnabled ?? false,
    quietHoursEnabled: preferences?.quietHoursEnabled ?? false,
    quietHoursStartUtc: preferences?.quietHoursStartUtc ?? "22:00",
    quietHoursEndUtc: preferences?.quietHoursEndUtc ?? "07:00",
    timezone: preferences?.timezone ?? "UTC",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave(formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs max-w-3xl">
      <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Recipient Communication Preferences & Quiet Hours
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Configure enabled delivery channels and quiet hours windows. Security alerts automatically
          bypass quiet hours.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Channel Toggles */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Enabled Channels
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: "inAppEnabled",
                label: "In-App Notifications",
                desc: "Real-time notifications in header",
              },
              {
                key: "emailEnabled",
                label: "Email Notifications",
                desc: "Summary and transactional emails",
              },
              {
                key: "pushEnabled",
                label: "Push Notifications",
                desc: "Browser and mobile push alerts",
              },
              { key: "smsEnabled", label: "SMS Messages", desc: "Critical alerts via E.164 SMS" },
            ].map(({ key, label, desc }) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-800 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={Boolean(formData[key as keyof NotificationPreferenceItem])}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-medium text-gray-900 dark:text-white block">
                    {label}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Quiet Hours Window */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Quiet Hours Configuration
              </h3>
              <p className="text-xs text-gray-500">
                Suppress non-urgent notifications during off-hours. Supports midnight crossing.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.quietHoursEnabled}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    quietHoursEnabled: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {formData.quietHoursEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Time (UTC)
                </label>
                <input
                  type="text"
                  placeholder="22:00"
                  value={formData.quietHoursStartUtc || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quietHoursStartUtc: e.target.value,
                    }))
                  }
                  className="w-full text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Time (UTC)
                </label>
                <input
                  type="text"
                  placeholder="07:00"
                  value={formData.quietHoursEndUtc || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quietHoursEndUtc: e.target.value,
                    }))
                  }
                  className="w-full text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={formData.timezone || "UTC"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      timezone: e.target.value,
                    }))
                  }
                  className="w-full text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
          {savedSuccess ? (
            <span className="text-xs text-emerald-600 font-medium">
              Preferences updated successfully!
            </span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
};
