export interface DiscoverCampusOption {
  value: string
  label: string
  terms: string[]
}

export interface DiscoverLookingForOption {
  value: string
  label: string
  terms: string[]
}

export const DISCOVER_CAMPUS_OPTIONS: DiscoverCampusOption[] = [
  { value: 'Makerere', label: 'Makerere', terms: ['Makerere'] },
  { value: 'MUBS', label: 'MUBS', terms: ['MUBS'] },
  { value: 'Kyambogo', label: 'Kyambogo', terms: ['Kyambogo'] },
  { value: 'UCU', label: 'UCU', terms: ['UCU', 'Uganda Christian'] },
  { value: 'KIU', label: 'KIU', terms: ['KIU', 'Kampala International'] },
  { value: 'IUIU', label: 'IUIU', terms: ['IUIU', 'Islamic University'] },
  { value: 'Other', label: 'Other', terms: ['Other'] },
]

export const DISCOVER_LOOKING_FOR_OPTIONS: DiscoverLookingForOption[] = [
  { value: 'Dating', label: 'Dating', terms: ['Dating'] },
  { value: 'Something casual', label: 'Something casual', terms: ['casual'] },
  { value: 'Long-term', label: 'Long-term', terms: ['Long-term'] },
  { value: 'Friends', label: 'Friends', terms: ['friend'] },
]

export interface DiscoverFilters {
  campuses: string[]
  lookingFor: string[]
  minAge: number | null
  maxAge: number | null
  verifiedOnly: boolean
}

export const EMPTY_DISCOVER_FILTERS: DiscoverFilters = {
  campuses: [],
  lookingFor: [],
  minAge: null,
  maxAge: null,
  verifiedOnly: false,
}

const VALID_CAMPUSES = new Set(DISCOVER_CAMPUS_OPTIONS.map((o) => o.value))
const VALID_LOOKING_FOR = new Set(DISCOVER_LOOKING_FOR_OPTIONS.map((o) => o.value))

function splitParam(raw?: string | string[]): string[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list
    .flatMap((item) => item.split(','))
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseAgeBound(raw?: string | string[]): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const num = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(num)) return null
  return Math.min(99, Math.max(18, num))
}

export function parseDiscoverFilters(params: {
  campus?: string | string[]
  lookingFor?: string | string[]
  minAge?: string | string[]
  maxAge?: string | string[]
  verified?: string | string[]
}): DiscoverFilters {
  const campuses = [...new Set(splitParam(params.campus).filter((c) => VALID_CAMPUSES.has(c)))]
  const lookingFor = [
    ...new Set(splitParam(params.lookingFor).filter((l) => VALID_LOOKING_FOR.has(l))),
  ]

  let minAge = parseAgeBound(params.minAge)
  let maxAge = parseAgeBound(params.maxAge)
  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    ;[minAge, maxAge] = [maxAge, minAge]
  }

  const verifiedRaw = Array.isArray(params.verified) ? params.verified[0] : params.verified
  const verifiedOnly = verifiedRaw === '1' || verifiedRaw === 'true'

  return {
    campuses,
    lookingFor,
    minAge,
    maxAge,
    verifiedOnly,
  }
}

export function countActiveDiscoverFilters(filters: DiscoverFilters): number {
  let count = filters.campuses.length + filters.lookingFor.length
  if (filters.minAge !== null || filters.maxAge !== null) count += 1
  if (filters.verifiedOnly) count += 1
  return count
}

export function buildDiscoverHref(filters: DiscoverFilters, page = 1): string {
  const sp = new URLSearchParams()
  if (filters.campuses.length > 0) sp.set('campus', filters.campuses.join(','))
  if (filters.lookingFor.length > 0) sp.set('lookingFor', filters.lookingFor.join(','))
  if (filters.minAge !== null) sp.set('minAge', String(filters.minAge))
  if (filters.maxAge !== null) sp.set('maxAge', String(filters.maxAge))
  if (filters.verifiedOnly) sp.set('verified', '1')
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return qs ? `/discover?${qs}` : '/discover'
}

interface FilterableQuery<T> {
  or: (expr: string) => T
  gte: (col: string, val: unknown) => T
  lte: (col: string, val: unknown) => T
  eq: (col: string, val: unknown) => T
}

export function applyDiscoverFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: DiscoverFilters
): T {
  let q = query

  if (filters.campuses.length > 0) {
    const campusTerms = filters.campuses.flatMap((c) => {
      const opt = DISCOVER_CAMPUS_OPTIONS.find((o) => o.value === c)
      return opt ? opt.terms : [c]
    })
    const orExpr = campusTerms.map((term) => `campus.ilike.%${term}%`).join(',')
    q = q.or(orExpr)
  }

  if (filters.lookingFor.length > 0) {
    const intentTerms = filters.lookingFor.flatMap((l) => {
      const opt = DISCOVER_LOOKING_FOR_OPTIONS.find((o) => o.value === l)
      return opt ? opt.terms : [l]
    })
    const orExpr = intentTerms.map((term) => `looking_for.ilike.%${term}%`).join(',')
    q = q.or(orExpr)
  }

  if (filters.minAge !== null) {
    q = q.gte('age', filters.minAge)
  }
  if (filters.maxAge !== null) {
    q = q.lte('age', filters.maxAge)
  }
  if (filters.verifiedOnly) {
    q = q.eq('face_match_verified', true)
  }

  return q
}
