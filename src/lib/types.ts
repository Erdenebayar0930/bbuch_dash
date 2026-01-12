export interface UserProfile {
  name: string;
  role: "admin" | "user" | "staff";
  photoURL?: string;
}