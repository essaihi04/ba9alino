/**
 * Ba9alino Auth Service — remplace Supabase GoTrue
 * Expose les mêmes endpoints que GoTrue pour compatibilité avec @supabase/supabase-js
 *
 * Endpoints:
 *   POST /auth/v1/token?grant_type=password  — login
 *   GET  /auth/v1/user                       — get current user (JWT required)
 *   POST /auth/v1/token?grant_type=refresh_token — refresh (stub, renvoie nouveau token)
 *   POST /auth/v1/logout                     — logout (stub)
 */

const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const app = express()
app.use(express.json())
app.use(cors({ origin: '*', allowedHeaders: ['Authorization', 'Content-Type', 'apikey'] }))

const JWT_SECRET = process.env.JWT_SECRET || 'kEZwt7mx+WS6GuFKDNGxMXOtnQmE1c+Qzi9PCij8XVI='
const PORT = process.env.PORT || 3002

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ba9alino',
  user: 'ba9alino_admin',
  password: 'Ba9alinoAdmin2024!',
})

function makeTokens(user) {
  const payload = {
    sub: String(user.id),
    role: 'ba9alino_anon',
    organization_id: user.organization_id || null,
    user_metadata: {
      role: user.role,
      name: user.name || user.full_name || user.username,
      employee_id: user.employee_id || null,
      organization_id: user.organization_id || null,
    },
    aud: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 jours
  }
  const accessToken = jwt.sign(payload, JWT_SECRET)
  const refreshToken = jwt.sign({ sub: payload.sub, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' })
  return { accessToken, refreshToken, payload }
}

function makeUserObject(user, payload) {
  return {
    id: payload.sub,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email || `${user.username || user.name}@local`,
    created_at: user.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_metadata: payload.user_metadata,
    app_metadata: { provider: 'local', role: user.role },
  }
}

// POST /auth/v1/token?grant_type=password
app.post('/auth/v1/token', async (req, res) => {
  const grantType = req.query.grant_type

  if (grantType === 'refresh_token') {
    const { refresh_token } = req.body
    try {
      const decoded = jwt.verify(refresh_token, JWT_SECRET)
      const client = await pool.connect()
      try {
        let user = null

        // 1) Chercher dans user_accounts
        const uaResult = await client.query(
          `SELECT ua.*, e.name as emp_name FROM user_accounts ua
           LEFT JOIN employees e ON e.id = ua.employee_id
           WHERE ua.id::text = $1 LIMIT 1`,
          [decoded.sub]
        )
        if (uaResult.rows.length > 0) {
          user = uaResult.rows[0]
          user.name = user.emp_name || user.full_name || user.username
        }

        // 2) Fallback: chercher dans virtual_accounts (sub = employee_id ou va.id)
        if (!user) {
          const vaResult = await client.query(
            `SELECT va.*, e.name as emp_name, e.id as emp_id FROM virtual_accounts va
             LEFT JOIN employees e ON e.id = va.employee_id
             WHERE va.employee_id::text = $1 OR va.id::text = $1
             LIMIT 1`,
            [decoded.sub]
          )
          if (vaResult.rows.length > 0) {
            const va = vaResult.rows[0]
            user = {
              id: va.employee_id || va.id,
              role: va.role,
              name: va.emp_name || va.name,
              employee_id: va.employee_id,
              organization_id: va.organization_id || null,
              created_at: va.created_at,
              email: null,
            }
          }
        }

        if (!user) return res.status(401).json({ error: 'user_not_found', message: 'Utilisateur introuvable' })

        const { accessToken, refreshToken, payload } = makeTokens(user)
        return res.json({ access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer', expires_in: 604800, user: makeUserObject(user, payload) })
      } finally { client.release() }
    } catch (e) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token invalide' })
    }
  }

  if (grantType !== 'password') {
    return res.status(400).json({ error: 'unsupported_grant_type', message: 'grant_type non supporté' })
  }

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'missing_credentials', message: 'email et password requis' })

  // Le "email" envoyé par le client est en fait username@local — extraire le username
  const usernameFromEmail = email.replace(/@local$/, '').replace(/@.*$/, '').trim().toLowerCase()

  const client = await pool.connect()
  try {
    // 1) Essai virtual_accounts (virtual_login)
    let userRow = null
    try {
      const r = await client.query('SELECT * FROM virtual_login($1, $2) LIMIT 1', [usernameFromEmail, password])
      if (r.rows.length > 0) userRow = r.rows[0]
    } catch (_) {}

    // 2) Fallback user_accounts avec vérification bcrypt
    if (!userRow) {
      const ua = await client.query(
        `SELECT ua.*, e.name as emp_name FROM user_accounts ua
         LEFT JOIN employees e ON e.id = ua.employee_id
         WHERE LOWER(ua.username) = $1 AND ua.is_active != false LIMIT 1`,
        [usernameFromEmail]
      )
      if (ua.rows.length > 0) {
        const u = ua.rows[0]
        // Vérifier le hash (le hash peut être stocké dans employees.password_hash)
        let hashToCheck = u.password_hash
        if (!hashToCheck && u.employee_id) {
          const emp = await client.query('SELECT password_hash FROM employees WHERE id = $1', [u.employee_id])
          if (emp.rows.length > 0) hashToCheck = emp.rows[0].password_hash
        }
        if (hashToCheck && (await bcrypt.compare(password, hashToCheck))) {
          userRow = { id: u.employee_id || u.id, role: u.role, name: u.emp_name || u.full_name || u.username, email: u.email, employee_id: u.employee_id, created_at: u.created_at }
        }
      }
    }

    // 3) Fallback user_accounts_login RPC
    if (!userRow) {
      try {
        const r = await client.query('SELECT * FROM user_accounts_login($1, $2) LIMIT 1', [usernameFromEmail, password])
        if (r.rows.length > 0) userRow = r.rows[0]
      } catch (_) {}
    }

    if (!userRow) {
      return res.status(400).json({ error: 'invalid_grant', message: 'الاسم أو كلمة المرور غير صحيحة' })
    }

    const { accessToken, refreshToken, payload } = makeTokens(userRow)
    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 604800,
      user: makeUserObject(userRow, payload),
    })
  } catch (e) {
    console.error('Login error:', e)
    return res.status(500).json({ error: 'server_error', message: 'Erreur serveur' })
  } finally {
    client.release()
  }
})

// GET /auth/v1/user
app.get('/auth/v1/user', async (req, res) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'not_authenticated', message: 'Token manquant' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return res.json({
      id: decoded.sub,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${decoded.user_metadata?.name || decoded.sub}@local`,
      user_metadata: decoded.user_metadata || {},
      app_metadata: { provider: 'local' },
      created_at: new Date().toISOString(),
    })
  } catch {
    return res.status(401).json({ error: 'invalid_token', message: 'Token invalide' })
  }
})

// POST /auth/v1/logout
app.post('/auth/v1/logout', (req, res) => {
  res.status(204).send()
})

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ba9alino-auth' }))

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Ba9alino Auth Service running on port ${PORT}`)
})
