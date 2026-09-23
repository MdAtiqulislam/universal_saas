"use client";

import React, { useState } from "react";
import { WorkflowDefinition, WorkflowNodeType, WorkflowRuleAst } from "./types";
import { RuleBuilderModal } from "./RuleBuilderModal";
import { createWorkflowVersion, publishWorkflowVersion } from "./api/workflows-api";

interface BuilderNode {
  nodeKey: string;
  name: string;
  nodeType: WorkflowNodeType;
  actionType?: string;
  ruleConfig?: Record<string, unknown>;
  approvalConfig?: Record<string, unknown>;
}

interface BuilderEdge {
  sourceNodeKey: string;
  targetNodeKey: string;
  conditionValue?: string;
  isDefault?: boolean;
}

interface WorkflowBuilderPanelProps {
  workflow: WorkflowDefinition;
  onVersionPublished: () => void;
  onClose: () => void;
}

export const WorkflowBuilderPanel: React.FC<WorkflowBuilderPanelProps> = ({
  workflow,
  onVersionPublished,
  onClose,
}) => {
  const [nodes, setNodes] = useState<BuilderNode[]>([
    { nodeKey: "start_1", name: "Start", nodeType: "START" },
    {
      nodeKey: "cond_1",
      name: "High Value Check",
      nodeType: "CONDITION",
      ruleConfig: {
        ast: { field: "order.amount", operator: "GREATER_THAN", value: 1000 },
      },
    },
    {
      nodeKey: "app_1",
      name: "Manager Approval",
      nodeType: "APPROVAL",
      approvalConfig: { approverRole: "MANAGER", approvalType: "ANY_ONE" },
    },
    {
      nodeKey: "act_notify",
      name: "Send Notification",
      nodeType: "ACTION",
      actionType: "create_notification",
    },
    { nodeKey: "end_1", name: "End", nodeType: "END" },
  ]);

  const [edges, setEdges] = useState<BuilderEdge[]>([
    { sourceNodeKey: "start_1", targetNodeKey: "cond_1" },
    { sourceNodeKey: "cond_1", targetNodeKey: "app_1", conditionValue: "true" },
    { sourceNodeKey: "cond_1", targetNodeKey: "act_notify", conditionValue: "false" },
    { sourceNodeKey: "app_1", targetNodeKey: "act_notify" },
    { sourceNodeKey: "act_notify", targetNodeKey: "end_1" },
  ]);

  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(
    null,
  );

  const selectedNode = nodes.find((n) => n.nodeKey === selectedNodeKey);

  const handleAddNode = () => {
    const key = `node_${Date.now().toString().slice(-4)}`;
    setNodes((prev) => [
      ...prev,
      {
        nodeKey: key,
        name: `New Action`,
        nodeType: "ACTION",
        actionType: "create_notification",
      },
    ]);
  };

  const handleRemoveNode = (key: string) => {
    if (key === "start_1" || key === "end_1") {
      alert("Cannot delete START or END node");
      return;
    }
    setNodes((prev) => prev.filter((n) => n.nodeKey !== key));
    setEdges((prev) => prev.filter((e) => e.sourceNodeKey !== key && e.targetNodeKey !== key));
    if (selectedNodeKey === key) setSelectedNodeKey(null);
  };

  const handleAddEdge = () => {
    if (nodes.length < 2) return;
    setEdges((prev) => [
      ...prev,
      {
        sourceNodeKey: nodes[0].nodeKey,
        targetNodeKey: nodes[1].nodeKey,
      },
    ]);
  };

  const handleRemoveEdge = (idx: number) => {
    setEdges((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAndPublish = async () => {
    try {
      setIsSaving(true);
      setStatusMessage(null);

      // Create new draft version
      const newVersion = await createWorkflowVersion(workflow.id, {
        description: `Version published via UI at ${new Date().toLocaleTimeString()}`,
        nodes: nodes.map((n, i) => ({
          nodeKey: n.nodeKey,
          name: n.name,
          nodeType: n.nodeType,
          actionType: n.actionType,
          ruleConfig: n.ruleConfig,
          approvalConfig: n.approvalConfig,
          positionX: (i + 1) * 120,
          positionY: 100,
        })),
        edges: edges.map((e) => ({
          sourceNodeKey: e.sourceNodeKey,
          targetNodeKey: e.targetNodeKey,
          conditionValue: e.conditionValue,
          isDefault: e.isDefault ?? false,
        })),
      });

      // Publish the version
      await publishWorkflowVersion(workflow.id, newVersion.id);

      setStatusMessage({ text: `Version #${newVersion.versionNumber} successfully published!` });
      setTimeout(() => {
        onVersionPublished();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ text: msg || "Failed to save and publish version", error: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Workflow Graph Builder: {workflow.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Key: <code className="font-mono">{workflow.key}</code> | Category: {workflow.category}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to List
          </button>
          <button
            type="button"
            onClick={handleSaveAndPublish}
            disabled={isSaving}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? "Publishing..." : "Publish Version"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-md p-3 text-sm font-medium ${
            statusMessage.error
              ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* DAG Visualization Canvas */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Workflow Topology Pipeline
          </h3>
          <span className="text-xs text-gray-400">
            {nodes.length} Nodes &bull; {edges.length} Directed Transitions
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-4">
          {nodes.map((node, index) => (
            <React.Fragment key={node.nodeKey}>
              <div
                onClick={() => setSelectedNodeKey(node.nodeKey)}
                className={`cursor-pointer rounded-lg border p-3 text-center shadow-sm transition ${
                  selectedNodeKey === node.nodeKey
                    ? "border-blue-500 ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/40"
                    : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                }`}
                style={{ minWidth: "140px" }}
              >
                <span
                  className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    node.nodeType === "START"
                      ? "bg-green-100 text-green-800"
                      : node.nodeType === "END"
                        ? "bg-gray-200 text-gray-800"
                        : node.nodeType === "CONDITION"
                          ? "bg-purple-100 text-purple-800"
                          : node.nodeType === "APPROVAL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {node.nodeType}
                </span>
                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {node.name}
                </div>
                <div className="text-[11px] font-mono text-gray-400">{node.nodeKey}</div>
              </div>
              {index < nodes.length - 1 && (
                <div className="text-gray-400 font-bold text-lg">&rarr;</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Nodes Management */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Graph Nodes ({nodes.length})
            </h3>
            <button
              type="button"
              onClick={handleAddNode}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              + Add Node
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {nodes.map((node) => (
              <div
                key={node.nodeKey}
                className="flex items-center justify-between rounded border border-gray-200 p-2.5 dark:border-gray-700"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {node.nodeKey}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase dark:bg-gray-700">
                      {node.nodeType}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={node.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNodes((prev) =>
                        prev.map((n) => (n.nodeKey === node.nodeKey ? { ...n, name: val } : n)),
                      );
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  {node.nodeType === "CONDITION" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNodeKey(node.nodeKey);
                        setIsRuleModalOpen(true);
                      }}
                      className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700"
                    >
                      Edit Rule
                    </button>
                  )}
                  {node.nodeType !== "START" && node.nodeType !== "END" && (
                    <button
                      type="button"
                      onClick={() => handleRemoveNode(node.nodeKey)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Directed Edges Management */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Transitions & Edges ({edges.length})
            </h3>
            <button
              type="button"
              onClick={handleAddEdge}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              + Add Edge
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {edges.map((edge, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded border border-gray-200 p-2.5 dark:border-gray-700"
              >
                <div className="flex items-center space-x-2">
                  <select
                    value={edge.sourceNodeKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEdges((prev) =>
                        prev.map((eg, i) => (i === idx ? { ...eg, sourceNodeKey: val } : eg)),
                      );
                    }}
                    className="rounded border border-gray-300 p-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {nodes.map((n) => (
                      <option key={n.nodeKey} value={n.nodeKey}>
                        {n.name} ({n.nodeKey})
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-400">&rarr;</span>
                  <select
                    value={edge.targetNodeKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEdges((prev) =>
                        prev.map((eg, i) => (i === idx ? { ...eg, targetNodeKey: val } : eg)),
                      );
                    }}
                    className="rounded border border-gray-300 p-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {nodes.map((n) => (
                      <option key={n.nodeKey} value={n.nodeKey}>
                        {n.name} ({n.nodeKey})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Branch (e.g. true)"
                    value={edge.conditionValue || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEdges((prev) =>
                        prev.map((eg, i) => (i === idx ? { ...eg, conditionValue: val } : eg)),
                      );
                    }}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveEdge(idx)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isRuleModalOpen && selectedNode && (
        <RuleBuilderModal
          isOpen={isRuleModalOpen}
          initialRule={(selectedNode.ruleConfig?.ast as WorkflowRuleAst) || undefined}
          onSave={(rule) => {
            setNodes((prev) =>
              prev.map((n) =>
                n.nodeKey === selectedNode.nodeKey ? { ...n, ruleConfig: { ast: rule } } : n,
              ),
            );
          }}
          onClose={() => setIsRuleModalOpen(false)}
        />
      )}
    </div>
  );
};
