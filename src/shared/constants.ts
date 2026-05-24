// Confirm GEMINI_MODEL is a current, free-tier model at wire-up time:
// https://ai.google.dev/gemini-api/docs/models  and  /docs/rate-limits
// gemini-3.5-flash returns clean JSON. A small thinking budget trades a little latency
// for better decomposition of complex items (0 would disable thinking entirely).
export const GEMINI_MODEL = 'gemini-3.5-flash'
export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
// Thinking-token cap per request. Small = a bit of reasoning without the multi-second
// latency of full/dynamic thinking. Tune up for more accuracy, down (or 0) for speed.
export const GEMINI_THINKING_BUDGET = 512
export const MAX_RPM = 10            // requests per minute (free-tier safe default)
export const BATCH_SIZE = 12         // items per Gemini request
export const CACHE_SCHEMA_VERSION = 3 // bump to invalidate all cached estimates
export const CACHE_PREFIX = 'nut:'    // chrome.storage.local key prefix
export const API_KEY_STORAGE_KEY = 'geminiApiKey'
