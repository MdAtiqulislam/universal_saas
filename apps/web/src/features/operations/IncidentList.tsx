import React from "react";

export type Incident = {
  id: string;
  incidentNumber: string;
  title: string;
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  status: "OPEN" | "ACKNOWLEDGED" | "INVESTIGATING" | "MITIGATED" | "RESOLVED" | "CLOSED";
  detectedAt: string;
};

export function IncidentList({
  incidents,
  onSelect,
}: {
  incidents: Incident[];
  onSelect: (id: string) => void;
}) {
  const getSevColor = (sev: string) => {
    switch (sev) {
      case "SEV1":
        return "bg-rose-100 text-rose-800";
      case "SEV2":
        return "bg-orange-100 text-orange-800";
      case "SEV3":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="py-3 px-4 font-semibold text-gray-600">ID</th>
            <th className="py-3 px-4 font-semibold text-gray-600">Severity</th>
            <th className="py-3 px-4 font-semibold text-gray-600">Title</th>
            <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
            <th className="py-3 px-4 font-semibold text-gray-600">Detected At</th>
          </tr>
        </thead>
        <tbody>
          {incidents.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-gray-500">
                No incidents to display.
              </td>
            </tr>
          )}
          {incidents.map((inc) => (
            <tr
              key={inc.id}
              onClick={() => onSelect(inc.id)}
              className="hover:bg-gray-50 cursor-pointer border-b border-gray-100"
            >
              <td className="py-3 px-4 text-indigo-600">{inc.incidentNumber}</td>
              <td className="py-3 px-4">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${getSevColor(inc.severity)}`}
                >
                  {inc.severity}
                </span>
              </td>
              <td className="py-3 px-4 font-medium">{inc.title}</td>
              <td className="py-3 px-4 text-gray-600">{inc.status}</td>
              <td className="py-3 px-4 text-gray-500">
                {new Date(inc.detectedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
