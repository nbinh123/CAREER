import React, { useState } from "react";

export default function Tooltip({ label, children, position = "top" }) {
  const [show, setShow] = useState(false);

  const posClass =
    position === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : "top-full left-1/2 -translate-x-1/2 mt-2";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((s) => !s)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={`absolute z-20 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs text-paper font-body shadow-ticket ${posClass}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
