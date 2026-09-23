import React from "react";
import { FilterNode } from "../types";

interface AnalyticsFilterBuilderProps {
  allowedFields: string[];
  filterAst?: FilterNode;
  onChange: (ast?: FilterNode) => void;
}

export const AnalyticsFilterBuilder: React.FC<AnalyticsFilterBuilderProps> = ({
  allowedFields,
  filterAst,
  onChange,
}) => {
  const leaves: FilterNode[] = filterAst?.and || (filterAst?.field ? [filterAst] : []);

  const addFilter = () => {
    if (allowedFields.length === 0) return;
    const newLeaf: FilterNode = {
      field: allowedFields[0],
      operator: "eq",
      value: "",
    };
    const updated = [...leaves, newLeaf];
    onChange({ and: updated });
  };

  const updateFilter = (index: number, updatedNode: FilterNode) => {
    const updated = [...leaves];
    updated[index] = updatedNode;
    onChange({ and: updated });
  };

  const removeFilter = (index: number) => {
    const updated = leaves.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? { and: updated } : undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <span>Filters (AST)</span>
        <button
          type="button"
          onClick={addFilter}
          className="text-blue-600 hover:text-blue-800 font-medium normal-case"
        >
          + Add Filter
        </button>
      </div>

      {leaves.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No filters applied (all records in scope)</p>
      ) : (
        <div className="space-y-1.5">
          {leaves.map((node, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-md border border-gray-200 text-xs"
            >
              <select
                value={node.field || allowedFields[0]}
                onChange={(e) => updateFilter(i, { ...node, field: e.target.value })}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800"
              >
                {allowedFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <select
                value={node.operator || "eq"}
                onChange={(e) => updateFilter(i, { ...node, operator: e.target.value })}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 font-mono"
              >
                <option value="eq">==</option>
                <option value="neq">!=</option>
                <option value="gt">&gt;</option>
                <option value="gte">&gt;=</option>
                <option value="lt">&lt;</option>
                <option value="lte">&lt;=</option>
                <option value="contains">contains</option>
                <option value="isNull">is null</option>
                <option value="isNotNull">is not null</option>
              </select>

              {!["isNull", "isNotNull"].includes(node.operator || "") && (
                <input
                  type="text"
                  placeholder="Value..."
                  value={node.value !== undefined ? String(node.value) : ""}
                  onChange={(e) => updateFilter(i, { ...node, value: e.target.value })}
                  className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 flex-1"
                />
              )}

              <button
                type="button"
                onClick={() => removeFilter(i)}
                className="text-red-500 hover:text-red-700 px-1 font-bold"
                title="Remove filter"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
