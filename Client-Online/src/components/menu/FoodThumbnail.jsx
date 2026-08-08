import React, { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

export default function FoodThumbnail({ src, alt, className = "" }) {
  const [error, setError] = useState(false);
  const showFallback = !src || error;

  return (
    <div className={`bg-paper-dim flex items-center justify-center overflow-hidden ${className}`}>
      {showFallback ? (
        <UtensilsCrossed size={22} className="text-steel-light" />
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}
