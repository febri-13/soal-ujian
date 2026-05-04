export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "")
  if (digits.startsWith("0")) return "62" + digits.slice(1)
  if (digits.startsWith("8")) return "62" + digits
  if (digits.startsWith("62")) return digits
  return digits
}

export function isValidPhone(phone: string): boolean {
  return /^628\d{8,12}$/.test(phone)
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhone(phone)
  if (!n.startsWith("62")) return phone
  return "+62 " + n.slice(2).replace(/(\d{3,4})(?=\d)/g, "$1-")
}
