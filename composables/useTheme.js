const STORAGE_KEY = 'gamma-market-theme'

const normalizeTheme = (value) => {
  return value === 'light' ? 'light' : 'dark'
}

export const useTheme = () => {
  const theme = useState('theme-mode', () => 'dark')
  const bootstrapState = useState('shop-bootstrap-state', () => ({
    merchantTheme: null,
    merchantThemeMode: ''
  }))

  const hasMerchantTheme = computed(() => !!bootstrapState.value?.merchantTheme)

  watch(
    () => [hasMerchantTheme.value, bootstrapState.value?.merchantThemeMode],
    () => {
      if (!hasMerchantTheme.value) return
      const merchantMode = normalizeTheme(bootstrapState.value?.merchantThemeMode || 'dark')
      theme.value = merchantMode
      if (process.client) {
        document.documentElement.setAttribute('data-theme', merchantMode)
      }
    },
    { immediate: true }
  )

  const applyTheme = (nextTheme) => {
    if (hasMerchantTheme.value) {
      const merchantMode = bootstrapState.value?.merchantThemeMode || 'dark'
      theme.value = normalizeTheme(merchantMode)
      if (process.client) {
        document.documentElement.setAttribute('data-theme', theme.value)
      }
      return
    }

    const normalized = normalizeTheme(nextTheme)
    theme.value = normalized

    if (!process.client) return

    document.documentElement.setAttribute('data-theme', normalized)
    localStorage.setItem(STORAGE_KEY, normalized)
  }

  const initializeTheme = () => {
    if (hasMerchantTheme.value) {
      applyTheme(bootstrapState.value?.merchantThemeMode || 'dark')
      return
    }

    if (!process.client) return

    const stored = localStorage.getItem(STORAGE_KEY)
    applyTheme(stored || 'dark')
  }

  const toggleTheme = () => {
    if (hasMerchantTheme.value) return
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme,
    hasMerchantTheme,
    initializeTheme,
    applyTheme,
    toggleTheme
  }
}
