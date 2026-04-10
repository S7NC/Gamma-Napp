import { useShopIdentity } from '~/composables/useShopIdentity'
import { useRelayLists } from '~/composables/useRelayLists'
import { useMarketplace } from '~/composables/useMarketplace'
import { useMerchantProfile } from '~/composables/useMerchantProfile'
import {
  useMerchantTheme,
  applyMerchantThemeToDocument,
  clearMerchantThemeFromDocument
} from '~/composables/useMerchantTheme'

let bootstrapPromise = null

export const useShopBootstrap = () => {
  const { resolveIdentity } = useShopIdentity()
  const { resolveRelayMap } = useRelayLists()
  const { fetchProducts } = useMarketplace()
  const { fetchMerchantProfile } = useMerchantProfile()
  const { fetchMerchantTheme } = useMerchantTheme()

  const state = useState('shop-bootstrap-state', () => ({
    isBootstrapping: false,
    isBootstrapped: false,
    error: '',
    identity: null,
    relayMap: null,
    merchantProfile: null,
    products: [],
    merchantTheme: null,
    merchantThemeSource: 'none',
    merchantThemeMode: ''
  }))

  const ensureBootstrap = async ({ force = false } = {}) => {
    if (state.value.isBootstrapped && !force) {
      return state.value
    }

    if (bootstrapPromise) {
      return bootstrapPromise
    }

    state.value = {
      ...state.value,
      isBootstrapping: true,
      error: ''
    }

    bootstrapPromise = (async () => {
      try {
        const identity = await resolveIdentity()
        const relayMap = await resolveRelayMap({
          merchantPubkey: identity.merchantPubkey,
          discoveryRelays: identity.discoveryRelays
        })

        const [merchantProfile, products, merchantThemeResult] = await Promise.all([
          fetchMerchantProfile({
            merchantPubkey: identity.merchantPubkey,
            relays: relayMap.merchantOutbox
          }).catch(() => null),
          fetchProducts({
            merchantPubkey: identity.merchantPubkey,
            relays: relayMap.merchantOutbox
          }),
          fetchMerchantTheme({
            merchantPubkey: identity.merchantPubkey,
            relays: relayMap.merchantOutbox
          }).catch(() => ({ colors: null, source: 'none' }))
        ])

        const merchantTheme = merchantThemeResult?.colors || null
        const merchantThemeSource = merchantThemeResult?.source || 'none'
        const merchantThemeMode = merchantTheme
          ? (applyMerchantThemeToDocument(merchantTheme) || '')
          : ''

        if (!merchantTheme) {
          clearMerchantThemeFromDocument()
        }

        state.value = {
          ...state.value,
          isBootstrapping: false,
          isBootstrapped: true,
          error: '',
          identity,
          relayMap,
          merchantProfile,
          products,
          merchantTheme,
          merchantThemeSource,
          merchantThemeMode
        }

        return state.value
      } catch (cause) {
        state.value = {
          ...state.value,
          isBootstrapping: false,
          isBootstrapped: false,
          error: cause.message || 'Failed to load shop data.'
        }
        throw cause
      } finally {
        bootstrapPromise = null
      }
    })()

    return bootstrapPromise
  }

  return {
    bootstrapState: state,
    ensureBootstrap
  }
}
