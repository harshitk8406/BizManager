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
const path = require('path');
const dotenv = require('dotenv');

function getKeys() {
  if (!process.env.GROQ_API_KEY) {
    try {
      dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
    } catch (_) {}
    if (!process.env.GROQ_API_KEY && process.env.APP_PATH) {
      try {
        dotenv.config({ path: path.join(process.env.APP_PATH, 'backend', '.env') });
      } catch (_) {}
    }
  }
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ].filter(Boolean);
}

/* ─── Client cache: one Groq client per key index ──────────── */
const _clients = {};

/**
 * Pick a key index for a given user, then return (or create) its client.
 * The same userId always maps to the same key (stable assignment).
 * Falls back to round-robin if userId is not provided.
 */
function getGroqClient(userId = 'default') {
  const keys = getKeys();
  if (keys.length === 0) {
    throw new Error('No Groq API keys configured in groq.js');
  }

  // Stable hash of userId → consistent key assignment per user
  const hash = crypto.createHash('sha256').update(String(userId)).digest('hex');
  const index = parseInt(hash.substring(0, 8), 16) % keys.length;

  if (!_clients[index]) {
    _clients[index] = new Groq({ apiKey: keys[index] });
  }
  return _clients[index];
}

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const FALLBACK_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'];

/**
 * Send a chat completion request to Groq.
 * @param {Object} options
 * @param {Array}  options.messages    - Array of {role, content} messages
 * @param {string} [options.model]     - Groq model ID
 * @param {number} [options.maxTokens] - Max tokens in response
 * @param {string} [options.userId]    - User ID for key assignment (passed from req.user._id)
 * @returns {Promise<string>} - The assistant reply text
 */
async function groqChat({ messages, model, maxTokens = 1024, userId = 'default' }) {
  const chosenModel = model || process.env.GROQ_MODEL || DEFAULT_MODEL;
  const client = getGroqClient(userId);

  const executeCompletion = async (targetModel, targetClient) => {
    return await targetClient.chat.completions.create({
      model: targetModel,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    });
  };

  try {
    let completion;
    try {
      completion = await executeCompletion(chosenModel, client);
    } catch (modelErr) {
      // If the model does not exist or user doesn't have access, automatically try fallback models
      const isModelNotFound = modelErr.status === 404 || 
                              modelErr.code === 'model_not_found' || 
                              modelErr.message?.includes('does not exist') ||
                              modelErr.message?.includes('do not have access');

      if (isModelNotFound) {
        let fallbackDone = false;
        for (const fbModel of FALLBACK_MODELS) {
          if (fbModel === chosenModel) continue;
          try {
            console.warn(`[groq] Model '${chosenModel}' unavailable. Falling back to '${fbModel}'...`);
            completion = await executeCompletion(fbModel, client);
            fallbackDone = true;
            break;
          } catch (_) {}
        }
        if (!fallbackDone) throw modelErr;
      } else {
        throw modelErr;
      }
    }
    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    // Rate limit hit on this key — try the next key in the pool as fallback
    const keys = getKeys();
    if (err.status === 429 && keys.length > 1) {
      try {
        const hash = crypto.createHash('sha256').update(String(userId) + '_fallback').digest('hex');
        const fallbackIndex = parseInt(hash.substring(0, 8), 16) % keys.length;
        const fallbackClient = new Groq({ apiKey: keys[fallbackIndex] });
        const fallbackCompletion = await executeCompletion(chosenModel, fallbackClient);
        return fallbackCompletion.choices[0]?.message?.content?.trim() || '';
      } catch {}
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('fetch')) {
      throw new Error('AI features require an internet connection. Please check your network and try again.');
    }
    throw err;
  }
}

module.exports = { groqChat, getGroqClient, DEFAULT_MODEL };


