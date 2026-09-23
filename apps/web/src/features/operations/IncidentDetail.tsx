import React from "react";
import { Incident } from "./IncidentList";

export type IncidentDetailData = Incident & {
  description: string;
  rootCause?: string;
  resolution?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

export function IncidentDetail({
  incident,
  onClose,
}: {
  incident: IncidentDetailData | null;
  onClose: () => void;
}) {
  if (!incident) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold">Incident {incident.incidentNumber}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-600">Title</h3>
            <p className="mt-1">{incident.title}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-600">Description</h3>
            <p className="mt-1 text-sm text-gray-700">{incident.description}</p>
          </div>
          <div className="flex space-x-4 mt-6">
            <button className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700">
              Acknowledge
            </button>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700">
              Resolve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
