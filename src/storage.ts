const PROFILE_ID_KEY = 'squadfinder.profileId'
const ROOM_KEY = 'squadfinder.room'

export function normalizeRoom(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export function getProfileId(): string {
  const existing = localStorage.getItem(PROFILE_ID_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(PROFILE_ID_KEY, created)
  return created
}

export function readRoom(): string | null {
  const param = new URLSearchParams(window.location.search).get('room')
  const fromUrl = param ? normalizeRoom(param) : ''
  if (fromUrl) return fromUrl
  const stored = localStorage.getItem(ROOM_KEY)
  return stored ? normalizeRoom(stored) || null : null
}

export function rememberRoom(room: string | null) {
  const url = new URL(window.location.href)
  if (room) {
    url.searchParams.set('room', room)
    localStorage.setItem(ROOM_KEY, room)
  } else {
    url.searchParams.delete('room')
    localStorage.removeItem(ROOM_KEY)
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}
