<script setup>
import { useShopBootstrap } from '~/composables/useShopBootstrap'
import { useShopDebug } from '~/composables/useShopDebug'
import { useCartStore } from '~/stores/cart'
import ShopHeader from '~/components/shop/ShopHeader.vue'
import ProductCard from '~/components/shop/ProductCard.vue'

useSeoMeta({
  title: 'Gamma Market Webshop',
  description: 'Minimal NIP-99 webshop with Gamma market checkout flow.'
})

const cart = useCartStore()
const { ensureBootstrap, bootstrapState } = useShopBootstrap()
const { setShopDebug } = useShopDebug()

const loading = ref(true)
const error = ref('')
const relayWarning = ref('')
const merchantNpub = ref(bootstrapState.value.identity?.merchantNpub || '')
const products = ref(bootstrapState.value.products || [])
const merchantProfile = ref(bootstrapState.value.merchantProfile || null)
const hasConfirmedProductQuery = ref(false)
const showNoProductsDialog = ref(false)

const latestProducts = computed(() => products.value.slice(0, 3))
const inventoryProducts = computed(() => products.value.slice(3, 15))

onMounted(async () => {
  try {
    const bootstrap = await ensureBootstrap()
    const identity = bootstrap.identity
    const relayMap = bootstrap.relayMap

    merchantNpub.value = identity?.merchantNpub || ''
    merchantProfile.value = bootstrap.merchantProfile || null
    products.value = bootstrap.products || []
    hasConfirmedProductQuery.value = true
    showNoProductsDialog.value = products.value.length === 0

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
      lastPage: 'index',
      details: {
        productsLoaded: products.value.length,
        noProductsConfirmed: products.value.length === 0
      }
    })
  } catch (cause) {
    relayWarning.value = 'Relay connection failed while loading products. Please retry once relays are reachable.'
    error.value = ''
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen pb-12">
    <ShopHeader :item-count="cart.totalItems" :merchant-profile="merchantProfile" :merchant-npub="merchantNpub" />

    <main class="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
      <section v-if="relayWarning" class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        {{ relayWarning }}
      </section>

      <section v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
        {{ error }}
      </section>

      <section v-else-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="n in 6" :key="n" class="h-72 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]" />
      </section>

      <section v-else-if="hasConfirmedProductQuery && products.length === 0" class="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
        <p class="text-lg font-semibold">No products found for this merchant.</p>
        <p class="mt-2 text-sm text-[var(--muted)]">This npub currently has no published listings.</p>
      </section>

      <section v-else>
        <div class="mb-8">
          <div class="mb-3 flex items-end justify-between gap-3">
            <h2 class="text-xl font-semibold tracking-tight">New Arrivals</h2>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProductCard
              v-for="product in latestProducts"
              :key="product.id"
              :product="product"
            />
          </div>
        </div>

        <div v-if="inventoryProducts.length">
          <div class="mb-3 flex items-end justify-between gap-3">
            <h2 class="text-xl font-semibold tracking-tight">Inventory</h2>
            <p class="text-xs text-[var(--muted)]">Everything else in stock</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProductCard
              v-for="product in inventoryProducts"
              :key="product.id"
              :product="product"
            />
          </div>
        </div>
      </section>
    </main>

    <div
      v-if="showNoProductsDialog && hasConfirmedProductQuery && !relayWarning && !error"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      @click.self="showNoProductsDialog = false"
    >
      <div class="w-full max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl">
        <h2 class="text-2xl font-bold">No products yet</h2>
        <p class="mt-3 text-sm text-[var(--muted)]">
          Hey! Ready to start listing your first products?
        </p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          Visit one of these marketplaces to publish your first listings:
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <a href="https://plebeian.market" target="_blank" rel="noopener noreferrer" class="rounded-full border border-[var(--line)] px-3 py-1 text-sm">plebeian.market</a>
          <a href="https://shopstr.store" target="_blank" rel="noopener noreferrer" class="rounded-full border border-[var(--line)] px-3 py-1 text-sm">shopstr.store</a>
          <a href="https://conduit.market" target="_blank" rel="noopener noreferrer" class="rounded-full border border-[var(--line)] px-3 py-1 text-sm">conduit.market</a>
        </div>

        <div class="mt-6 flex justify-end">
          <button class="rounded-lg border border-[var(--line)] px-4 py-2 text-sm" @click="showNoProductsDialog = false">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
