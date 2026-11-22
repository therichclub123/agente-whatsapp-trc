"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/db";

interface Props {
  status: ConnectionStatus;
  qrPng: string | null;
}

export default function QRScreen({ status, qrPng }: Props) {
  // Si pasan >10s en 'disconnected' sin QR, probablemente el proceso bot no está corriendo
  const [stuck, setStuck] = useState(false);
  const waitingForBot = status === "disconnected" && !qrPng;

  useEffect(() => {
    setStuck(false);
    if (!waitingForBot) return;
    const timer = setTimeout(() => setStuck(true), 10000);
    return () => clearTimeout(timer);
  }, [waitingForBot]);

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Conectar número</h1>
        <p className="mt-2 text-sm text-gray-500">
          En tu teléfono abre WhatsApp → Configuración → Dispositivos vinculados → Vincular un
          dispositivo, y escanea este código.
        </p>

        <div className="mx-auto mt-6 flex aspect-square w-full max-w-[320px] items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
          {qrPng ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrPng} alt="Código QR de WhatsApp" className="h-full w-full rounded-xl" />
          ) : (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {status === "qr" && (
            <>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
              <span className="text-gray-700">Esperando escaneo...</span>
            </>
          )}
          {status === "connecting" && (
            <>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
              <span className="text-blue-700">Conectando...</span>
            </>
          )}
          {status === "disconnected" && !stuck && <span className="text-gray-500">Iniciando...</span>}
        </div>

        {stuck && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
            No se recibe el QR del bot. Verifica que el proceso esté corriendo (
            <code className="font-mono">npm run start:bot</code>) y reinícialo. Si desvinculaste el
            dispositivo desde el teléfono, borra la carpeta <code className="font-mono">./auth</code>{" "}
            antes de reiniciar.
          </div>
        )}
      </div>
    </main>
  );
}
