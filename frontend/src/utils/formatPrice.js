/** Thai-style baht display (number + literal "บาท"), avoids THB symbol. */
export function formatBahtAmount(price) {
  const n = Number(price || 0);
  const integer = Number.isInteger(n);
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: integer ? 0 : 2,
    maximumFractionDigits: integer ? 0 : 2,
  }).format(n);
}

export function formatBahtWithUnit(price) {
  return `${formatBahtAmount(price)} บาท`;
}
