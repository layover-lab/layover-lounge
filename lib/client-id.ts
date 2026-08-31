import { KEYS, readText, writeText } from '@/lib/storage'

export function getClientId(): string {
  let id = readText(KEYS.client)
  if (!id) {
    id = crypto.randomUUID()
    writeText(KEYS.client, id)
  }
  return id
}
