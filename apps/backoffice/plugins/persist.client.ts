export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  const snapshot = localStorage.getItem('backoffice-auth')

  if (snapshot) auth.$patch(JSON.parse(snapshot))

  auth.$subscribe((_mutation, state) => {
    localStorage.setItem('backoffice-auth', JSON.stringify(state))
  })
})
