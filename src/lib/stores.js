// src/lib/stores.js
import { writable } from 'svelte/store'

export const userSession = writable(null)
export const hasSubmitted = writable(false)
export const predictions = writable([])