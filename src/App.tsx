import { useEffect, useState } from 'react'
import { JoinScreen } from './components/JoinScreen.tsx'
import { ProfileEditor } from './components/ProfileEditor.tsx'
import { SquadBoard } from './components/SquadBoard.tsx'
import { readRoom, rememberRoom } from './storage.ts'
import { useSquadRoom } from './useSquadRoom.ts'

export default function App() {
  const [room, setRoom] = useState<string | null>(() => readRoom())

  useEffect(() => {
    rememberRoom(room)
  }, [room])

  if (!room) return <JoinScreen onJoin={setRoom} />
  return <RoomApp room={room} onLeave={() => setRoom(null)} />
}

function RoomApp({ room, onLeave }: { room: string; onLeave: () => void }) {
  const squad = useSquadRoom(room)
  const [copied, setCopied] = useState(false)
  const onlineCount = squad.onlineIds.length

  useEffect(() => {
    document.title = `Squad Finder · ${room}`
    return () => {
      document.title = 'Squad Finder'
    }
  }, [room])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const syncLine = !squad.localReady
    ? 'Opening the database stored in this browser…'
    : !squad.connected
      ? 'Connecting to other browsers on the internet…'
      : squad.otherBrowsers > 0
        ? `Synced with ${squad.otherBrowsers} other browser${squad.otherBrowsers === 1 ? '' : 's'}`
        : 'Connected. Waiting for someone else to open this room.'

  const inbound = squad.interests.filter((interest) => interest.toId === squad.profileId)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Squad Finder</p>
          <h1>{room}</h1>
        </div>
        <p className="sync" aria-live="polite">
          <strong>{squad.localReady ? `${onlineCount} online` : 'Connecting'}</strong>
          <span>{syncLine}</span>
        </p>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={() => void copyLink()}>
            {copied ? 'Link copied' : 'Copy room link'}
          </button>
          <button type="button" className="ghost" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </header>

      {squad.error && <p className="banner">{squad.error}</p>}

      <div className="workspace">
        {squad.localReady ? (
          <ProfileEditor
            key={`${room}:${squad.mine?.updatedAt ?? 'new'}`}
            initial={squad.mine}
            inbound={inbound}
            ready={squad.localReady}
            onPublish={squad.publish}
            onRemove={squad.removeMine}
          />
        ) : (
          <section className="editor loading">Loading your card from this browser…</section>
        )}
        {squad.localReady ? (
          <SquadBoard
            profiles={squad.profiles}
            interests={squad.interests}
            onlineIds={squad.onlineIds}
            profileId={squad.profileId}
            canTeam={squad.mine !== null}
            onToggleInterest={squad.toggleInterest}
          />
        ) : (
          <section className="board loading">The shared board will appear once the local database is open.</section>
        )}
      </div>
      <footer className="colophon">
        The board is stored in this browser. Room updates are encrypted with the room code and forwarded
        through a public relay so people on other networks can merge them.
      </footer>
    </div>
  )
}
