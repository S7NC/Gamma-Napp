<script setup>
import { useShopBootstrap } from '~/composables/useShopBootstrap'
import { useShopDebug } from '~/composables/useShopDebug'
import { useNostrMessages } from '~/composables/useNostrMessages'
import { useCartStore } from '~/stores/cart'
import ShopHeader from '~/components/shop/ShopHeader.vue'
import ShopFooter from '~/components/shop/ShopFooter.vue'

useSeoMeta({
  title: 'Contact',
  description: 'View merchant profile information and send a NIP-17 direct message.'
})

const cart = useCartStore()
const { ensureBootstrap, bootstrapState } = useShopBootstrap()
const { setShopDebug } = useShopDebug()
const { generateGuestDmIdentity, sendNip17Dm } = useNostrMessages()

const loading = ref(true)
const error = ref('')
const submitting = ref(false)
const success = ref('')
const merchantNpub = ref(bootstrapState.value.identity?.merchantNpub || '')
const merchantProfile = ref(bootstrapState.value.merchantProfile || null)
const merchantPubkey = ref(bootstrapState.value.identity?.merchantPubkey || '')
const merchantInboxRelays = ref(bootstrapState.value.relayMap?.merchantInbox || [])
const senderIdentity = ref(null)

const form = reactive({
  name: '',
  email: '',
  message: ''
})

const profileFields = computed(() => {
  const profile = merchantProfile.value || {}
  return [
    { label: 'Website', value: profile.website },
    { label: 'NIP-05', value: profile.nip05 },
    { label: 'Lightning', value: profile.lud16 },
    { label: 'npub', value: merchantNpub.value }
  ].filter((item) => String(item.value || '').trim())
})

const canSend = computed(() => {
  return !!(merchantPubkey.value && merchantInboxRelays.value.length > 0 && form.message.trim())
})

const buildMessageBody = () => {
  const lines = []

  if (form.name.trim()) lines.push(`Name: ${form.name.trim()}`)
  if (form.email.trim()) lines.push(`Email: ${form.email.trim()}`)

  lines.push('')
  lines.push(form.message.trim())

  return lines.join('\n')
}

const submitMessage = async () => {
  error.value = ''
  success.value = ''

  if (!form.message.trim()) {
    error.value = 'Please write a message before sending.'
    return
  }

  if (!merchantPubkey.value || merchantInboxRelays.value.length === 0) {
    error.value = 'Merchant inbox relays are not available right now.'
    return
  }

  try {
    submitting.value = true

    if (!senderIdentity.value) {
      senderIdentity.value = generateGuestDmIdentity()
    }

    await sendNip17Dm({
      senderSecretKey: senderIdentity.value.secretKey,
      merchantPubkey: merchantPubkey.value,
      relays: merchantInboxRelays.value,
      subject: 'Contact request',
      message: buildMessageBody()
    })

    success.value = 'Message sent over NIP-17. Keep your contact details in the message so the merchant can reply elsewhere if needed.'
    form.message = ''
  } catch (cause) {
    error.value = cause.message || 'Could not send your message.'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const bootstrap = await ensureBootstrap()
    const identity = bootstrap.identity
    const relayMap = bootstrap.relayMap

    merchantNpub.value = identity?.merchantNpub || ''
    merchantPubkey.value = identity?.merchantPubkey || ''
    merchantProfile.value = bootstrap.merchantProfile || null
    merchantInboxRelays.value = relayMap?.merchantInbox || []

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
      lastPage: 'contact',
      details: {
        hasNip05: !!bootstrap.merchantProfile?.nip05,
        hasLud16: !!bootstrap.merchantProfile?.lud16
      }
    })
  } catch (cause) {
    error.value = cause.message || 'Failed to load merchant contact details.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <ShopHeader :item-count="cart.totalItems" :merchant-profile="merchantProfile" :merchant-npub="merchantNpub" />

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:px-6 lg:px-8">
      <div class="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Contact</h1>
        </div>
      </div>

      <section v-if="loading" class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div class="h-80 animate-pulse rounded-3xl border border-[var(--line)] bg-[var(--surface)]" />
        <div class="h-80 animate-pulse rounded-3xl border border-[var(--line)] bg-[var(--surface)]" />
      </section>

      <section v-else class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div class="merchant-meta-panel overflow-hidden rounded-3xl border border-[var(--line)]">
          <div class="merchant-meta-head flex items-center gap-4 border-b border-[var(--line)] px-6 py-6">
            <img
              v-if="merchantProfile?.picture"
              :src="merchantProfile.picture"
              alt="Merchant profile"
              class="h-20 w-20 rounded-2xl border border-[var(--line)] object-cover shadow-sm"
            >
            <div v-else class="merchant-meta-avatar flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--line)] text-2xl font-bold">
              {{ merchantProfile?.name?.slice(0, 1) || 'M' }}
            </div>
            <div>
              <p class="merchant-meta-label text-xs font-semibold uppercase tracking-[0.18em]">Merchant metadata</p>
              <h2 class="mt-2 text-2xl font-semibold tracking-tight">{{ merchantProfile?.name || 'Merchant profile' }}</h2>
            </div>
          </div>

          <div class="grid gap-3 p-6 sm:grid-cols-2">
            <div v-if="merchantProfile?.about" class="merchant-meta-card rounded-2xl border border-[var(--line)] p-4 sm:col-span-2">
              <p class="merchant-meta-label text-xs font-semibold uppercase tracking-[0.16em]">About</p>
              <p class="mt-2 whitespace-pre-line text-sm font-medium">{{ merchantProfile.about }}</p>
            </div>
            <div
              v-for="field in profileFields"
              :key="field.label"
              class="merchant-meta-card rounded-2xl border border-[var(--line)] p-4"
              :class="field.label === 'npub' ? 'sm:col-span-2' : ''"
            >
              <p class="merchant-meta-label text-xs font-semibold uppercase tracking-[0.16em]">{{ field.label }}</p>
              <p class="mt-2 break-words text-sm font-medium">{{ field.value }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div>
            <h2 class="text-xl font-semibold tracking-tight">Send a direct message</h2>
          </div>

          <div class="mt-5 space-y-3">
            <input v-model="form.name" type="text" placeholder="Your name" class="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-black">
            <input v-model="form.email" type="email" placeholder="Your email" class="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-black">
            <textarea v-model="form.message" rows="8" placeholder="Write your message" class="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-black" />
          </div>

          <div class="merchant-message-hint mt-4 rounded-2xl border border-[var(--line)] p-4 text-sm">
            <p>Messages are sent from a temporary Nostr key generated in your browser.</p>
            <p v-if="senderIdentity" class="mt-2">Sender npub: <span class="font-mono text-xs">{{ senderIdentity.npub }}</span></p>
            <p class="mt-2">Include your preferred reply details in the message body so the merchant can answer you.</p>
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button
              class="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
              :disabled="submitting || !canSend"
              @click="submitMessage"
            >
              {{ submitting ? 'Sending...' : 'Send NIP-17 DM' }}
            </button>
            <p class="text-xs text-[var(--muted)]">{{ merchantInboxRelays.length }} inbox relays ready</p>
          </div>

          <p v-if="success" class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{{ success }}</p>
          <p v-if="error" class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{{ error }}</p>
        </div>
      </section>
    </main>

    <ShopFooter :merchant-profile="merchantProfile" :merchant-npub="merchantNpub" />
  </div>
</template>

<style scoped>
:global(html[data-theme='light']) .merchant-meta-panel,
:global(html[data-theme='light']) .merchant-meta-head,
:global(html[data-theme='light']) .merchant-meta-card {
  background: #ffffff;
  color: #000000;
}

:global(html[data-theme='dark']) .merchant-meta-panel,
:global(html[data-theme='dark']) .merchant-meta-head,
:global(html[data-theme='dark']) .merchant-meta-card {
  background: #000000;
  color: #ffffff;
}

:global(html[data-theme='light']) .merchant-meta-avatar {
  background: #f5f5f5;
  color: #4a4a4a;
}

:global(html[data-theme='dark']) .merchant-meta-avatar {
  background: #1c1c1c;
  color: #e5e5e5;
}

:global(html[data-theme='light']) .merchant-meta-label {
  color: #525252;
}

:global(html[data-theme='light']) .merchant-message-hint {
  background: #ffffff;
  color: #525252;
}

:global(html[data-theme='dark']) .merchant-meta-label {
  color: #b5b5b5;
}

:global(html[data-theme='dark']) .merchant-message-hint {
  background: #000000;
  color: #b5b5b5;
}
</style>
