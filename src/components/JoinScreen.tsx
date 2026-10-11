import { useState, type FormEvent } from 'react'
import { normalizeRoom } from '../storage.ts'

type JoinScreenProps = {
  onJoin: (room: string) => void
}

export function JoinScreen({ onJoin }: JoinScreenProps) {
  const [raw, setRaw] = useState('')
  const preview = normalizeRoom(raw)
  const invalid = raw.trim().length > 0 && preview.length === 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!preview) return
    onJoin(preview)
  }

  return (
    <main className="join">
      <form className="join-card" onSubmit={submit}>
        <p className="eyebrow">Hackathon floor · saved in your browser</p>
        <h1>Find your squad while the room is open.</h1>
        <p className="lede">
          Everyone in the same room shares one document. It is saved in this browser. Encrypted
          changes are forwarded through a public relay, so someone on another network can merge
          them into their own copy. The room code is the key.
        </p>
        <label className="field" htmlFor="room">
          Room code
          <input
            id="room"
            value={raw}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="local-hack-night"
            onChange={(event) => setRaw(event.target.value)}
          />
        </label>
        <p className="hint" aria-live="polite">
          {invalid
            ? 'Use letters or numbers.'
            : preview
              ? `You will join “${preview}”. Anyone with this code can see the profiles in it.`
              : 'Pick the code your hackathon is using, then share the link.'}
        </p>
        <button className="primary" type="submit" disabled={!preview}>
          Enter the room
        </button>
      </form>
    </main>
  )
}
