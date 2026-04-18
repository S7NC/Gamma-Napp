<script setup>
import NsiteCloneFab from '~/components/shop/NsiteCloneFab.vue'

const props = defineProps({
  merchantProfile: {
    type: Object,
    default: null
  },
  merchantNpub: {
    type: String,
    default: ''
  }
})

const year = new Date().getFullYear()

const footerTitle = computed(() => {
  return props.merchantProfile?.name || 'Nostr Boutique'
})

const websiteUrl = computed(() => {
  const raw = String(props.merchantProfile?.website || props.merchantProfile?.url || '').trim()
  if (!raw) return ''
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
})

const websiteLabel = computed(() => {
  if (!websiteUrl.value) return ''
  return websiteUrl.value.replace(/^https?:\/\//, '')
})

const hasPaypal = computed(() => {
  return String(props.merchantProfile?.paypal || '').trim().length > 0
})

</script>

<template>
  <footer class="mt-12 border-t border-[var(--line)] bg-[var(--surface)]/70">
    <div class="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.5fr_0.7fr_0.9fr] lg:px-8">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Nostr Boutique</p>
        <h2 class="mt-2 text-xl font-semibold tracking-tight">{{ footerTitle }}</h2>
        <a
          v-if="websiteUrl"
          :href="websiteUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-3 inline-flex text-sm font-medium underline underline-offset-4 hover:text-[var(--text)]"
        >
          {{ websiteLabel }}
        </a>
      </div>

      <div class="flex flex-col items-center justify-center gap-2 place-self-center">
        <div class="inline-flex items-center" aria-label="Bitcoin payment option">
          <img src="/btc-button.png" alt="Pay with Bitcoin" class="h-9 w-auto">
        </div>
        <div
          v-if="hasPaypal"
          class="inline-flex items-center"
          aria-label="PayPal payment option"
        >
          <img src="/paypal-button.png" alt="Pay with PayPal" class="h-8 w-auto">
        </div>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Browse</p>
        <div class="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-medium md:grid-cols-3">
          <NuxtLink to="/">Home</NuxtLink>
          <NuxtLink to="/products">Products</NuxtLink>
          <NuxtLink to="/categories">Categories</NuxtLink>
          <NuxtLink to="/contact">About us</NuxtLink>
          <NuxtLink to="/cart">Cart</NuxtLink>
        </div>
      </div>
    </div>

    <div class="border-t border-[var(--line)]">
      <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-xs text-[var(--muted)] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <p>{{ year }} {{ footerTitle }}. Powered by Nostr.</p>
          <p class="mt-1">Decentralized products, merchant-owned identity.</p>
        </div>
        <div class="md:ml-auto">
          <NsiteCloneFab embedded />
        </div>
      </div>
    </div>
  </footer>
</template>
