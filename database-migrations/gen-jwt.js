// Génère le JWT anon pour PostgREST
// Usage: node gen-jwt.js
const crypto = require('crypto')

const JWT_SECRET = 'kEZwt7mx+WS6GuFKDNGxMXOtnQmE1c+Qzi9PCij8XVI='

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

const header = { alg: 'HS256', typ: 'JWT' }
const payload = {
  role: 'ba9alino_anon',
  aud: 'authenticated',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10, // 10 ans
}

const data = `${base64url(header)}.${base64url(payload)}`
const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

const token = `${data}.${sig}`
console.log('VITE_SUPABASE_ANON_KEY=' + token)
console.log('\nVITE_SUPABASE_URL=https://ba9alino.duckdns.org')
