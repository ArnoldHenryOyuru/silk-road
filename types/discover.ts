export interface DiscoverProfile {
  id: string
  displayName: string
  age: number
  campus: string
  lookingFor: string | null
  verified: boolean
  isNew: boolean
  photoUrl: string | null
  initials: string
  liked: boolean
}
