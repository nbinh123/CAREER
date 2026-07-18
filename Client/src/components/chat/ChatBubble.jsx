import React from "react";
import { formatTime } from "../../utils/formatTime";

export default function ChatBubble({ message }) {
  const isGuest = message.from === "guest";
  return (
    <div className={`flex ${isGuest ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isGuest ? "bg-ink text-paper rounded-br-md" : "bg-paper-dim text-ink rounded-bl-md"
        }`}
      >
        <p>{message.text}</p>
        <p className={`text-[10px] mt-1 ${isGuest ? "text-steel-light" : "text-steel"}`}>
          {formatTime(message.at)}
        </p>
      </div>
    </div>
  );
}
