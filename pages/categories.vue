<script setup>
import { useShopBootstrap } from '~/composables/useShopBootstrap'
import { useShopDebug } from '~/composables/useShopDebug'
import { useCartStore } from '~/stores/cart'
import ShopHeader from '~/components/shop/ShopHeader.vue'

useSeoMeta({
  title: 'Categories | Gamma Market Webshop',
  description: 'Browse product categories from current inventory.'
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

const categoryBlocks = computed(() => {
  const byKey = new Map()

  for (const product of products.value) {
    const tags = Array.from(new Set(
      (product.categories || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ))

    for (const category of tags) {
      const key = category.toLowerCase()
      const entry = byKey.get(key) || {
        key,
        label: category,
        count: 0
      }
      entry.count += 1
      byKey.set(key, entry)
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label)
  })
})

onMounted(async () => {
  try {
    const bootstrap = await ensureBootstrap()
    const identity = bootstrap.identity
    const relayMap = bootstrap.relayMap

    merchantNpub.value = identity?.merchantNpub || ''
    merchantProfile.value = bootstrap.merchantProfile || null
    products.value = bootstrap.products || []
    hasConfirmedProductQuery.value = true

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
      lastPage: 'categories',
      details: {
        productsLoaded: products.value.length,
        categoriesLoaded: categoryBlocks.value.length
      }
    })
  } catch (cause) {
    relayWarning.value = 'Relay connection failed while loading categories. Please retry once relays are reachable.'
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
        <div v-for="n in 6" :key="n" class="h-28 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]" />
      </section>

      <section v-else-if="hasConfirmedProductQuery && categoryBlocks.length === 0" class="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
        <p class="text-lg font-semibold">No categories found.</p>
        <p class="mt-2 text-sm text-[var(--muted)]">This merchant has no category tags on their current product listings.</p>
      </section>

      <section v-else>
        <div class="mb-4 flex items-end justify-between gap-3">
          <h1 class="text-2xl font-semibold tracking-tight">Categories</h1>
          <p class="text-xs text-[var(--muted)]">{{ categoryBlocks.length }} categories</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="category in categoryBlocks"
            :key="category.key"
            class="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
          >
            <p class="text-lg font-semibold">{{ category.label }}</p>
            <p class="mt-1 text-sm text-[var(--muted)]">{{ category.count }} products</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
