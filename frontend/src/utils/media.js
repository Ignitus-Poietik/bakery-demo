export function resolveMediaUrl(url, apiBase = '') {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  const base = (
    apiBase ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).replace(/\/+$/, '')

  if (url.startsWith('/')) {
    return base ? `${base}${url}` : url
  }
  return url
}
