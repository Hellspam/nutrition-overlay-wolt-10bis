// Confirm GEMINI_MODEL is a current, free-tier model at wire-up time:
// https://ai.google.dev/gemini-api/docs/models  and  /docs/rate-limits
export const GEMINI_MODEL = 'gemini-2.5-flash'
export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
export const MAX_RPM = 10            // requests per minute (free-tier safe default)
export const BATCH_SIZE = 12         // items per Gemini request
export const CACHE_SCHEMA_VERSION = 1 // bump to invalidate all cached estimates
export const CACHE_PREFIX = 'nut:'    // chrome.storage.local key prefix
export const API_KEY_STORAGE_KEY = 'geminiApiKey'
