import { SimplePool } from 'nostr-tools/pool'

export const useMerchantProfile = () => {
  const pool = new SimplePool()

  const fetchMerchantProfile = async ({ merchantPubkey, relays }) => {
    const events = await pool.querySync(relays, {
      kinds: [0],
      authors: [merchantPubkey],
      limit: 5
    })

    const latest = [...events].sort((a, b) => b.created_at - a.created_at)[0]
    if (!latest) return null

    try {
      const content = JSON.parse(latest.content || '{}')
      return {
        name: content.display_name || content.name || '',
        banner: content.banner || '',
        picture: content.picture || '',
        about: content.about || ''
      }
    } catch {
      return null
    }
  }

  return {
    fetchMerchantProfile
  }
}
