"use client";

import React from "react";
import { ShipmentTrackingEvent } from "../types/shipping.types";

interface TrackingTimelineProps {
  events: ShipmentTrackingEvent[];
}

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-zinc-500 italic">No tracking events recorded yet.</p>;
  }

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
      case "DISPATCHED":
      case "IN_TRANSIT":
      case "OUT_FOR_DELIVERY":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "DELIVERY_ATTEMPT_FAILED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
      case "RETURNED":
      case "RETURN_INITIATED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      case "CANCELLED":
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
      default:
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    }
  };

  return (
    <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6">
      {events.map((ev, idx) => (
        <div key={ev.id || idx} className="relative group">
          <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-zinc-400 border-2 border-white dark:border-zinc-900 group-hover:bg-blue-600 transition" />
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded ${getEventBadge(ev.eventType)}`}
            >
              {ev.eventType}
            </span>
            <span className="text-xs text-zinc-400">{new Date(ev.eventTime).toLocaleString()}</span>
            {ev.location && (
              <span className="text-xs text-zinc-500 font-medium">📍 {ev.location}</span>
            )}
          </div>
          {ev.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{ev.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
