<script setup>
import { useTheme } from '~/composables/useTheme'
import { useShopBootstrap } from '~/composables/useShopBootstrap'

defineProps({
  itemCount: {
    type: Number,
    default: 0
  },
  merchantProfile: {
    type: Object,
    default: null
  },
  merchantNpub: {
    type: String,
    default: ''
  }
})

const { theme, hasMerchantTheme, initializeTheme, toggleTheme } = useTheme()
const { ensureBootstrap } = useShopBootstrap()
const NOSTR_OSTRICH_ICON_URL = '/nostr-assets/nostr-logo-black.svg'

const route = useRoute()
const showSearchModal = ref(false)
const showMobileMenu = ref(false)
const searchQuery = ref('')
const searchLoading = ref(false)
const searchError = ref('')
const searchInventory = useState('shop-search-inventory', () => [])
const hasLoadedSearchInventory = useState('shop-search-loaded', () => false)

const loadSearchInventory = async () => {
  if (searchLoading.value || hasLoadedSearchInventory.value) return

  searchLoading.value = true
  searchError.value = ''

  try {
    const bootstrap = await ensureBootstrap()
    searchInventory.value = bootstrap.products || []
    hasLoadedSearchInventory.value = true
  } catch (cause) {
    searchError.value = cause.message || 'Could not load products for search.'
  } finally {
    searchLoading.value = false
  }
}

const openSearchModal = async () => {
  showSearchModal.value = true
  showMobileMenu.value = false

  if (!hasLoadedSearchInventory.value) {
    await loadSearchInventory()
  }
}

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []

  return searchInventory.value.filter((product) => {
    const categories = (product.categories || []).map((category) => String(category || '').trim()).filter(Boolean)
    const haystack = [
      product.title,
      product.summary,
      product.description,
      ...categories,
      categories.length ? '' : 'uncategorized'
    ].join(' ').toLowerCase()

    return haystack.includes(query)
  }).slice(0, 5)
})

const productPath = (product) => `/product/${encodeURIComponent(product.d)}`

watch(() => route.fullPath, () => {
  showSearchModal.value = false
  showMobileMenu.value = false
})

onMounted(() => {
  initializeTheme()
})
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-[var(--line)] bg-[color:var(--surface)]/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6 lg:px-8">
      <div class="flex flex-1 justify-start">
        <NuxtLink to="/" class="flex items-center gap-3 text-lg font-semibold tracking-tight">
        <img
          v-if="merchantProfile?.picture"
          :src="merchantProfile.picture"
          alt="Merchant profile"
          class="h-9 w-9 rounded-full border border-[var(--line)] object-cover"
        >
        <div v-else class="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-stone-100 text-xs font-bold text-[var(--muted)]">
          M
        </div>
        <span>{{ merchantProfile?.name || 'loading' }}</span>
        </NuxtLink>
      </div>

      <nav class="hidden items-center gap-4 text-sm font-medium sm:gap-6 md:flex">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/products">Products</NuxtLink>
        <NuxtLink to="/categories">Categories</NuxtLink>
        <button class="cursor-pointer" @click="openSearchModal">Search</button>
      </nav>

      <nav class="flex flex-1 items-center justify-end gap-4 text-sm font-medium">
        <NuxtLink to="/cart" class="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-2 py-1.5">
          <span class="sr-only">Open cart</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="18" cy="20" r="1.5" />
            <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 7H7.5" />
          </svg>
          <span class="text-xs font-semibold">{{ itemCount }}</span>
        </NuxtLink>

        <a
          v-if="merchantNpub"
          :href="`https://njump.me/${merchantNpub}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)]"
        >
          <span class="sr-only">Open merchant npub</span>
          <img
            :src="NOSTR_OSTRICH_ICON_URL"
            alt=""
            class="h-5 w-5 object-contain"
            :style="{ filter: theme === 'dark' ? 'invert(1)' : 'none' }"
            aria-hidden="true"
          >
        </a>

        <button
          v-if="!hasMerchantTheme"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)]"
          @click="toggleTheme"
        >
          <span class="sr-only">{{ theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }}</span>

          <svg
            v-if="theme === 'dark'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>

          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9z" />
          </svg>
        </button>

        <button
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] md:hidden"
          @click="showMobileMenu = !showMobileMenu"
        >
          <span class="sr-only">Toggle menu</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <path v-if="!showMobileMenu" d="M4 7h16M4 12h16M4 17h16" />
            <path v-else d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </nav>
    </div>
  </header>

  <div v-if="showMobileMenu" class="border-b border-[var(--line)] bg-[var(--surface)] md:hidden">
    <nav class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm font-medium sm:px-6 lg:px-8">
      <NuxtLink to="/" class="rounded-lg px-3 py-2">Home</NuxtLink>
      <NuxtLink to="/products" class="rounded-lg px-3 py-2">Products</NuxtLink>
      <NuxtLink to="/categories" class="rounded-lg px-3 py-2">Categories</NuxtLink>
      <button class="rounded-lg px-3 py-2 text-left" @click="openSearchModal">Search</button>
    </nav>
  </div>

  <div
    v-if="showSearchModal"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20"
    @click.self="showSearchModal = false"
  >
    <div class="w-full max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Search Products</h2>
        <button class="rounded border border-[var(--line)] px-2 py-1 text-xs" @click="showSearchModal = false">Close</button>
      </div>

      <input
        v-model="searchQuery"
        type="search"
        placeholder="Type to search products"
        class="mt-4 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-black"
      >

      <p v-if="searchLoading" class="mt-3 text-sm text-[var(--muted)]">Loading inventory…</p>
      <p v-else-if="searchError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">{{ searchError }}</p>
      <p v-else-if="!searchQuery.trim()" class="mt-3 text-sm text-[var(--muted)]">Start typing to see up to 5 matching products.</p>
      <p v-else-if="searchResults.length === 0" class="mt-3 text-sm text-[var(--muted)]">No matching products.</p>

      <div v-else class="mt-3 space-y-2">
        <NuxtLink
          v-for="product in searchResults"
          :key="product.id"
          :to="productPath(product)"
          class="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2 hover:bg-black/5"
        >
          <span class="min-w-0 truncate text-sm font-medium">{{ product.title }}</span>
          <span class="shrink-0 text-xs text-[var(--muted)]">{{ product.price.display }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
