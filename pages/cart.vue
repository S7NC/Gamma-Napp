<script setup>
import QRCode from 'qrcode'
import { useCartStore } from '~/stores/cart'
import { useShopBootstrap } from '~/composables/useShopBootstrap'
import { useRelayLists } from '~/composables/useRelayLists'
import { useNostrOrders } from '~/composables/useNostrOrders'
import { useFiatToSats } from '~/composables/useFiatToSats'
import { useLightningInvoice } from '~/composables/useLightningInvoice'
import { useMerchantProfile } from '~/composables/useMerchantProfile'
import { useShopDebug } from '~/composables/useShopDebug'
import ShopHeader from '~/components/shop/ShopHeader.vue'

useSeoMeta({
  title: 'Checkout',
  description: 'Gamma market compatible cart and checkout flow.'
})

const cart = useCartStore()
const { ensureBootstrap, bootstrapState } = useShopBootstrap()
const { resolveRelayMap } = useRelayLists()
const { generateGuestIdentity, buildOrderEvent, signAndPublish, findPaymentRequest } = useNostrOrders()
const { loading: ratesLoading, error: ratesError, convert, fetchRates } = useFiatToSats()
const { fetchMerchantLud16, requestInvoiceFromLud16 } = useLightningInvoice()
const { fetchMerchantProfile } = useMerchantProfile()
const { setShopDebug } = useShopDebug()

const step = ref(1)
const submitting = ref(false)
const loadingSetup = ref(true)
const error = ref('')
const setupError = ref('')
const relayMap = ref(null)
const merchantIdentity = ref(null)
const qrDataUrl = ref('')
const confirmSavedKeys = ref(false)
const pollTimer = ref(null)
const invoiceFallbackError = ref('')
const invoiceFallbackLoading = ref(false)
const merchantProfile = ref(bootstrapState.value.merchantProfile || null)
const merchantNpub = ref(bootstrapState.value.identity?.merchantNpub || '')

const form = reactive({
  name: cart.shippingInfo.name || '',
  addressLine1: cart.shippingInfo.addressLine1 || '',
  addressLine2: cart.shippingInfo.addressLine2 || '',
  city: cart.shippingInfo.city || '',
  postalCode: cart.shippingInfo.postalCode || '',
  country: cart.shippingInfo.country || '',
  email: cart.shippingInfo.email || '',
  phone: cart.shippingInfo.phone || '',
  notes: cart.shippingInfo.notes || '',
  shippingReference: cart.shippingReference || ''
})

const pricedCurrencies = computed(() => {
  return cart.items.map((item) => String(item.price?.currency || '').toUpperCase()).filter(Boolean)
})

const refreshRates = async () => {
  await fetchRates(pricedCurrencies.value)
}

const satAmount = (item) => {
  const currency = (item.price?.currency || '').toUpperCase()
  const amount = Number(item.price?.amount || 0)
  return convert(amount, currency)
}

const hasUnsupportedCurrency = computed(() => {
  return cart.items.some((item) => satAmount(item) === null)
})

const subtotalSats = computed(() => {
  if (hasUnsupportedCurrency.value) return 0
  return Math.round(cart.items.reduce((sum, item) => sum + (satAmount(item) * item.quantity), 0))
})

const shippingAddress = computed(() => {
  return [
    form.name,
    form.addressLine1,
    form.addressLine2,
    `${form.postalCode} ${form.city}`.trim(),
    form.country
  ].filter(Boolean).join(', ')
})

const currentOrderId = computed(() => cart.orderState.orderId)

const refreshRelayMap = async () => {
  if (!merchantIdentity.value) return

  relayMap.value = await resolveRelayMap({
    merchantPubkey: merchantIdentity.value.merchantPubkey,
    buyerPubkey: cart.guestKeys?.pubkey,
    discoveryRelays: merchantIdentity.value.discoveryRelays
  })
}

const setupCheckout = async () => {
  try {
    loadingSetup.value = true
    const bootstrap = await ensureBootstrap()
    merchantIdentity.value = bootstrap.identity
    merchantNpub.value = merchantIdentity.value.merchantNpub
    merchantProfile.value = bootstrap.merchantProfile || null

    if (cart.guestKeys?.pubkey) {
      await refreshRelayMap()
    } else {
      relayMap.value = bootstrap.relayMap
    }

    setShopDebug({
      merchantNpub: merchantIdentity.value.merchantNpub,
      merchantPubkey: merchantIdentity.value.merchantPubkey,
      identitySource: merchantIdentity.value.source,
      relaySource: relayMap.value?.sources?.merchant || '',
      themeSource: bootstrap.merchantThemeSource || 'none',
      merchantOutbox: relayMap.value?.merchantOutbox || [],
      merchantInbox: relayMap.value?.merchantInbox || [],
      paymentListenRelays: relayMap.value?.paymentListenRelays || [],
      orderPublishRelays: relayMap.value?.orderPublishRelays || [],
      lastPage: 'cart',
      details: {
        cartItems: cart.items.length,
        subtotalSats: subtotalSats.value
      }
    })

    if (!merchantProfile.value && relayMap.value?.merchantOutbox?.length) {
      merchantProfile.value = await fetchMerchantProfile({
        merchantPubkey: merchantIdentity.value.merchantPubkey,
        relays: relayMap.value.merchantOutbox
      })
    }
  } catch (cause) {
    setupError.value = cause.message || 'Could not initialize checkout.'
    console.error('[cart] checkout setup failed', cause)
  } finally {
    loadingSetup.value = false
  }
}

const saveForm = () => {
  cart.setShippingInfo({
    name: form.name,
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2,
    city: form.city,
    postalCode: form.postalCode,
    country: form.country,
    email: form.email,
    phone: form.phone,
    notes: form.notes
  })

  cart.shippingReference = form.shippingReference
}

const goToOverview = () => {
  error.value = ''
  if (!form.name || !form.addressLine1 || !form.city || !form.country || !form.email) {
    error.value = 'Please fill in all required shipping and contact fields.'
    return
  }

  saveForm()
  step.value = 2
}

const goToSubmit = () => {
  error.value = ''
  saveForm()
  step.value = 3
}

const ensureGuestKeys = async () => {
  if (cart.guestKeys?.nsec) return
  const keys = generateGuestIdentity()
  cart.setGuestKeys(keys)
  await refreshRelayMap()
}

const copyText = async (value) => {
  if (!process.client) return
  await navigator.clipboard.writeText(value)
}

const startPollingPayment = () => {
  clearInterval(pollTimer.value)

  const checkPayment = async () => {
    if (!relayMap.value || !merchantIdentity.value || !cart.guestKeys?.pubkey || !currentOrderId.value) return false

    const payment = await findPaymentRequest({
      merchantPubkey: merchantIdentity.value.merchantPubkey,
      buyerPubkey: cart.guestKeys.pubkey,
      orderId: currentOrderId.value,
      relays: relayMap.value.paymentListenRelays
    })

    if (!payment) return false
    console.log('[cart] received payment request', payment)

    cart.setOrderState({
      status: 'invoice-received',
      invoice: payment.invoice,
      invoiceAmount: payment.amount,
      invoiceExpiration: payment.expiration
    })

    clearInterval(pollTimer.value)
    return true
  }

  checkPayment()

  pollTimer.value = setInterval(async () => {
    await checkPayment()
  }, 8000)
}

const requestFallbackInvoice = async () => {
  invoiceFallbackError.value = ''

  if (!merchantIdentity.value || !relayMap.value || subtotalSats.value <= 0) {
    invoiceFallbackError.value = 'Missing merchant relay setup or order amount.'
    return
  }

  try {
    invoiceFallbackLoading.value = true
    const lud16 = await fetchMerchantLud16({
      merchantPubkey: merchantIdentity.value.merchantPubkey,
      relays: relayMap.value.merchantOutbox
    })

    const payment = await requestInvoiceFromLud16({
      lud16,
      amountSats: subtotalSats.value,
      comment: currentOrderId.value ? `order:${currentOrderId.value}` : 'gamma-market-order'
    })

    cart.setOrderState({
      status: 'invoice-received',
      invoice: payment.invoice,
      invoiceAmount: String(subtotalSats.value),
      invoiceExpiration: ''
    })
    console.log('[cart] fallback invoice from lud16', payment)
  } catch (cause) {
    invoiceFallbackError.value = cause.message || 'Could not request fallback lightning invoice.'
    console.error('[cart] fallback invoice request failed', cause)
  } finally {
    invoiceFallbackLoading.value = false
  }
}

const submitOrder = async () => {
  error.value = ''
  if (hasUnsupportedCurrency.value) {
    error.value = 'Unable to calculate sats total because at least one currency conversion is missing.'
    return
  }

  if (ratesLoading.value) {
    error.value = 'Fiat conversion rates are still loading. Please wait a moment and retry.'
    return
  }

  if (!relayMap.value || !merchantIdentity.value) {
    error.value = 'Relay map not available yet. Please wait and retry.'
    return
  }

  await ensureGuestKeys()

  if (!confirmSavedKeys.value) {
    error.value = 'Please confirm you saved your guest nsec key before submitting.'
    return
  }

  const orderId = cart.orderState.orderId || crypto.randomUUID().replaceAll('-', '').slice(0, 16)
  const items = cart.items.map((item) => ({
    reference: item.reference,
    quantity: item.quantity
  }))

  const eventTemplate = buildOrderEvent({
    merchantPubkey: merchantIdentity.value.merchantPubkey,
    orderId,
    amountSats: subtotalSats.value,
    items,
    shippingReference: form.shippingReference,
    address: shippingAddress.value,
    email: form.email,
    phone: form.phone,
    notes: form.notes
  })

  try {
    submitting.value = true
    const event = await signAndPublish({
      eventTemplate,
      nsec: cart.guestKeys.nsec,
      relays: relayMap.value.orderPublishRelays
    })

    cart.setOrderState({
      orderId,
      status: 'submitted',
      submittedEventId: event.id,
      invoice: '',
      invoiceAmount: '',
      invoiceExpiration: ''
    })
    console.log('[cart] submitted order event', { eventId: event.id, orderId, event })

    step.value = 4
    startPollingPayment()

    setTimeout(async () => {
      if (!cart.orderState.invoice) {
        await requestFallbackInvoice()
      }
    }, 1500)
  } catch (cause) {
    error.value = cause.message || 'Order submission failed.'
    console.error('[cart] order submission failed', cause)
  } finally {
    submitting.value = false
  }
}

watch(
  () => cart.orderState.invoice,
  async (invoice) => {
    if (!invoice) {
      qrDataUrl.value = ''
      return
    }

    qrDataUrl.value = await QRCode.toDataURL(`lightning:${invoice.toUpperCase()}`, {
      width: 280,
      margin: 1
    })
  },
  { immediate: true }
)

onMounted(async () => {
  await setupCheckout()

  if (cart.orderState.status === 'submitted' || cart.orderState.status === 'invoice-received') {
    step.value = 4
    startPollingPayment()
  }
})

onUnmounted(() => {
  clearInterval(pollTimer.value)
})

watch(pricedCurrencies, async () => {
  await refreshRates()
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen pb-12">
    <ShopHeader :item-count="cart.totalItems" :merchant-profile="merchantProfile" :merchant-npub="merchantNpub" />

    <main class="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold tracking-tight">Checkout</h1>

      <p class="mt-2 text-sm text-[var(--muted)]">
        1) Shipping info - 2) Review order - 3) Submit order - 4) Lightning invoice
      </p>

      <div class="mt-4 grid grid-cols-4 gap-2 text-xs font-semibold">
        <div v-for="n in 4" :key="n" class="rounded-lg border px-3 py-2 text-center"
             :class="step >= n ? 'border-[var(--brand)] bg-emerald-50 text-[var(--brand-strong)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'">
          Step {{ n }}
        </div>
      </div>

      <section v-if="loadingSetup" class="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
        Loading relay and merchant setup...
      </section>

      <section v-else-if="setupError" class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
        {{ setupError }}
      </section>

      <section v-else-if="cart.items.length === 0" class="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
        <p class="text-lg font-semibold">Your cart is empty.</p>
        <NuxtLink to="/" class="mt-4 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
          Browse products
        </NuxtLink>
      </section>

      <template v-else>
        <section class="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 class="text-lg font-semibold">Cart Items</h2>
          <ul class="mt-4 space-y-3">
            <li v-for="item in cart.items" :key="item.reference" class="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3">
              <div>
                <p class="font-medium">{{ item.title }}</p>
                <p class="text-xs text-[var(--muted)]">{{ item.price.display }}</p>
                <p v-if="satAmount(item) !== null" class="text-xs text-[var(--muted)]">
                  ~ {{ Math.round(satAmount(item)) }} sats each
                </p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  :value="item.quantity"
                  type="number"
                  min="1"
                  class="w-16 rounded-lg border border-[var(--line)] px-2 py-1"
                  @input="cart.updateQuantity(item.reference, Number($event.target.value))"
                >
                <button class="text-sm text-red-700" @click="cart.removeFromCart(item.reference)">Remove</button>
              </div>
            </li>
          </ul>
          <p v-if="ratesLoading" class="mt-3 text-xs text-[var(--muted)]">Updating fiat-to-btc conversion rates...</p>
          <p v-if="ratesError" class="mt-3 text-xs text-amber-700">{{ ratesError }}</p>
          <p class="mt-4 text-sm font-semibold">Subtotal: {{ subtotalSats }} sats</p>
        </section>

        <section v-if="step === 1" class="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 class="text-lg font-semibold">Shipping and Contact</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <input v-model="form.name" placeholder="Full name *" class="rounded-lg border border-[var(--line)] px-3 py-2">
            <input v-model="form.email" type="email" placeholder="Email *" class="rounded-lg border border-[var(--line)] px-3 py-2">
            <input v-model="form.phone" placeholder="Phone" class="rounded-lg border border-[var(--line)] px-3 py-2">
            <input v-model="form.country" placeholder="Country *" class="rounded-lg border border-[var(--line)] px-3 py-2">
            <input v-model="form.addressLine1" placeholder="Address line 1 *" class="rounded-lg border border-[var(--line)] px-3 py-2 sm:col-span-2">
            <input v-model="form.addressLine2" placeholder="Address line 2" class="rounded-lg border border-[var(--line)] px-3 py-2 sm:col-span-2">
            <input v-model="form.city" placeholder="City *" class="rounded-lg border border-[var(--line)] px-3 py-2">
            <input v-model="form.postalCode" placeholder="Postal code" class="rounded-lg border border-[var(--line)] px-3 py-2">
            <input v-model="form.shippingReference" placeholder="Shipping option ref (30406:...)" class="rounded-lg border border-[var(--line)] px-3 py-2 sm:col-span-2">
            <textarea v-model="form.notes" placeholder="Order notes" rows="3" class="rounded-lg border border-[var(--line)] px-3 py-2 sm:col-span-2" />
          </div>
          <button class="mt-4 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white" @click="goToOverview">
            Continue to review
          </button>
        </section>

        <section v-else-if="step === 2" class="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 class="text-lg font-semibold">Review Order</h2>
          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-[var(--muted)]">Ship to</dt><dd class="text-right">{{ shippingAddress }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-[var(--muted)]">Email</dt><dd>{{ form.email }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-[var(--muted)]">Phone</dt><dd>{{ form.phone || '-' }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-[var(--muted)]">Shipping ref</dt><dd>{{ form.shippingReference || '-' }}</dd></div>
            <div class="flex justify-between gap-3 text-base font-semibold"><dt>Total</dt><dd>{{ subtotalSats }} sats</dd></div>
          </dl>
          <div class="mt-4 flex gap-2">
            <button class="rounded-lg border border-[var(--line)] px-4 py-2 text-sm" @click="step = 1">Back</button>
            <button class="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white" @click="goToSubmit">Continue to submit</button>
          </div>
        </section>

        <section v-else-if="step === 3" class="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 class="text-lg font-semibold">Submit Order</h2>
          <p class="mt-2 text-sm text-[var(--muted)]">
            Guest checkout creates a fresh keypair to sign your order event.
          </p>

          <button
            v-if="!cart.guestKeys"
            class="mt-4 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
            @click="ensureGuestKeys"
          >
            Generate guest keys
          </button>

          <div v-if="cart.guestKeys" class="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <p class="font-semibold">Back up these keys now (required for order recovery):</p>
            <p class="mt-3"><span class="font-semibold">npub:</span> <span class="font-mono text-xs">{{ cart.guestKeys.npub }}</span></p>
            <p class="mt-2"><span class="font-semibold">nsec:</span> <span class="font-mono text-xs">{{ cart.guestKeys.nsec }}</span></p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button class="rounded border border-[var(--line)] bg-white px-3 py-1" @click="copyText(cart.guestKeys.npub)">Copy npub</button>
              <button class="rounded border border-[var(--line)] bg-white px-3 py-1" @click="copyText(cart.guestKeys.nsec)">Copy nsec</button>
            </div>
            <label class="mt-3 flex items-center gap-2">
              <input v-model="confirmSavedKeys" type="checkbox">
              <span>I saved the guest nsec key securely.</span>
            </label>
          </div>

          <div class="mt-4 flex gap-2">
            <button class="rounded-lg border border-[var(--line)] px-4 py-2 text-sm" @click="step = 2">Back</button>
            <button
              class="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
              :disabled="submitting"
              @click="submitOrder"
            >
              {{ submitting ? 'Submitting...' : 'Submit order event' }}
            </button>
          </div>
        </section>

        <section v-else class="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 class="text-lg font-semibold">Lightning Invoice</h2>
          <p class="mt-2 text-sm text-[var(--muted)]">Order: <span class="font-mono">{{ cart.orderState.orderId }}</span></p>

          <div v-if="cart.orderState.invoice" class="mt-4">
            <img :src="qrDataUrl" alt="Lightning invoice QR" class="h-72 w-72 rounded-xl border border-[var(--line)] bg-white p-2">
            <p class="mt-3 break-all text-xs font-mono">{{ cart.orderState.invoice }}</p>
            <p class="mt-2 text-sm">Amount: {{ cart.orderState.invoiceAmount || 'unknown' }} sats</p>
            <button class="mt-3 rounded border border-[var(--line)] bg-white px-3 py-1 text-sm" @click="copyText(cart.orderState.invoice)">Copy invoice</button>
          </div>

          <div v-else class="mt-4 rounded-xl border border-[var(--line)] bg-stone-50 p-4 text-sm text-[var(--muted)]">
            Waiting for merchant payment request (`kind:16`, `type:2`) on buyer inbox relays...
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <button
              class="rounded border border-[var(--line)] bg-white px-3 py-1 text-sm"
              :disabled="invoiceFallbackLoading"
              @click="requestFallbackInvoice"
            >
              {{ invoiceFallbackLoading ? 'Requesting invoice...' : 'Request invoice via merchant lud16' }}
            </button>
          </div>

          <p v-if="invoiceFallbackError" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {{ invoiceFallbackError }}
          </p>
        </section>
      </template>

      <p v-if="error" class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ error }}
      </p>

      <p v-if="hasUnsupportedCurrency" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        One or more product currencies could not be converted to sats. Please retry in a moment.
      </p>
    </main>
  </div>
</template>
