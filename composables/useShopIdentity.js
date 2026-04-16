import * as nip19 from 'nostr-tools/nip19'

const DEFAULT_DISCOVERY_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.damus.io',
  'wss://relay.primal.net'
]

const LOCAL_DEFAULT_NPUB = 'npub1equrmqway3qxw3dkssymusxkwgwrqypfgeqx0lx9pgjam7gnj4ysaqhkj6'

const isLocalHost = (hostname) => {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')
}

const extractNpubFromHost = (hostname) => {
  if (!hostname) return null
  const subdomain = hostname.split('.')[0]?.toLowerCase() || ''

  if (subdomain.startsWith('npub1')) {
    return subdomain
  }

  if (subdomain.startsWith('npubs1')) {
    return `npub1${subdomain.slice(6)}`
  }

  return null
}

const parsePubkey = (npub) => {
  try {
    const decoded = nip19.decode(npub)
    if (decoded.type !== 'npub') {
      throw new Error('Expected npub type')
    }
    return decoded.data
  } catch (error) {
    throw new Error(`Invalid npub: ${error.message}`)
  }
}

const loadLocalConfig = async () => {
  try {
    const response = await fetch('/shop-config.json', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to read config (${response.status})`)
    }
    return await response.json()
  } catch {
    return {
      merchantNpub: LOCAL_DEFAULT_NPUB,
      discoveryRelays: DEFAULT_DISCOVERY_RELAYS
    }
  }
}

export const useShopIdentity = () => {
  const resolveIdentity = async () => {
    const config = await loadLocalConfig()
    const host = process.client ? window.location.hostname : ''

    const hostNpub = process.client && !isLocalHost(host)
      ? extractNpubFromHost(host)
      : null

    const merchantNpub = hostNpub || config.merchantNpub || LOCAL_DEFAULT_NPUB
    const discoveryRelays = Array.isArray(config.discoveryRelays) && config.discoveryRelays.length > 0
      ? config.discoveryRelays
      : DEFAULT_DISCOVERY_RELAYS

    return {
      merchantNpub,
      merchantPubkey: parsePubkey(merchantNpub),
      discoveryRelays,
      source: hostNpub ? 'hostname' : 'local-config'
    }
  }

  return {
    resolveIdentity
  }
}
