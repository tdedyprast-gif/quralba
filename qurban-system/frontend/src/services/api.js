import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL ?? ''
export const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const wsUrl = () => {
  if (!baseURL) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/ws/distribusi`
  }
  const u = new URL(baseURL)
  const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${u.host}/ws/distribusi`
}
