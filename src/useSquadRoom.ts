import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MqttClient } from 'mqtt'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import {
  decryptPayload,
  deriveRoomKey,
  docTopic,
  encryptPayload,
  openRelay,
  payloadText,
  presenceTopic,
} from './relay.ts'
import { getProfileId } from './storage.ts'
import type { Interest, Profile, ProfileDraft } from './types.ts'

type SquadRoom = {
  profileId: string
  localReady: boolean
  connected: boolean
  error: string | null
  profiles: Profile[]
  interests: Interest[]
  onlineIds: string[]
  otherBrowsers: number
  mine: Profile | null
  publish: (draft: ProfileDraft) => void
  removeMine: () => void
  toggleInterest: (toId: string) => void
}

type Presence = {
  clientId: string
  profileId: string
  name: string
  online: boolean
}

type SeenPeer = {
  profileId: string
  name: string
  at: number
}

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<Profile>
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.headline === 'string' &&
    Array.isArray(profile.skills) &&
    Array.isArray(profile.lookingFor) &&
    typeof profile.idea === 'string' &&
    typeof profile.contact === 'string' &&
    (profile.availability === 'looking' ||
      profile.availability === 'building' ||
      profile.availability === 'full') &&
    typeof profile.updatedAt === 'number'
  )
}

function isInterest(value: unknown): value is Interest {
  if (!value || typeof value !== 'object') return false
  const interest = value as Partial<Interest>
  return (
    typeof interest.fromId === 'string' &&
    typeof interest.toId === 'string' &&
    typeof interest.fromName === 'string' &&
    typeof interest.createdAt === 'number'
  )
}

function isPresence(value: unknown): value is Presence {
  if (!value || typeof value !== 'object') return false
  const presence = value as Partial<Presence>
  return (
    typeof presence.clientId === 'string' &&
    typeof presence.profileId === 'string' &&
    typeof presence.name === 'string' &&
    typeof presence.online === 'boolean'
  )
}

export function useSquadRoom(roomCode: string): SquadRoom {
  const profileId = useMemo(() => getProfileId(), [])
  const docRef = useRef<Y.Doc | null>(null)
  const presenceSender = useRef<(name: string) => void>(() => {})
  const [localReady, setLocalReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [onlineIds, setOnlineIds] = useState<string[]>([])
  const [otherBrowsers, setOtherBrowsers] = useState(0)

  useEffect(() => {
    let closed = false
    const doc = new Y.Doc()
    const roomName = `squadfinder:${roomCode}`
    const clientId = `sf${Math.random().toString(36).slice(2, 10)}`
    const persistence = new IndexeddbPersistence(roomName, doc)
    const channel = new BroadcastChannel(roomName)
    const profilesMap = doc.getMap<Profile>('profiles')
    const interestsMap = doc.getMap<Interest>('interests')
    const peers = new Map<string, SeenPeer>()
    let client: MqttClient | null = null
    let roomKey: CryptoKey | null = null
    let latestName = ''
    let dirty = true
    let publishTimer: ReturnType<typeof setTimeout> | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null
    const encoder = new TextEncoder()

    docRef.current = doc

    const pull = () => {
      if (closed) return
      const nextProfiles: Profile[] = []
      profilesMap.forEach((value) => {
        if (isProfile(value)) nextProfiles.push(value)
      })
      const nextInterests: Interest[] = []
      interestsMap.forEach((value) => {
        if (isInterest(value)) nextInterests.push(value)
      })
      setProfiles(nextProfiles)
      setInterests(nextInterests)
    }

    const refreshOnline = () => {
      if (closed) return
      const ids = new Set<string>([profileId])
      let browsers = 0
      for (const [id, peer] of peers) {
        if (peer.profileId) ids.add(peer.profileId)
        if (id !== clientId) browsers += 1
      }
      setOnlineIds([...ids])
      setOtherBrowsers(browsers)
    }

    const publishDoc = async () => {
      if (!client || !roomKey || closed) return
      dirty = false
      const plain = Y.encodeStateAsUpdate(doc)
      const payload = await encryptPayload(roomKey, plain)
      if (closed || !client) return
      client.publish(docTopic(roomCode), payload, { qos: 1, retain: true })
      if (dirty) scheduleDoc()
    }

    const scheduleDoc = () => {
      dirty = true
      if (!client || publishTimer) return
      publishTimer = setTimeout(() => {
        publishTimer = null
        void publishDoc()
      }, 40)
    }

    const sendPresence = async (name: string, online = true) => {
      latestName = name
      if (!client || !roomKey || closed) return
      const plain = encoder.encode(JSON.stringify({ clientId, profileId, name, online } satisfies Presence))
      const payload = await encryptPayload(roomKey, plain)
      if (closed || !client) return
      client.publish(presenceTopic(roomCode), payload, { qos: 1, retain: false })
    }

    presenceSender.current = (name: string) => {
      void sendPresence(name)
    }

    const onDocumentUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== 'bc') channel.postMessage(update)
      scheduleDoc()
    }

    channel.onmessage = (event: MessageEvent<Uint8Array>) => {
      if (!(event.data instanceof Uint8Array)) return
      Y.applyUpdate(doc, event.data, 'bc')
    }

    profilesMap.observe(pull)
    interestsMap.observe(pull)
    refreshOnline()

    void persistence.whenSynced.then(async () => {
      if (closed) return
      pull()
      const existing = profilesMap.get(profileId)
      if (isProfile(existing)) latestName = existing.name
      setLocalReady(true)
      doc.on('update', onDocumentUpdate)

      try {
        roomKey = await deriveRoomKey(roomCode)
        if (closed) return
        const bye = await encryptPayload(
          roomKey,
          encoder.encode(JSON.stringify({ clientId, profileId, name: latestName, online: false } satisfies Presence)),
        )
        client = await openRelay(clientId, presenceTopic(roomCode), bye)
      } catch (caught) {
        if (!closed) {
          setError(caught instanceof Error ? caught.message : 'Could not reach other browsers.')
        }
        return
      }
      if (closed) {
        client.end(true)
        return
      }

      setConnected(true)
      setError(null)
      client.on('connect', () => {
        if (closed) return
        setConnected(true)
        scheduleDoc()
        void sendPresence(latestName)
      })
      client.on('offline', () => {
        if (!closed) setConnected(false)
      })
      client.on('message', (topic, message) => {
        const text = payloadText(message)
        if (topic === docTopic(roomCode)) {
          if (!text || !roomKey) return
          void decryptPayload(roomKey, text).then((plain) => {
            if (!plain || closed) return
            Y.applyUpdate(doc, plain, 'mqtt')
          })
          return
        }
        if (topic !== presenceTopic(roomCode) || !text || !roomKey) return
        void decryptPayload(roomKey, text).then((plain) => {
          if (!plain || closed) return
          try {
            const parsed: unknown = JSON.parse(new TextDecoder().decode(plain))
            if (!isPresence(parsed)) return
            if (!parsed.online) peers.delete(parsed.clientId)
            else peers.set(parsed.clientId, { profileId: parsed.profileId, name: parsed.name, at: Date.now() })
            refreshOnline()
          } catch {
            // Ignore presence that was not encrypted for this room.
          }
        })
      })

      client.subscribe([docTopic(roomCode), presenceTopic(roomCode)], { qos: 1 }, () => {
        if (closed) return
        scheduleDoc()
        void sendPresence(latestName)
      })
      heartbeat = setInterval(() => {
        scheduleDoc()
        void sendPresence(latestName)
        const now = Date.now()
        let changed = false
        for (const [id, peer] of peers) {
          if (now - peer.at > 12000) {
            peers.delete(id)
            changed = true
          }
        }
        if (changed) refreshOnline()
      }, 4000)
    })

    return () => {
      closed = true
      presenceSender.current = () => {}
      if (publishTimer) clearTimeout(publishTimer)
      if (heartbeat) clearInterval(heartbeat)
      profilesMap.unobserve(pull)
      interestsMap.unobserve(pull)
      doc.off('update', onDocumentUpdate)
      channel.close()
      if (client && roomKey) {
        const bye = JSON.stringify({ clientId, profileId, name: latestName, online: false } satisfies Presence)
        void encryptPayload(roomKey, encoder.encode(bye)).then((payload) => {
          client?.publish(presenceTopic(roomCode), payload, { qos: 0, retain: false })
          client?.end(true)
        })
      } else {
        client?.end(true)
      }
      void persistence.destroy()
      doc.destroy()
      docRef.current = null
    }
  }, [profileId, roomCode])

  const publish = useCallback(
    (draft: ProfileDraft) => {
      const doc = docRef.current
      if (!doc) return
      const profile: Profile = {
        ...draft,
        id: profileId,
        name: draft.name.trim(),
        headline: draft.headline.trim(),
        idea: draft.idea.trim(),
        contact: draft.contact.trim(),
        updatedAt: Date.now(),
      }
      const profilesMap = doc.getMap<Profile>('profiles')
      const interestsMap = doc.getMap<Interest>('interests')
      doc.transact(() => {
        profilesMap.set(profileId, profile)
        interestsMap.forEach((interest, key) => {
          if (interest.fromId === profileId && interest.fromName !== profile.name) {
            interestsMap.set(key, { ...interest, fromName: profile.name })
          }
        })
      })
      presenceSender.current(profile.name)
    },
    [profileId],
  )

  const removeMine = useCallback(() => {
    const doc = docRef.current
    if (!doc) return
    const profilesMap = doc.getMap<Profile>('profiles')
    const interestsMap = doc.getMap<Interest>('interests')
    doc.transact(() => {
      profilesMap.delete(profileId)
      const keys: string[] = []
      interestsMap.forEach((interest, key) => {
        if (interest.fromId === profileId || interest.toId === profileId) keys.push(key)
      })
      for (const key of keys) interestsMap.delete(key)
    })
    presenceSender.current('')
  }, [profileId])

  const toggleInterest = useCallback(
    (toId: string) => {
      const doc = docRef.current
      if (!doc || toId === profileId) return
      const profilesMap = doc.getMap<Profile>('profiles')
      const mine = profilesMap.get(profileId)
      if (!isProfile(mine)) return
      const interestsMap = doc.getMap<Interest>('interests')
      const key = `${profileId}:${toId}`
      if (interestsMap.has(key)) {
        interestsMap.delete(key)
        return
      }
      interestsMap.set(key, {
        fromId: profileId,
        toId,
        fromName: mine.name,
        createdAt: Date.now(),
      })
    },
    [profileId],
  )

  const mine = profiles.find((profile) => profile.id === profileId) ?? null

  return {
    profileId,
    localReady,
    connected,
    error,
    profiles,
    interests,
    onlineIds,
    otherBrowsers,
    mine,
    publish,
    removeMine,
    toggleInterest,
  }
}
