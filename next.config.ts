import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes nativos/Node que Next.js no debe empaquetar en el bundle del server
  serverExternalPackages: ["@whiskeysockets/baileys", "better-sqlite3", "pino"],
};

export default nextConfig;
