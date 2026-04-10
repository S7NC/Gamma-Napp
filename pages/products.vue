<script setup>
import { useShopBootstrap } from '~/composables/useShopBootstrap'
import { useShopDebug } from '~/composables/useShopDebug'
import { useCartStore } from '~/stores/cart'
import ShopHeader from '~/components/shop/ShopHeader.vue'
import ProductCard from '~/components/shop/ProductCard.vue'

useSeoMeta({
  title: 'All Products | Gamma Market Webshop',
  description: 'Browse the full merchant inventory.'
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
const searchQuery = ref('')
const selectedCategories = ref([])

const UNCATEGORIZED_KEY = '__uncategorized__'

const normalizeCategory = (value) => String(value || '').trim()

const getCategoryKeys = (product) => {
  return Array.from(new Set(
    (product.categories || [])
      .map(normalizeCategory)
      .filter(Boolean)
      .map((category) => category.toLowerCase())
  ))
}

const categoryOptions = computed(() => {
  const counts = new Map()
  let uncategorizedCount = 0

  for (const product of products.value) {
    const normalizedCategories = Array.from(new Set(
      (product.categories || [])
        .map(normalizeCategory)
        .filter(Boolean)
    ))

    if (!normalizedCategories.length) {
      uncategorizedCount += 1
      continue
    }

    for (const category of normalizedCategories) {
      const key = category.toLowerCase()
      const entry = counts.get(key) || { key, label: category, count: 0 }
      entry.count += 1
      counts.set(key, entry)
    }
  }

  const options = Array.from(counts.values()).sort((a, b) => a.label.localeCompare(b.label))

  if (uncategorizedCount > 0) {
    options.push({ key: UNCATEGORIZED_KEY, label: 'Uncategorized', count: uncategorizedCount })
  }

  return options
})

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const selected = new Set(selectedCategories.value)

  return products.value.filter((product) => {
    const categoryKeys = getCategoryKeys(product)
    const isUncategorized = categoryKeys.length === 0

    const matchesCategory = selected.size === 0
      || (selected.has(UNCATEGORIZED_KEY) && isUncategorized)
      || categoryKeys.some((key) => selected.has(key))

    if (!matchesCategory) return false
    if (!query) return true

    const haystack = [
      product.title,
      product.summary,
      product.description,
      ...(product.categories || []),
      isUncategorized ? 'uncategorized' : ''
    ].join(' ').toLowerCase()

    return haystack.includes(query)
  })
})

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim().length > 0 || selectedCategories.value.length > 0
})

const resultCountLabel = computed(() => {
  if (!hasActiveFilters.value) {
    return `${products.value.length} items`
  }

  return `${filteredProducts.value.length} of ${products.value.length} items`
})

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategories.value = []
}

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
      lastPage: 'products',
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
        <div v-for="n in 9" :key="n" class="h-72 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]" />
      </section>

      <section v-else-if="hasConfirmedProductQuery && products.length === 0" class="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
        <p class="text-lg font-semibold">No products found for this merchant.</p>
        <p class="mt-2 text-sm text-[var(--muted)]">This npub currently has no published listings.</p>
      </section>

      <section v-else>
        <div class="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside class="h-fit rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 lg:sticky lg:top-24">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-semibold tracking-tight">Filters</h2>
              <button
                class="rounded border border-[var(--line)] px-2 py-1 text-xs"
                :disabled="!hasActiveFilters"
                @click="clearFilters"
              >
                Clear
              </button>
            </div>

            <div class="mt-4">
              <label for="product-search" class="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Search</label>
              <input
                id="product-search"
                v-model="searchQuery"
                type="search"
                placeholder="Search products"
                class="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-black"
              >
            </div>

            <div class="mt-5">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Categories</p>
              <div v-if="categoryOptions.length" class="mt-2 space-y-2">
                <label
                  v-for="option in categoryOptions"
                  :key="option.key"
                  class="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2 py-1.5"
                >
                  <span class="flex items-center gap-2 text-sm">
                    <input
                      v-model="selectedCategories"
                      type="checkbox"
                      :value="option.key"
                      class="h-4 w-4 rounded border-[var(--line)]"
                    >
                    <span>{{ option.label }}</span>
                  </span>
                  <span class="text-xs text-[var(--muted)]">{{ option.count }}</span>
                </label>
              </div>
              <p v-else class="mt-2 text-sm text-[var(--muted)]">No categories available.</p>
            </div>
          </aside>

          <div>
            <div class="mb-3 flex items-end justify-between gap-3">
              <h2 class="text-xl font-semibold tracking-tight">Full Inventory</h2>
              <p class="text-xs text-[var(--muted)]">{{ resultCountLabel }}</p>
            </div>

            <div v-if="filteredProducts.length === 0" class="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
              <p class="text-lg font-semibold">No matching products.</p>
              <p class="mt-2 text-sm text-[var(--muted)]">Try a different search term or clear filters.</p>
            </div>

            <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ProductCard
                v-for="product in filteredProducts"
                :key="product.id"
                :product="product"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
