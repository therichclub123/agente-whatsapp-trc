"use client";

import { useState } from "react";

interface Props {
  phone: string | null;
  onDisconnect: () => Promise<void>;
}

export default function DashboardHeader({ phone, onDisconnect }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      await onDisconnect();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Agente WhatsApp</p>
          <p className="text-xs text-gray-500">Conectado{phone ? ` como +${phone}` : ""}</p>
        </div>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">¿Desvincular este número?</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Desconectando..." : "Sí, desconectar"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Desconectar
        </button>
      )}
    </header>
  );
}
