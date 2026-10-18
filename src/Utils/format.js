export function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount ?? 0)
}

export function formatStayDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return 'Date pending'
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value))
}

export function getUnitImage(unit) {
  return unit?.unit_photos?.slice().sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
}

export function humanizeStatus(status = '') {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
