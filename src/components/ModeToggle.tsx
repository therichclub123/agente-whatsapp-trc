"use client";

import type { Mode } from "@/lib/db";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: Props) {
  const base = "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-50";
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => mode !== "AI" && onChange("AI")}
        className={`${base} ${
          mode === "AI" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
      >
        IA
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => mode !== "HUMAN" && onChange("HUMAN")}
        className={`${base} ${
          mode === "HUMAN" ? "bg-amber-500 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
      >
        HUMANO
      </button>
    </div>
  );
}
