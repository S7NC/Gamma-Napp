import { generateSecretKey, getPublicKey, nip17 } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'
import { SimplePool } from 'nostr-tools/pool'

export const useNostrMessages = () => {
  let pool = null

  const getPool = () => {
    if (!process.client) {
      throw new Error('Direct messages are only available in the browser.')
    }

    if (!pool) {
      pool = new SimplePool()
    }

    return pool
  }

  const generateGuestDmIdentity = () => {
    const secretKey = generateSecretKey()
    const pubkey = getPublicKey(secretKey)

    return {
      secretKey,
      pubkey,
      npub: nip19.npubEncode(pubkey)
    }
  }

  const sendNip17Dm = async ({ senderSecretKey, merchantPubkey, relays, message, subject = '' }) => {
    const relayList = Array.from(new Set((relays || []).filter(Boolean)))

    if (!merchantPubkey) {
      throw new Error('Missing merchant pubkey for contact message.')
    }

    if (relayList.length === 0) {
      throw new Error('No merchant inbox relays available for delivery.')
    }

    if (!message.trim()) {
      throw new Error('Message cannot be empty.')
    }

    const wrappedEvent = nip17.wrapEvent(
      senderSecretKey,
      { publicKey: merchantPubkey },
      message,
      subject.trim() || 'Contact'
    )

    const pubs = getPool().publish(relayList, wrappedEvent)
    await Promise.any(pubs)

    return wrappedEvent
  }

  return {
    generateGuestDmIdentity,
    sendNip17Dm
  }
}
