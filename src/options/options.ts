import { API_KEY_STORAGE_KEY } from '../shared/constants'

const input = document.getElementById('key') as HTMLInputElement
const status = document.getElementById('status') as HTMLElement

chrome.storage.local.get(API_KEY_STORAGE_KEY).then((out) => {
  const v = out[API_KEY_STORAGE_KEY]
  if (typeof v === 'string') input.value = v
})

document.getElementById('save')!.addEventListener('click', async () => {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: input.value.trim() })
  status.textContent = 'נשמר ✓'
  setTimeout(() => (status.textContent = ''), 2000)
})
