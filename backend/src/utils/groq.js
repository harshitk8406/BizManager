const Groq = require('groq-sdk');
const crypto = require('crypto');

/* ─────────────────────────────────────────────────────────────
   KEY POOL
   Add more Groq API keys to .env as needed:
     GROQ_API_KEY=your_primary_key
     GROQ_API_KEY_2=your_second_key   (optional)
     GROQ_API_KEY_3=your_third_key    (optional)
   Each key is silently assigned to a subset of users.
   Users never see or configure these keys.
   ───────────────────────────────────────────────────────────── */
const GROQ_API_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean); // remove undefined/empty slots

/* ─── Client cache: one Groq client per key index ──────────── */
const _clients = {};

/**
 * Pick a key index for a given user, then return (or create) its client.
 * The same userId always maps to the same key (stable assignment).
 * Falls back to round-robin if userId is not provided.
 */
function getGroqClient(userId = 'default') {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error('No Groq API keys configured in groq.js');
  }

  // Stable hash of userId → consistent key assignment per user
  const hash = crypto.createHash('sha256').update(String(userId)).digest('hex');
  const index = parseInt(hash.substring(0, 8), 16) % GROQ_API_KEYS.length;

  if (!_clients[index]) {
    _clients[index] = new Groq({ apiKey: GROQ_API_KEYS[index] });
  }
  return _clients[index];
}

/**
 * Send a chat completion request to Groq.
 * @param {Object} options
 * @param {Array}  options.messages    - Array of {role, content} messages
 * @param {string} [options.model]     - Groq model ID (defaults to llama-3.1-8b-instant)
 * @param {number} [options.maxTokens] - Max tokens in response
 * @param {string} [options.userId]    - User ID for key assignment (passed from req.user._id)
 * @returns {Promise<string>} - The assistant reply text
 */
async function groqChat({ messages, model = 'llama-3.1-8b-instant', maxTokens = 1024, userId = 'default' }) {
  try {
    const client = getGroqClient(userId);
    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    // Rate limit hit on this key — try the next key in the pool as fallback
    if (err.status === 429 && GROQ_API_KEYS.length > 1) {
      try {
        const hash = crypto.createHash('sha256').update(String(userId) + '_fallback').digest('hex');
        const fallbackIndex = parseInt(hash.substring(0, 8), 16) % GROQ_API_KEYS.length;
        const fallbackClient = new Groq({ apiKey: GROQ_API_KEYS[fallbackIndex] });
        const fallbackCompletion = await fallbackClient.chat.completions.create({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.3,
        });
        return fallbackCompletion.choices[0]?.message?.content?.trim() || '';
      } catch {}
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('fetch')) {
      throw new Error('AI features require an internet connection. Please check your network and try again.');
    }
    throw err;
  }
}

module.exports = { groqChat };
