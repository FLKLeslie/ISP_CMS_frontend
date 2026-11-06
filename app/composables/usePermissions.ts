// "May this account do that?" for the pages and components - one place, so they all agree.
//
//   const { can, canOpen } = usePermissions()
//   <button v-if="can('customers.manage')">Edit</button>
//   <NuxtLink v-if="canOpen('/admin/customers')" ...>
//
// This only decides what to SHOW. The server checks every request again, so hiding a button
// here is a courtesy (people shouldn't be offered things that will be refused), never a
// substitute for the server's check. The rules themselves are in utils/authPaths.ts.
export function usePermissions() {
  const authStore = useAuthStore()
  // Reads the store on every call, so a refreshed permission list takes effect immediately.
  const subject = () => authStore.user
  const can = (key: string): boolean => hasPermission(subject(), key)
  const canAny = (...keys: string[]): boolean => hasAnyPermission(subject(), keys)
  const canOpen = (path: string): boolean => canAccessAdminPath(path, subject())
  const isSuper = (): boolean => isSuperAdmin(authStore.user?.role)
  return { can, canAny, canOpen, isSuper }
}
