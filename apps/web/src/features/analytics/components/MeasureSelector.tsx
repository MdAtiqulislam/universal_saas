import React from "react";
import { MeasureDefinition, MeasureQueryItem } from "../types";

interface MeasureSelectorProps {
  availableMeasures: MeasureDefinition[];
  selectedMeasures: MeasureQueryItem[];
  onChange: (measures: MeasureQueryItem[]) => void;
}

export const MeasureSelector: React.FC<MeasureSelectorProps> = ({
  availableMeasures,
  selectedMeasures,
  onChange,
}) => {
  const isSelected = (name: string, agg: string) =>
    selectedMeasures.some((m) => m.name === name && m.aggregation === agg);

  const toggleMeasure = (name: string, aggregation: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX") => {
    if (isSelected(name, aggregation)) {
      onChange(selectedMeasures.filter((m) => !(m.name === name && m.aggregation === aggregation)));
    } else {
      if (selectedMeasures.length >= 20) return;
      onChange([...selectedMeasures, { name, aggregation }]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <span>Measures ({selectedMeasures.length}/20)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {availableMeasures.map((measure) => (
          <div
            key={measure.name}
            className="border border-gray-200 rounded-md p-2 bg-white text-xs"
          >
            <div className="flex justify-between items-center mb-1.5 font-medium text-gray-900">
              <span>{measure.label}</span>
              {measure.isCurrency && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                  cents
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {measure.aggregations.map((agg) => {
                const active = isSelected(measure.name, agg);
                return (
                  <button
                    key={agg}
                    type="button"
                    onClick={() => toggleMeasure(measure.name, agg)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {agg}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
