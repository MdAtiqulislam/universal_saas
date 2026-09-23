"use client";

import React, { useState, useEffect } from "react";
import { ApiVersionInfo } from "../types";
import { getApiVersions } from "../api/developer-api";

export const ApiVersionPanel: React.FC = () => {
  const [versions, setVersions] = useState<ApiVersionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getApiVersions()
      .then((res) => {
        if (!ignore) {
          setVersions(res);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error("Failed to load version info:", err);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-xs text-gray-500">Loading version information...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          API Release Versions & Lifecycle
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Current platform API gateways, stability classifications, and retirement schedules.
        </p>

        <div className="mt-4 space-y-4">
          {versions.map((ver) => (
            <div
              key={ver.version}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-base font-bold text-gray-900 dark:text-gray-100">
                    /api/{ver.version}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      ver.status === "stable"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {ver.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{ver.description}</p>
              </div>

              <div className="text-right text-xs text-gray-500">
                <div>
                  Released: <strong>{ver.releaseDate}</strong>
                </div>
                {ver.deprecated && (
                  <div className="text-red-500 font-semibold">
                    Sunset: {ver.sunsetDate || "TBD"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deprecation & Stability Policy */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Deprecation & Breaking Change Policy
        </h3>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
          <li>
            <strong>Non-breaking additions:</strong> New properties, endpoints, and optional
            parameters may be introduced into <code>v1</code> at any time without version
            increments.
          </li>
          <li>
            <strong>Deprecation notice:</strong> Endpoints slated for retirement will return
            standard <code>Sunset</code> and <code>Deprecation</code> HTTP headers at least 6 months
            prior to removal.
          </li>
          <li>
            <strong>Breaking changes:</strong> Any field removal, type modification, or mandatory
            parameter addition will always be introduced under a new version prefix (e.g.{" "}
            <code>/api/v2</code>).
          </li>
        </ul>
      </div>
    </div>
  );
};
