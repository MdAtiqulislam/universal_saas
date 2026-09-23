"use client";

import React from "react";
import { FavoriteItemRecord } from "../types";

interface FavoritesDrawerProps {
  favorites: FavoriteItemRecord[];
  onRemoveFavorite: (fav: FavoriteItemRecord) => void;
}

export const FavoritesDrawer: React.FC<FavoritesDrawerProps> = ({
  favorites,
  onRemoveFavorite,
}) => {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
        Starred Favorites
      </h4>

      {favorites.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">
          No starred favorites yet. Click the star icon on any search result to bookmark it.
        </p>
      ) : (
        <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="p-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-xs"
            >
              <div className="flex items-center space-x-2 truncate pr-2">
                <span className="text-yellow-500">★</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {fav.resourceType}
                </span>
                <a
                  href={fav.url}
                  className="font-medium text-gray-800 hover:text-blue-600 truncate"
                >
                  {fav.title}
                </a>
              </div>
              <button
                onClick={() => onRemoveFavorite(fav)}
                className="text-gray-400 hover:text-red-500 p-1"
                title="Remove favorite"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
