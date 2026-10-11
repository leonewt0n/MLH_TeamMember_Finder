import { useMemo, useState } from 'react'
import { AVAILABILITY_LABELS, type Availability, type Interest, type Profile } from '../types.ts'

type SquadBoardProps = {
  profiles: Profile[]
  interests: Interest[]
  onlineIds: string[]
  profileId: string
  canTeam: boolean
  onToggleInterest: (toId: string) => void
}

function contactNode(value: string) {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return (
      <a href={trimmed} target="_blank" rel="noreferrer">
        {trimmed}
      </a>
    )
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return <a href={`mailto:${trimmed}`}>{trimmed}</a>
  }
  return <span>{trimmed}</span>
}

function formatAge(timestamp: number) {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function wantLine(names: string[]) {
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} wants to team`
  if (names.length === 2) return `${names[0]} and ${names[1]} want to team`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} want to team`
}

export function SquadBoard({
  profiles,
  interests,
  onlineIds,
  profileId,
  canTeam,
  onToggleInterest,
}: SquadBoardProps) {
  const [query, setQuery] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [needs, setNeeds] = useState<Availability[]>([])
  const online = useMemo(() => new Set(onlineIds), [onlineIds])

  const skillOptions = useMemo(() => {
    const counts = new Map<string, string>()
    for (const profile of profiles) {
      for (const tag of [...profile.skills, ...profile.lookingFor]) {
        const key = tag.toLowerCase()
        if (!counts.has(key)) counts.set(key, tag)
      }
    }
    return [...counts.values()].sort((a, b) => a.localeCompare(b))
  }, [profiles])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return profiles
      .filter((profile) => {
        if (needs.length > 0 && !needs.includes(profile.availability)) return false
        if (skills.length > 0) {
          const haystack = [...profile.skills, ...profile.lookingFor].map((tag) => tag.toLowerCase())
          if (!skills.some((skill) => haystack.includes(skill.toLowerCase()))) return false
        }
        if (!needle) return true
        const blob = [profile.name, profile.headline, profile.idea, profile.contact, ...profile.skills, ...profile.lookingFor]
          .join(' ')
          .toLowerCase()
        return blob.includes(needle)
      })
      .sort((a, b) => {
        const aOnline = online.has(a.id) ? 0 : 1
        const bOnline = online.has(b.id) ? 0 : 1
        if (aOnline !== bOnline) return aOnline - bOnline
        const order = { looking: 0, building: 1, full: 2 }
        if (order[a.availability] !== order[b.availability]) return order[a.availability] - order[b.availability]
        return b.updatedAt - a.updatedAt
      })
  }, [needs, online, profiles, query, skills])

  function toggleNeed(option: Availability) {
    setNeeds((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]))
  }

  function toggleSkill(option: string) {
    setSkills((current) =>
      current.some((item) => item.toLowerCase() === option.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== option.toLowerCase())
        : [...current, option],
    )
  }

  return (
    <section className="board">
      <div className="board-tools">
        <label className="search" htmlFor="search">
          <span className="sr-only">Search the room</span>
          <input
            id="search"
            value={query}
            placeholder="Search names, skills, ideas"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="filters" aria-label="Filter by what people need">
          {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((option) => (
            <button
              key={option}
              type="button"
              className={needs.includes(option) ? 'chip on' : 'chip'}
              aria-pressed={needs.includes(option)}
              onClick={() => toggleNeed(option)}
            >
              {AVAILABILITY_LABELS[option]}
            </button>
          ))}
        </div>
        {skillOptions.length > 0 && (
          <div className="filters" aria-label="Filter by skill">
            {skillOptions.map((skill) => {
              const selected = skills.some((item) => item.toLowerCase() === skill.toLowerCase())
              return (
                <button
                  key={skill}
                  type="button"
                  className={selected ? 'chip on' : 'chip'}
                  aria-pressed={selected}
                  onClick={() => toggleSkill(skill)}
                >
                  {skill}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {profiles.length === 0 ? (
        <div className="empty">
          <h2>The board is empty.</h2>
          <p>Put your card up. It stays in this browser, and it will merge with anyone who opens this room.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <h2>No one matches.</h2>
          <p>Clear a filter or try a shorter search.</p>
        </div>
      ) : (
        <div className="grid">
          {visible.map((profile) => {
            const isMine = profile.id === profileId
            const inbound = interests.filter((interest) => interest.toId === profile.id)
            const sent = interests.some((interest) => interest.fromId === profileId && interest.toId === profile.id)
            return (
              <article key={profile.id} className={isMine ? 'card mine' : 'card'}>
                <header>
                  <span className={`presence ${online.has(profile.id) ? 'live' : ''}`}>
                    {online.has(profile.id) ? 'Online' : 'Away'}
                  </span>
                  <span className={`need ${profile.availability}`}>{AVAILABILITY_LABELS[profile.availability]}</span>
                </header>
                <h3>
                  {profile.name}
                  {isMine && <span className="you">You</span>}
                </h3>
                {profile.headline && <p className="headline">{profile.headline}</p>}
                {profile.skills.length > 0 && (
                  <p className="meta">
                    <span>Brings</span>
                    {profile.skills.map((skill) => (
                      <em key={skill}>{skill}</em>
                    ))}
                  </p>
                )}
                {profile.lookingFor.length > 0 && (
                  <p className="meta">
                    <span>Needs</span>
                    {profile.lookingFor.map((skill) => (
                      <em key={skill}>{skill}</em>
                    ))}
                  </p>
                )}
                {profile.idea && <p className="idea">{profile.idea}</p>}
                {profile.contact && <p className="contact">{contactNode(profile.contact)}</p>}
                {inbound.length > 0 && <p className="wants">{wantLine(inbound.map((interest) => interest.fromName))}</p>}
                <footer>
                  <time dateTime={new Date(profile.updatedAt).toISOString()}>Updated {formatAge(profile.updatedAt)}</time>
                  {!isMine && (
                    <button
                      type="button"
                      className={sent ? 'team on' : 'team'}
                      disabled={!canTeam}
                      onClick={() => onToggleInterest(profile.id)}
                    >
                      {sent ? 'Cancel team-up' : 'Team up'}
                    </button>
                  )}
                </footer>
                {!isMine && !canTeam && <p className="fine">Publish your card before sending a team-up.</p>}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
