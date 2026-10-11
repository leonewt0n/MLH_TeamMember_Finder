import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { AVAILABILITY_LABELS, SKILL_SUGGESTIONS, type Availability, type Interest, type Profile, type ProfileDraft } from '../types.ts'

type ProfileEditorProps = {
  initial: Profile | null
  inbound: Interest[]
  ready: boolean
  onPublish: (draft: ProfileDraft) => void
  onRemove: () => void
}

const LIMITS = {
  name: 60,
  headline: 140,
  idea: 500,
  contact: 120,
  tag: 24,
  tags: 12,
}

function cleanTag(value: string) {
  return value.trim().replace(/,$/, '').slice(0, LIMITS.tag)
}

function addTag(tags: string[], raw: string) {
  const next = cleanTag(raw)
  if (!next || tags.length >= LIMITS.tags) return tags
  if (tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) return tags
  return [...tags, next]
}

export function ProfileEditor({ initial, inbound, ready, onPublish, onRemove }: ProfileEditorProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [headline, setHeadline] = useState(initial?.headline ?? '')
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? [])
  const [lookingFor, setLookingFor] = useState<string[]>(initial?.lookingFor ?? [])
  const [idea, setIdea] = useState(initial?.idea ?? '')
  const [contact, setContact] = useState(initial?.contact ?? '')
  const [availability, setAvailability] = useState<Availability>(initial?.availability ?? 'looking')
  const [confirmRemove, setConfirmRemove] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onPublish({
      name: trimmed.slice(0, LIMITS.name),
      headline: headline.trim().slice(0, LIMITS.headline),
      skills,
      lookingFor,
      idea: idea.trim().slice(0, LIMITS.idea),
      contact: contact.trim().slice(0, LIMITS.contact),
      availability,
    })
    setConfirmRemove(false)
  }

  return (
    <form className="editor" onSubmit={submit}>
      <div className="editor-head">
        <h2>Your card</h2>
        <p>This is the only profile this browser publishes.</p>
      </div>

      {inbound.length > 0 && (
        <div className="callout">
          <strong>
            {inbound.length === 1 ? `${inbound[0].fromName} wants` : `${inbound.length} people want`} to team up
          </strong>
          <ul>
            {inbound.map((interest) => (
              <li key={interest.fromId}>{interest.fromName}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="field" htmlFor="name">
        Name
        <input
          id="name"
          required
          maxLength={LIMITS.name}
          value={name}
          placeholder="Maya Chen"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field" htmlFor="headline">
        One-liner
        <input
          id="headline"
          maxLength={LIMITS.headline}
          value={headline}
          placeholder="Frontend person who will also talk to judges"
          onChange={(event) => setHeadline(event.target.value)}
        />
      </label>

      <fieldset className="field">
        <legend>What do you need?</legend>
        <div className="segmented">
          {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((option) => (
            <label key={option} className={availability === option ? 'on' : ''}>
              <input
                type="radio"
                name="availability"
                value={option}
                checked={availability === option}
                onChange={() => setAvailability(option)}
              />
              {AVAILABILITY_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <TagField label="Skills you bring" tags={skills} onChange={setSkills} />
      <div className="suggestions">
        {SKILL_SUGGESTIONS.map((skill) => (
          <button
            key={skill}
            type="button"
            className="chip"
            disabled={skills.some((tag) => tag.toLowerCase() === skill.toLowerCase())}
            onClick={() => setSkills((current) => addTag(current, skill))}
          >
            {skill}
          </button>
        ))}
      </div>

      <TagField label="Looking for" tags={lookingFor} onChange={setLookingFor} />

      <label className="field" htmlFor="idea">
        Idea or team
        <textarea
          id="idea"
          maxLength={LIMITS.idea}
          rows={3}
          value={idea}
          placeholder="Building a hardware check-in desk. Need someone on the pitch."
          onChange={(event) => setIdea(event.target.value)}
        />
      </label>

      <label className="field" htmlFor="contact">
        Contact
        <input
          id="contact"
          maxLength={LIMITS.contact}
          value={contact}
          placeholder="discord: maya or you@school.edu"
          onChange={(event) => setContact(event.target.value)}
        />
      </label>

      <div className="editor-actions">
        <button className="primary" type="submit" disabled={!ready || name.trim().length === 0}>
          {initial ? 'Update card' : 'Put me on the board'}
        </button>
        {initial && !confirmRemove && (
          <button className="ghost" type="button" onClick={() => setConfirmRemove(true)}>
            Remove my card
          </button>
        )}
        {initial && confirmRemove && (
          <button
            className="danger"
            type="button"
            onClick={() => {
              onRemove()
              setConfirmRemove(false)
            }}
          >
            Confirm remove
          </button>
        )}
      </div>
    </form>
  )
}

function TagField({
  label,
  tags,
  onChange,
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const inputId = label.toLowerCase().replace(/[^a-z]+/g, '-')

  function commit(raw: string) {
    onChange(addTag(tags, raw))
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="tag-box">
        {tags.map((tag) => (
          <button key={tag} type="button" className="tag" onClick={() => onChange(tags.filter((item) => item !== tag))}>
            {tag}
            <span aria-hidden="true">×</span>
            <span className="sr-only">Remove {tag}</span>
          </button>
        ))}
        <input
          id={inputId}
          value={draft}
          placeholder={tags.length === 0 ? 'Type a tag and press Enter' : ''}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft)
          }}
        />
      </div>
    </div>
  )
}
