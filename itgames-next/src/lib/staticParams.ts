/**
 * Shared helper for generateStaticParams in dynamic [code] routes.
 * Fetches all game codes from the API at build time.
 * Falls back to a placeholder so Next.js accepts the export during CI
 * when the API is unreachable; the SPA rewrite handles real paths at runtime.
 */
export async function getGameCodeParams(): Promise<{ code: string }[]> {
  try {
    const res = await fetch('https://itgames.vercel.app/games', {
      headers: { 'X-Tenant-ID': '1' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const games = await res.json()
    const codes: { code: string }[] = Array.isArray(games)
      ? games.map((g: { code: unknown }) => ({ code: String(g.code) }))
      : []
    return codes.length ? codes : [{ code: '__placeholder__' }]
  } catch {
    return [{ code: '__placeholder__' }]
  }
}
