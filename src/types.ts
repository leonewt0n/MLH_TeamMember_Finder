export type Availability = 'looking' | 'building' | 'full'

export type Profile = {
  id: string
  name: string
  headline: string
  skills: string[]
  lookingFor: string[]
  idea: string
  contact: string
  availability: Availability
  updatedAt: number
}

export type ProfileDraft = Omit<Profile, 'id' | 'updatedAt'>

export type Interest = {
  fromId: string
  toId: string
  fromName: string
  createdAt: number
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  looking: 'Looking for a team',
  building: 'Have an idea, need people',
  full: 'Team is full',
}

export const SKILL_SUGGESTIONS = [
  'React',
  'TypeScript',
  'Python',
  'Design',
  'ML',
  'Hardware',
  'Mobile',
  'Backend',
  'DevOps',
  'Pitch',
]
