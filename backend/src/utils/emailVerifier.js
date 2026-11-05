/**
 * ─── BizManager Email Verification Engine ─────────────────────────────────────
 * 
 * Multi-layer email verification to check if an email address genuinely exists:
 *   1. RFC 5322 Syntax & Format Validation
 *   2. Typo Detection & Domain Suggestions (e.g., gmai.com -> gmail.com)
 *   3. Disposable / Temporary Email Provider Blocklist
 *   4. DNS MX (Mail Exchanger) Records Resolution with DNS Fallbacks
 *   5. Opportunistic SMTP Handshake Probe (detecting 550 User Unknown where port 25 is permitted)
 */

const dns = require('dns');
const net = require('net');

// Common disposable / throwaway email provider domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com', '10minutemail.net',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'sharklasers.com', 'grr.la', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'trashmail.com', 'trashmail.net', 'throwawaymail.com', 'getairmail.com', 'dispostable.com',
  'nada.ltd', 'mohmal.com', 'fakemailgenerator.com', 'crazymailing.com', 'burnermail.io',
  'inboxkitten.com', 'maildrop.cc', 'mytemp.email', 'tempail.com', 'emailondeck.com',
  'generator.email', 'getnada.com', 'tempmailo.com', 'disposablemail.com', 'throwaway.email',
  'dropmail.me', 'fakeinbox.com', 'mytempmail.com', 'trashmail.de', 'sofort-mail.de',
  'mailcatch.com', 'bupkis.org', 'mintemail.com', 'dayrep.com', 'einrot.com', 'fleckens.com',
  'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us', 'armyspy.com',
  'cuvox.de', 'byom.de', 'trash-mail.com', 'spambog.com', 'tempsky.com', 'crazymail.com',
  'clipmail.eu', 'fastmail.fm', 'trbvm.com', 'mailsac.com', 'harakirimail.com', 'mailnesia.com'
]);

// Top legitimate domains for typo detection
const POPULAR_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'rediffmail.com', 'zoho.com', 'protonmail.com', 'live.com', 'aol.com',
  'mail.com', 'yandex.com'
];

// Explicit mapping for frequent typos
const TYPO_MAP = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'redifmail.com': 'rediffmail.com',
  'rediffmial.com': 'rediffmail.com',
  'rediff.com': 'rediffmail.com',
  'iclud.com': 'icloud.com',
  'iclou.com': 'icloud.com',
  'zohomail.com': 'zoho.com',
};

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // insertion / deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Find typo suggestion for a domain
 */
function getDomainSuggestion(domain) {
  const lower = domain.toLowerCase().trim();
  // If the domain is already a known top legitimate domain, no typo suggestion needed
  if (POPULAR_DOMAINS.includes(lower)) return null;

  if (TYPO_MAP[lower]) return TYPO_MAP[lower];

  for (const pop of POPULAR_DOMAINS) {
    if (lower !== pop && levenshteinDistance(lower, pop) === 1) {
      return pop;
    }
  }
  return null;
}

/**
 * Validates email syntax strictly according to RFC standards
 */
function validateSyntax(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return { valid: false, reason: 'Email exceeds maximum length of 254 characters' };
  }

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) {
    return { valid: false, reason: 'Email must contain a local user part and a domain separated by "@"' };
  }

  const user = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex + 1);

  if (user.length > 64) {
    return { valid: false, reason: 'Email username part exceeds 64 characters' };
  }

  // Check for consecutive dots
  if (user.includes('..') || domain.includes('..')) {
    return { valid: false, reason: 'Email cannot contain consecutive dots ("..")' };
  }

  // Check for leading or trailing dots
  if (user.startsWith('.') || user.endsWith('.')) {
    return { valid: false, reason: 'Email username cannot start or end with a dot' };
  }

  // Standard email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, reason: 'Invalid email syntax format' };
  }

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return { valid: false, reason: 'Domain Top-Level Domain (TLD) must have at least 2 alphabetic characters' };
  }

  return { valid: true, user, domain };
}

/**
 * Resolve MX records with public DNS fallbacks
 */
async function resolveMxRecords(domain) {
  const timeoutMs = 4000;

  const tryResolve = async (resolverInstance) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), timeoutMs);
      resolverInstance.resolveMx(domain).then(
        (mx) => { clearTimeout(timer); resolve(mx); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  };

  // 1. Try with Google & Cloudflare DNS resolver
  try {
    const resolver = new dns.promises.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
    const records = await tryResolve(resolver);
    return filterMxRecords(records);
  } catch (err) {
    // If the domain is authoritatively not found or has no data, that's definitive
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      throw err;
    }

    // 2. If timeout or refusal, fallback to system default resolver
    try {
      const records = await tryResolve(dns.promises);
      return filterMxRecords(records);
    } catch (fallbackErr) {
      throw fallbackErr.code ? fallbackErr : err;
    }
  }
}

/**
 * Filters and sorts MX records, handling null MX (RFC 7505)
 */
function filterMxRecords(records) {
  if (!records || records.length === 0) return [];

  // Filter out null MX (exchange === '' or '.')
  const valid = records.filter(r => r.exchange && r.exchange !== '.' && r.exchange !== '');
  valid.sort((a, b) => a.priority - b.priority);
  return valid;
}

/**
 * Probe MX server via SMTP socket on port 25 (Opportunistic with short timeout)
 */
async function probeSmtp(mxHost, fromEmail, toEmail) {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    socket.setTimeout(2500);

    let stage = 0; // 0: greeting, 1: HELO, 2: MAIL FROM, 3: RCPT TO
    let buffer = '';
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        try { socket.destroy(); } catch (_) {}
      }
    };

    socket.on('timeout', () => {
      cleanup();
      resolve({ tested: false, status: 'TIMEOUT', message: 'SMTP port 25 connection timed out (normal if ISP/cloud firewall blocks port 25)' });
    });

    socket.on('error', (err) => {
      cleanup();
      resolve({ tested: false, status: 'SOCKET_ERROR', message: `Port 25 unreachable: ${err.message}` });
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // keep partial line

      for (const line of lines) {
        const code = parseInt(line.substring(0, 3), 10);
        if (isNaN(code)) continue;

        // Permanent rejection codes: 550 User unknown, 551, 552, 553, 554
        if (code >= 550 && code <= 554) {
          cleanup();
          return resolve({
            tested: true,
            mailboxExists: false,
            status: 'REJECTED',
            code,
            message: `Mail server rejected address: ${line}`
          });
        }

        if (stage === 0 && (code === 220)) {
          stage = 1;
          socket.write(`HELO bizmanager.verification.local\r\n`);
        } else if (stage === 1 && (code === 250)) {
          stage = 2;
          socket.write(`MAIL FROM:<${fromEmail}>\r\n`);
        } else if (stage === 2 && (code === 250)) {
          stage = 3;
          socket.write(`RCPT TO:<${toEmail}>\r\n`);
        } else if (stage === 3 && (code === 250)) {
          cleanup();
          return resolve({
            tested: true,
            mailboxExists: true,
            status: 'ACCEPTED',
            code,
            message: 'Recipient address accepted by mail exchange server'
          });
        } else if (code >= 400 && code < 500) {
          // Greylisting or temporary server error
          cleanup();
          return resolve({
            tested: false,
            status: 'TEMP_FAIL',
            code,
            message: `Mail server returned temporary delay (greylisting): ${line}`
          });
        }
      }
    });
  });
}

/**
 * Main verification function
 * @param {string} email
 * @returns {Promise<Object>} Verification result with full diagnostics
 */
async function verifyEmail(email) {
  const result = {
    email: (email || '').trim(),
    valid: false,
    exists: false,
    status: 'invalid', // 'valid' | 'invalid' | 'disposable' | 'typo'
    reason: '',
    score: 0,
    suggestion: null,
    checks: {
      syntax: { valid: false },
      disposable: { isDisposable: false },
      typo: { hasTypo: false, suggestion: null },
      domain: {
        domain: '',
        hasMx: false,
        mxRecords: [],
        primaryMx: null,
        error: null
      },
      smtp: {
        tested: false,
        mailboxExists: null,
        status: 'UNTESTED',
        message: ''
      }
    }
  };

  // Step 1: Syntax Validation
  const syntaxCheck = validateSyntax(email);
  if (!syntaxCheck.valid) {
    result.reason = syntaxCheck.reason;
    result.status = 'invalid';
    result.checks.syntax.valid = false;
    result.checks.syntax.reason = syntaxCheck.reason;
    return result;
  }

  result.checks.syntax.valid = true;
  const user = syntaxCheck.user;
  const domain = syntaxCheck.domain.toLowerCase();
  result.checks.domain.domain = domain;

  // Step 2: Typo Detection
  const typoDomain = getDomainSuggestion(domain);
  if (typoDomain) {
    const suggestedEmail = `${user}@${typoDomain}`;
    result.suggestion = suggestedEmail;
    result.checks.typo.hasTypo = true;
    result.checks.typo.suggestion = suggestedEmail;
  }

  // Step 3: Disposable / Temporary Email Check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    result.status = 'disposable';
    result.reason = `"${domain}" is a temporary / disposable email service. Business firms must provide a permanent email address.`;
    result.checks.disposable.isDisposable = true;
    return result;
  }

  // Step 4: DNS MX Record Lookup
  let mxRecords = [];
  try {
    mxRecords = await resolveMxRecords(domain);
  } catch (err) {
    const errCode = err.code || err.message;
    if (errCode === 'ENOTFOUND') {
      result.reason = `Domain "${domain}" does not exist (NXDOMAIN). The email cannot genuinely exist.`;
      result.checks.domain.error = 'DOMAIN_NOT_FOUND';
      result.status = 'invalid';
      return result;
    } else if (errCode === 'ENODATA') {
      // Domain might exist (e.g. website), but has no MX record
      result.reason = `Domain "${domain}" exists but has no Mail Exchanger (MX) records. It cannot receive emails.`;
      result.checks.domain.error = 'NO_MX_RECORDS';
      result.status = 'invalid';
      return result;
    } else {
      result.reason = `DNS verification failed for domain "${domain}": ${errCode}`;
      result.checks.domain.error = errCode;
      result.status = 'invalid';
      return result;
    }
  }

  if (mxRecords.length === 0) {
    result.reason = `Domain "${domain}" does not have active mail servers configured to receive emails (RFC 7505 Null MX).`;
    result.checks.domain.error = 'NULL_MX';
    result.status = 'invalid';
    return result;
  }

  result.checks.domain.hasMx = true;
  result.checks.domain.mxRecords = mxRecords.map(r => ({ exchange: r.exchange, priority: r.priority }));
  const primaryMx = mxRecords[0].exchange;
  result.checks.domain.primaryMx = primaryMx;

  // Step 5: Opportunistic SMTP Handshake
  try {
    const smtpRes = await probeSmtp(primaryMx, 'check@verify.bizmanager.local', email);
    result.checks.smtp = smtpRes;

    if (smtpRes.tested && smtpRes.mailboxExists === false) {
      // Explicit 550 rejection from recipient mail server!
      result.valid = false;
      result.exists = false;
      result.status = 'invalid';
      result.score = 20;
      result.reason = `Mailbox does not exist on "${domain}". Rejected by mail server (${smtpRes.code || 550}).`;
      return result;
    }
  } catch (_) {
    // Non-fatal if socket probe encounters error
  }

  // If passed syntax, not disposable, and active MX records found:
  result.valid = true;
  result.exists = true;
  result.status = typoDomain ? 'typo' : 'valid';
  result.score = typoDomain ? 75 : 95;

  if (typoDomain) {
    result.reason = `Domain has mail servers, but "${domain}" looks like a typo. Did you mean "${result.suggestion}"?`;
  } else {
    result.reason = `Email domain "${domain}" genuinely exists and is configured to receive emails (Mail Server: ${primaryMx}).`;
  }

  return result;
}

module.exports = {
  verifyEmail,
  validateSyntax,
  resolveMxRecords,
  getDomainSuggestion,
  DISPOSABLE_DOMAINS
};
