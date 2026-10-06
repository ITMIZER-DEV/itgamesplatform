export type UserRole = 'admin' | 'athlete' | 'judge'

export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  role: UserRole | null
  idPerson: string | null
}
