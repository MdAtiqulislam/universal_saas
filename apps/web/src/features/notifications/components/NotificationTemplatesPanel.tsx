import React, { useState } from "react";
import { NotificationTemplateItem } from "../types";

interface NotificationTemplatesPanelProps {
  templates: NotificationTemplateItem[];
}

export const NotificationTemplatesPanel: React.FC<NotificationTemplatesPanelProps> = ({
  templates,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplateItem | null>(
    templates[0] || null,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Template Catalog List */}
      <div className="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Template Catalog</h2>
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {templates.length}
          </span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
          {templates.map((tmpl) => {
            const isSelected = selectedTemplate?.id === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`w-full text-left p-4 transition-colors ${
                  isSelected
                    ? "bg-blue-50/50 dark:bg-blue-900/20 border-l-4 border-blue-600"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {tmpl.name}
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                    v{tmpl.currentVersion}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                  {tmpl.templateKey}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Detail & Preview */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs p-6">
        {selectedTemplate ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedTemplate.name}
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Key: {selectedTemplate.templateKey} • Status: {selectedTemplate.status}
                </p>
                {selectedTemplate.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                    {selectedTemplate.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  Version {selectedTemplate.currentVersion} Published
                </span>
              </div>
            </div>

            {/* Version Snapshot */}
            {selectedTemplate.versions && selectedTemplate.versions.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Published Version Snapshot
                </h4>
                {selectedTemplate.versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3 border border-gray-100 dark:border-gray-800 text-xs"
                  >
                    {ver.subject && (
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                          Subject Template:
                        </span>
                        <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 block font-mono">
                          {ver.subject}
                        </code>
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Body Template:
                      </span>
                      <pre className="bg-white dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 font-mono text-xs whitespace-pre-wrap">
                        {ver.body}
                      </pre>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <span className="font-semibold">Channels:</span> {ver.channels.join(", ")}
                      </div>
                      <div>
                        <span className="font-semibold">Integrity SHA-256:</span>{" "}
                        <span className="font-mono">{ver.integrityHash.substring(0, 16)}...</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-gray-500">
            Select a template to view details and version history.
          </div>
        )}
      </div>
    </div>
  );
};
