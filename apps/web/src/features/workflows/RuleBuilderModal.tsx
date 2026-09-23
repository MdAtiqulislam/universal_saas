"use client";

import React, { useState } from "react";
import { WorkflowRuleAst } from "./types";

interface RuleBuilderModalProps {
  isOpen: boolean;
  initialRule?: WorkflowRuleAst;
  onSave: (rule: WorkflowRuleAst) => void;
  onClose: () => void;
}

export const RuleBuilderModal: React.FC<RuleBuilderModalProps> = ({
  isOpen,
  initialRule,
  onSave,
  onClose,
}) => {
  const [field, setField] = useState(initialRule?.field || "order.totalAmount");
  const [operator, setOperator] = useState(initialRule?.operator || "GREATER_THAN");
  const [value, setValue] = useState(
    initialRule?.value !== undefined ? String(initialRule.value) : "1000",
  );
  const [testContext, setTestContext] = useState(
    '{\n  "order": {\n    "totalAmount": 1500\n  }\n}',
  );
  const [testResult, setTestResult] = useState<{ evaluated?: boolean; error?: string } | null>(
    null,
  );

  if (!isOpen) return null;

  const handleTest = () => {
    try {
      const parsed = JSON.parse(testContext);
      let numVal: unknown = value;
      if (!isNaN(Number(value))) {
        numVal = Number(value);
      } else if (value.toLowerCase() === "true") {
        numVal = true;
      } else if (value.toLowerCase() === "false") {
        numVal = false;
      }

      // Simple local evaluation preview
      const parts = field.split(".");
      let cur: unknown = parsed;
      for (const p of parts) {
        if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
        else cur = undefined;
      }

      let res = false;
      if (operator === "GREATER_THAN") res = Number(cur) > Number(numVal);
      else if (operator === "LESS_THAN") res = Number(cur) < Number(numVal);
      else if (operator === "EQUALS") res = cur === numVal;
      else if (operator === "NOT_EQUALS") res = cur !== numVal;
      else if (operator === "CONTAINS") res = String(cur).includes(String(numVal));
      else if (operator === "IN") res = Array.isArray(numVal) ? numVal.includes(cur) : false;

      setTestResult({ evaluated: res });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON context";
      setTestResult({ error: msg });
    }
  };

  const handleSave = () => {
    let numVal: unknown = value;
    if (!isNaN(Number(value))) {
      numVal = Number(value);
    } else if (value.toLowerCase() === "true") {
      numVal = true;
    } else if (value.toLowerCase() === "false") {
      numVal = false;
    }

    onSave({
      field,
      operator,
      value: numVal,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
          Rule Condition Builder (Declarative AST)
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Field Path
            </label>
            <input
              type="text"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="e.g. order.totalAmount"
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Operator
              </label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="EQUALS">EQUALS (==)</option>
                <option value="NOT_EQUALS">NOT_EQUALS (!=)</option>
                <option value="GREATER_THAN">GREATER_THAN (&gt;)</option>
                <option value="GREATER_THAN_OR_EQUAL">GREATER_THAN_OR_EQUAL (&gt;=)</option>
                <option value="LESS_THAN">LESS_THAN (&lt;)</option>
                <option value="LESS_THAN_OR_EQUAL">LESS_THAN_OR_EQUAL (&lt;=)</option>
                <option value="CONTAINS">CONTAINS</option>
                <option value="IN">IN (collection)</option>
                <option value="IS_NULL">IS_NULL</option>
                <option value="IS_NOT_NULL">IS_NOT_NULL</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Target Value
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="1000 or text"
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="border-t pt-3 dark:border-gray-700">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Test Context JSON
            </label>
            <textarea
              rows={4}
              value={testContext}
              onChange={(e) => setTestContext(e.target.value)}
              className="mt-1 w-full font-mono text-xs rounded border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTest}
                className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Test Condition
              </button>
              {testResult && (
                <span
                  className={`text-xs font-semibold ${
                    testResult.error
                      ? "text-red-600"
                      : testResult.evaluated
                        ? "text-green-600"
                        : "text-amber-600"
                  }`}
                >
                  {testResult.error
                    ? `Error: ${testResult.error}`
                    : `Evaluated: ${testResult.evaluated ? "TRUE" : "FALSE"}`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply Rule
          </button>
        </div>
      </div>
    </div>
  );
};
