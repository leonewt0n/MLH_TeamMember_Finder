import mqtt, { type MqttClient } from 'mqtt'

const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt']

const text = new TextEncoder()

export function docTopic(room: string) {
  return `mlh-squadfinder/v1/${room}/doc`
}

export function presenceTopic(room: string) {
  return `mlh-squadfinder/v1/${room}/presence`
}

export async function deriveRoomKey(room: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', text.encode(`squadfinder:${room}`), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: text.encode('squadfinder-room-v1'),
      iterations: 120000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function encodePayload(bytes: Uint8Array) {
  const chars = new Array<string>(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) chars[i] = String.fromCharCode(bytes[i] ?? 0)
  return btoa(chars.join(''))
}

function decodePayload(value: string) {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function arrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export async function encryptPayload(key: CryptoKey, plain: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer(plain)))
  const combined = new Uint8Array(iv.length + cipher.length)
  combined.set(iv, 0)
  combined.set(cipher, iv.length)
  return encodePayload(combined)
}

export async function decryptPayload(key: CryptoKey, payload: string) {
  if (!payload) return null
  const combined = decodePayload(payload)
  if (!combined || combined.length < 13) return null
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.subarray(0, 12) },
      key,
      combined.subarray(12),
    )
    return new Uint8Array(plain)
  } catch {
    return null
  }
}

export function payloadText(payload: unknown) {
  if (typeof payload === 'string') return payload
  if (payload instanceof Uint8Array) return new TextDecoder().decode(payload)
  return ''
}

export function openRelay(clientId: string, willTopic: string, willPayload = ''): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    const attempt = (index: number) => {
      const url = BROKERS[index]
      if (!url) {
        reject(new Error('Could not reach a public sync relay. The board is saved on this device only.'))
        return
      }
      const client = mqtt.connect(url, {
        clientId,
        clean: true,
        keepalive: 30,
        reconnectPeriod: 2000,
        connectTimeout: 8000,
        protocolVersion: 4,
        will: {
          topic: willTopic,
          payload: willPayload,
          qos: 1,
          retain: false,
        },
      })
      let settled = false
      const fail = () => {
        if (settled) return
        settled = true
        client.end(true)
        attempt(index + 1)
      }
      const timer = setTimeout(fail, 8000)
      client.once('connect', () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(client)
      })
      client.once('error', fail)
    }
    attempt(0)
  })
}
