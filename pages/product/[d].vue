<script setup>
import { useShopBootstrap } from '~/composables/useShopBootstrap'
import { useMarketplace } from '~/composables/useMarketplace'
import { useShopDebug } from '~/composables/useShopDebug'
import { useCartStore } from '~/stores/cart'
import ShopHeader from '~/components/shop/ShopHeader.vue'

const route = useRoute()
const cart = useCartStore()
const { ensureBootstrap, bootstrapState } = useShopBootstrap()
const { fetchProductByD } = useMarketplace()
const { setShopDebug } = useShopDebug()

const product = ref(null)
const quantity = ref(1)
const loading = ref(true)
const error = ref('')
const merchantProfile = ref(bootstrapState.value.merchantProfile || null)
const merchantNpub = ref(bootstrapState.value.identity?.merchantNpub || '')

const decodedDTag = computed(() => {
  const raw = Array.isArray(route.params.d) ? route.params.d[0] : route.params.d
  try {
    return decodeURIComponent(raw || '')
  } catch {
    return raw || ''
  }
})

const canAdd = computed(() => {
  if (!product.value) return false
  if (product.value.stock === null) return true
  return product.value.stock > 0
})

const addToCart = () => {
  if (!product.value) return
  cart.addToCart(product.value, quantity.value)
}

onMounted(async () => {
  try {
    const bootstrap = await ensureBootstrap()
    const identity = bootstrap.identity
    const relayMap = bootstrap.relayMap

    merchantNpub.value = identity?.merchantNpub || ''
    merchantProfile.value = bootstrap.merchantProfile || null

    product.value = (bootstrap.products || []).find((entry) => entry.d === decodedDTag.value) || null
    if (!product.value && identity?.merchantPubkey && relayMap?.merchantOutbox?.length) {
      product.value = await fetchProductByD({
        merchantPubkey: identity.merchantPubkey,
        dTag: decodedDTag.value,
        relays: relayMap.merchantOutbox
      })
    }

    setShopDebug({
      merchantNpub: identity?.merchantNpub || '',
      merchantPubkey: identity?.merchantPubkey || '',
      identitySource: identity?.source || '',
      relaySource: relayMap?.sources?.merchant || '',
      themeSource: bootstrap.merchantThemeSource || 'none',
      merchantOutbox: relayMap?.merchantOutbox || [],
      merchantInbox: relayMap?.merchantInbox || [],
      paymentListenRelays: relayMap?.paymentListenRelays || [],
      orderPublishRelays: relayMap?.orderPublishRelays || [],
      lastPage: 'product',
      details: {
        productDTag: decodedDTag.value,
        found: !!product.value
      }
    })

    if (!product.value) {
      error.value = 'Product not found.'
    }
  } catch (cause) {
    error.value = cause.message || 'Failed to load product.'
    console.error('[product] failed loading product', cause)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen pb-12">
    <ShopHeader :item-count="cart.totalItems" :merchant-profile="merchantProfile" :merchant-npub="merchantNpub" />

    <main class="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="text-sm font-medium">← Back to products</NuxtLink>

      <section v-if="loading" class="mt-4 grid animate-pulse gap-6 lg:grid-cols-2">
        <div class="h-80 rounded-2xl bg-[var(--surface)]" />
        <div class="h-80 rounded-2xl bg-[var(--surface)]" />
      </section>

      <section v-else-if="error" class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
        {{ error }}
      </section>

      <section v-else-if="product" class="mt-4 grid gap-8 lg:grid-cols-2">
        <div class="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <img
            v-if="product.image"
            :src="product.image"
            :alt="product.title"
            class="h-full w-full object-cover"
          >
          <div v-else class="flex min-h-80 items-center justify-center text-sm text-[var(--muted)]">
            No image available
          </div>
        </div>

        <div>
          <h1 class="text-3xl font-bold tracking-tight">{{ product.title }}</h1>
          <p class="mt-3 text-lg font-semibold">{{ product.price.display }}</p>
          <p class="mt-4 text-[var(--muted)] whitespace-pre-line">{{ product.description || product.summary }}</p>

          <div v-if="product.specs.length" class="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">Specs</h2>
            <dl class="mt-3 space-y-2 text-sm">
              <div v-for="spec in product.specs" :key="`${spec.key}:${spec.value}`" class="flex justify-between gap-3">
                <dt class="text-[var(--muted)]">{{ spec.key }}</dt>
                <dd class="font-medium">{{ spec.value }}</dd>
              </div>
            </dl>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <label class="text-sm text-[var(--muted)]">Quantity</label>
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              class="w-20 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-black"
            >
            <button
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              :class="canAdd ? 'bg-[var(--brand)] hover:bg-[var(--brand-strong)]' : 'cursor-not-allowed bg-stone-400'"
              :disabled="!canAdd"
              @click="addToCart"
            >
              {{ canAdd ? 'Add to cart' : 'Out of stock' }}
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
