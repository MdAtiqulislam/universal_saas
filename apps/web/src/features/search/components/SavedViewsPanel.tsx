"use client";

import React, { useState } from "react";
import { SavedViewItem } from "../types";

interface SavedViewsPanelProps {
  savedViews: SavedViewItem[];
  onSelectView: (view: SavedViewItem) => void;
  onCreateView: (data: Partial<SavedViewItem>) => void;
  onDeleteView: (id: string) => void;
}

export const SavedViewsPanel: React.FC<SavedViewsPanelProps> = ({
  savedViews,
  onSelectView,
  onCreateView,
  onDeleteView,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PERSONAL" | "SHARED" | "TENANT">("PERSONAL");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateView({
      name: name.trim(),
      description: description.trim() || undefined,
      visibility,
      resourceType: "Customer",
      scope: "GLOBAL",
    });

    setName("");
    setDescription("");
    setIsCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Saved Views</h3>
          <p className="text-xs text-gray-500">
            Quickly switch between pre-configured filters and column sets
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {isCreating ? "Cancel" : "+ New Saved View"}
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <h4 className="text-xs font-semibold text-gray-700">
            Create Saved View from Current Filter
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">View Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Urgent RMAs"
                required
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "PERSONAL" | "SHARED" | "TENANT")}
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="PERSONAL">Personal (Private to Me)</option>
                <option value="SHARED">Shared (Selected Teammates)</option>
                <option value="TENANT">Tenant (Organization-wide)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or purpose"
              className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Save View
          </button>
        </form>
      )}

      {savedViews.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">
          No saved views yet. Create one to easily reload filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {savedViews.map((view) => (
            <div
              key={view.id}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-400 bg-white shadow-sm flex flex-col justify-between transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-900">{view.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      view.visibility === "TENANT"
                        ? "bg-purple-50 text-purple-700"
                        : view.visibility === "SHARED"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {view.visibility}
                  </span>
                </div>
                {view.description && (
                  <p className="text-xs text-gray-500 line-clamp-1">{view.description}</p>
                )}
                <div className="text-[11px] text-gray-400 mt-2">
                  Resource: {view.resourceType} • Scope: {view.scope}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => onSelectView(view)}
                  className="text-xs text-blue-600 font-medium hover:underline"
                >
                  Load View →
                </button>
                <button
                  onClick={() => onDeleteView(view.id)}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
