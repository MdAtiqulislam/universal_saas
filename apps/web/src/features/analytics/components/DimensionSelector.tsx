import React from "react";

interface DimensionSelectorProps {
  availableDimensions: string[];
  selectedDimensions: string[];
  onChange: (dimensions: string[]) => void;
}

export const DimensionSelector: React.FC<DimensionSelectorProps> = ({
  availableDimensions,
  selectedDimensions,
  onChange,
}) => {
  const toggleDimension = (dim: string) => {
    if (selectedDimensions.includes(dim)) {
      onChange(selectedDimensions.filter((d) => d !== dim));
    } else {
      if (selectedDimensions.length >= 10) return;
      onChange([...selectedDimensions, dim]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <span>Dimensions ({selectedDimensions.length}/10)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {availableDimensions.map((dim) => {
          const isSelected = selectedDimensions.includes(dim);
          return (
            <button
              key={dim}
              type="button"
              onClick={() => toggleDimension(dim)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                isSelected
                  ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {dim}
            </button>
          );
        })}
      </div>
    </div>
  );
};
