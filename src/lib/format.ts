/** "51999..." → "+51999..."; contactos @lid (número oculto por WhatsApp) → "ID 1234…@lid". */
export function formatPhone(phone: string): string {
  return phone.includes("@") ? `ID ${phone.split("@")[0]} (número oculto)` : `+${phone}`;
}
