import { SimplePool } from 'nostr-tools/pool'

const ACTIVE_THEME_KIND = 16767
const THEME_DEFINITION_KIND = 36767

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const HSL_SPACE_PATTERN = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/i
const HSL_FUNCTION_PATTERN = /^hsl\(\s*(\d+(?:\.\d+)?)\s*[ ,]\s*(\d+(?:\.\d+)?)%\s*[ ,]\s*(\d+(?:\.\d+)?)%\s*\)$/i

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeHex = (value) => {
  const raw = String(value || '').trim()
  const match = raw.match(HEX_COLOR_PATTERN)
  if (!match) return null

  const clean = match[1].toLowerCase()
  if (clean.length === 3) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
  }

  return `#${clean}`
}

const hslToHex = (h, s, l) => {
  const hue = ((Number(h) % 360) + 360) % 360
  const sat = clamp(Number(s), 0, 100) / 100
  const lig = clamp(Number(l), 0, 100) / 100

  const chroma = (1 - Math.abs((2 * lig) - 1)) * sat
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lig - (chroma / 2)

  let rPrime = 0
  let gPrime = 0
  let bPrime = 0

  if (hue < 60) {
    rPrime = chroma
    gPrime = x
  } else if (hue < 120) {
    rPrime = x
    gPrime = chroma
  } else if (hue < 180) {
    gPrime = chroma
    bPrime = x
  } else if (hue < 240) {
    gPrime = x
    bPrime = chroma
  } else if (hue < 300) {
    rPrime = x
    bPrime = chroma
  } else {
    rPrime = chroma
    bPrime = x
  }

  const toChannel = (value) => Math.round((value + m) * 255)
  const rgb = [toChannel(rPrime), toChannel(gPrime), toChannel(bPrime)]
  const hex = rgb.map((value) => value.toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

const normalizeColor = (value) => {
  const asHex = normalizeHex(value)
  if (asHex) return asHex

  const raw = String(value || '').trim()

  const hslSpace = raw.match(HSL_SPACE_PATTERN)
  if (hslSpace) {
    return hslToHex(hslSpace[1], hslSpace[2], hslSpace[3])
  }

  const hslFunction = raw.match(HSL_FUNCTION_PATTERN)
  if (hslFunction) {
    return hslToHex(hslFunction[1], hslFunction[2], hslFunction[3])
  }

  return null
}

const hexToRgb = (value) => {
  const hex = normalizeHex(value)
  if (!hex) return null

  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  }
}

const rgbToHex = ({ r, g, b }) => {
  const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const mixHex = (from, to, ratio) => {
  const start = hexToRgb(from)
  const end = hexToRgb(to)
  if (!start || !end) return normalizeHex(from) || '#000000'

  const weight = clamp(Number(ratio) || 0, 0, 1)
  return rgbToHex({
    r: start.r + ((end.r - start.r) * weight),
    g: start.g + ((end.g - start.g) * weight),
    b: start.b + ((end.b - start.b) * weight)
  })
}

const parseColorTags = (tags = []) => {
  const colors = {
    background: null,
    text: null,
    primary: null
  }

  for (const tag of tags) {
    if (tag[0] !== 'c' || !tag[1] || !tag[2]) continue
    const role = String(tag[2]).toLowerCase()
    if (!colors[role]) {
      colors[role] = normalizeColor(tag[1])
    }
  }

  if (!colors.background || !colors.text || !colors.primary) {
    return null
  }

  return colors
}

const parseThemeContent = (event) => {
  if (!event?.content) return null

  try {
    const content = JSON.parse(event.content)
    const candidate = content?.colors || content

    const background = normalizeColor(candidate?.background)
    const text = normalizeColor(candidate?.text || candidate?.foreground)
    const primary = normalizeColor(candidate?.primary)

    if (!background || !text || !primary) return null
    return { background, text, primary }
  } catch {
    return null
  }
}

const parseThemeEvent = (event) => {
  return parseColorTags(event?.tags || []) || parseThemeContent(event)
}

const getLatest = (events = []) => {
  return [...events].sort((a, b) => b.created_at - a.created_at)[0] || null
}

const parseThemeReferenceTag = (event) => {
  const aTag = (event?.tags || []).find((tag) => tag[0] === 'a' && tag[1])
  if (!aTag) return null

  const [kindText, authorPubkey, dTag] = String(aTag[1]).split(':')
  const kind = Number(kindText)
  if (kind !== THEME_DEFINITION_KIND || !authorPubkey || !dTag) return null

  return {
    authorPubkey,
    dTag
  }
}

const relativeLuminance = (hex) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const normalize = (channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return (0.2126 * normalize(rgb.r)) + (0.7152 * normalize(rgb.g)) + (0.0722 * normalize(rgb.b))
}

const isDarkColor = (hex) => relativeLuminance(hex) < 0.3

export const deriveShopThemeVariables = (themeColors) => {
  if (!themeColors) return null

  const background = normalizeColor(themeColors.background)
  const text = normalizeColor(themeColors.text)
  const primary = normalizeColor(themeColors.primary)

  if (!background || !text || !primary) return null

  const darkMode = isDarkColor(background)

  const surface = darkMode ? mixHex(background, '#ffffff', 0.08) : mixHex(background, '#ffffff', 0.35)
  const line = darkMode ? mixHex(background, '#ffffff', 0.16) : mixHex(background, '#000000', 0.14)
  const muted = darkMode ? mixHex(text, background, 0.45) : mixHex(text, background, 0.5)
  const brandStrong = darkMode ? mixHex(primary, '#ffffff', 0.2) : mixHex(primary, '#000000', 0.22)
  const accent = darkMode ? mixHex(primary, background, 0.45) : mixHex(primary, background, 0.3)
  const gradientEnd = darkMode ? mixHex(background, '#ffffff', 0.08) : mixHex(background, '#000000', 0.08)

  return {
    mode: darkMode ? 'dark' : 'light',
    vars: {
      '--bg': background,
      '--surface': surface,
      '--line': line,
      '--text': text,
      '--muted': muted,
      '--brand': primary,
      '--brand-strong': brandStrong,
      '--accent': accent,
      '--bg-gradient': `linear-gradient(180deg, ${background} 0%, ${gradientEnd} 100%)`
    }
  }
}

export const applyMerchantThemeToDocument = (themeColors) => {
  if (!process.client) return null

  const derived = deriveShopThemeVariables(themeColors)
  if (!derived) return null

  const root = document.documentElement
  for (const [name, value] of Object.entries(derived.vars)) {
    root.style.setProperty(name, value)
  }

  root.setAttribute('data-merchant-theme', '1')
  root.setAttribute('data-theme', derived.mode)
  return derived.mode
}

export const clearMerchantThemeFromDocument = () => {
  if (!process.client) return

  const root = document.documentElement
  const keys = [
    '--bg',
    '--surface',
    '--line',
    '--text',
    '--muted',
    '--brand',
    '--brand-strong',
    '--accent',
    '--bg-gradient'
  ]

  for (const key of keys) {
    root.style.removeProperty(key)
  }

  root.removeAttribute('data-merchant-theme')
}

export const useMerchantTheme = () => {
  const pool = new SimplePool()

  const fetchMerchantTheme = async ({ merchantPubkey, relays }) => {
    const activeEvents = await pool.querySync(relays, {
      kinds: [ACTIVE_THEME_KIND],
      authors: [merchantPubkey],
      limit: 20
    })

    const activeEvent = getLatest(activeEvents)
    if (!activeEvent) {
      return {
        colors: null,
        source: 'none'
      }
    }

    const activeTheme = parseThemeEvent(activeEvent)
    if (activeTheme) {
      return {
        colors: activeTheme,
        source: 'kind16767',
        eventId: activeEvent.id
      }
    }

    const reference = parseThemeReferenceTag(activeEvent)
    if (reference) {
      const definitionEvents = await pool.querySync(relays, {
        kinds: [THEME_DEFINITION_KIND],
        authors: [reference.authorPubkey],
        '#d': [reference.dTag],
        limit: 10
      })

      const definitionEvent = getLatest(definitionEvents)
      const definitionTheme = parseThemeEvent(definitionEvent)
      if (definitionTheme) {
        return {
          colors: definitionTheme,
          source: 'kind36767',
          eventId: definitionEvent.id
        }
      }
    }

    return {
      colors: null,
      source: 'none'
    }
  }

  return {
    fetchMerchantTheme
  }
}
