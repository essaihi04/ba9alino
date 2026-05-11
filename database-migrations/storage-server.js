/**
 * Minimal Supabase-compatible Storage API
 * Handles uploads/downloads for product images (and other buckets)
 * Compatible with @supabase/storage-js client
 */
const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const Busboy = require('busboy')

const app = express()
const PORT = 3003
const STORAGE_ROOT = '/opt/ba9alino/storage'

// CORS + request logger (express.json is NOT global — only applied to bucket routes below)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-upsert, x-client-info, apikey')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

// ── Upload object  POST /object/:bucket/:objectPath(.*)
//                  PUT  /object/:bucket/:objectPath(.*)
app.use('/object/:bucket/:objectPath(.*)', (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT') return next()
  const bucket = req.params.bucket
  const objectPath = req.params.objectPath
  if (!objectPath) return res.status(400).json({ error: 'missing path' })

  const destFile = path.join(STORAGE_ROOT, bucket, objectPath)
  ensureDir(path.dirname(destFile))

  const contentType = req.headers['content-type'] || ''
  console.log(`[UPLOAD] ${req.method} bucket=${bucket} path=${objectPath} content-type=${contentType}`)

  const successResponse = () => {
    const key = `${bucket}/${objectPath}`
    console.log(`[UPLOAD OK] ${key}`)
    res.status(200).json({
      Key: key,
      Id: crypto.randomUUID(),
      name: objectPath,
      bucket_id: bucket,
      owner: '',
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    })
  }

  if (contentType.includes('multipart/form-data')) {
    // supabase-js wraps files in FormData — extract the actual file bytes
    const bb = Busboy({ headers: req.headers })
    let writeFinished = false
    let busboyFinished = false
    const tryRespond = () => { if (writeFinished && busboyFinished && !res.headersSent) successResponse() }
    bb.on('file', (_field, fileStream, _info) => {
      const writeStream = fs.createWriteStream(destFile)
      fileStream.pipe(writeStream)
      writeStream.on('finish', () => { writeFinished = true; tryRespond() })
      writeStream.on('error', (err) => { console.error('[UPLOAD] write error:', err); if (!res.headersSent) res.status(500).json({ error: err.message }) })
    })
    bb.on('finish', () => { busboyFinished = true; tryRespond() })
    bb.on('error', (err) => { console.error('[UPLOAD] busboy error:', err); if (!res.headersSent) res.status(500).json({ error: err.message }) })
    req.pipe(bb)
  } else {
    // Raw binary upload (ArrayBuffer, Blob without FormData)
    const writeStream = fs.createWriteStream(destFile)
    req.pipe(writeStream)
    writeStream.on('finish', successResponse)
    writeStream.on('error', (err) => { console.error('[UPLOAD] raw write error:', err); res.status(500).json({ error: err.message }) })
  }
})

// ── Delete object  DELETE /object/:bucket/*
app.delete('/object/:bucket/:objectPath(.*)', (req, res) => {
  const bucket = req.params.bucket
  const objectPath = req.params.objectPath
  const destFile = path.join(STORAGE_ROOT, bucket, objectPath)
  try {
    if (fs.existsSync(destFile)) fs.unlinkSync(destFile)
    res.json([{ name: objectPath }])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Serve public objects  GET /object/public/:bucket/*
app.get('/object/public/:bucket/:objectPath(.*)', (req, res) => {
  const bucket = req.params.bucket
  const objectPath = req.params.objectPath
  const filePath = path.join(STORAGE_ROOT, bucket, objectPath)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  res.sendFile(filePath)
})

// ── Serve authenticated objects  GET /object/authenticated/:bucket/*
app.get('/object/authenticated/:bucket/:objectPath(.*)', (req, res) => {
  const bucket = req.params.bucket
  const objectPath = req.params.objectPath
  const filePath = path.join(STORAGE_ROOT, bucket, objectPath)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  res.sendFile(filePath)
})

// ── List objects  POST /object/list/:bucket
app.post('/object/list/:bucket', (req, res) => {
  const bucket = req.params.bucket
  const bucketDir = path.join(STORAGE_ROOT, bucket)
  if (!fs.existsSync(bucketDir)) return res.json([])
  const files = []
  const walk = (dir, prefix = '') => {
    try {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name)
        const stat = fs.statSync(full)
        if (stat.isDirectory()) walk(full, prefix + name + '/')
        else files.push({ name: prefix + name, id: crypto.randomUUID(), updated_at: stat.mtime.toISOString(), created_at: stat.ctime.toISOString(), last_accessed_at: stat.atime.toISOString(), metadata: { size: stat.size, mimetype: 'application/octet-stream' } })
      }
    } catch (_) {}
  }
  walk(bucketDir)
  res.json(files)
})

// ── Bucket operations (express.json only here, NOT globally)
app.post('/bucket', express.json(), (req, res) => {
  const { id, name, public: isPublic } = req.body || {}
  const bucketName = id || name
  if (!bucketName) return res.status(400).json({ error: 'bucket name required' })
  ensureDir(path.join(STORAGE_ROOT, bucketName))
  res.json({ name: bucketName, id: bucketName, public: isPublic || true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
})

app.get('/bucket', (req, res) => {
  const buckets = []
  try {
    for (const name of fs.readdirSync(STORAGE_ROOT)) {
      const stat = fs.statSync(path.join(STORAGE_ROOT, name))
      if (stat.isDirectory()) buckets.push({ id: name, name, public: true, created_at: stat.ctime.toISOString(), updated_at: stat.mtime.toISOString() })
    }
  } catch (_) {}
  res.json(buckets)
})

app.get('/bucket/:id', (req, res) => {
  const id = req.params.id
  const bucketDir = path.join(STORAGE_ROOT, id)
  if (!fs.existsSync(bucketDir)) return res.status(404).json({ error: 'Bucket not found' })
  res.json({ id, name: id, public: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
})

app.put('/bucket/:id', (req, res) => {
  const id = req.params.id
  ensureDir(path.join(STORAGE_ROOT, id))
  res.json({ message: 'Successfully updated' })
})

// ── Sign URL (return direct public URL)
app.post('/object/sign/:bucket/:objectPath(.*)', (req, res) => {
  const bucket = req.params.bucket
  const objectPath = req.params.objectPath
  res.json({ signedURL: `/storage/v1/object/public/${bucket}/${objectPath}` })
})

// ── Signed upload URL
app.post('/object/upload/sign/:bucket/:objectPath(.*)', (req, res) => {
  const bucket = req.params.bucket
  const objectPath = req.params.objectPath
  res.json({ url: `/storage/v1/object/${bucket}/${objectPath}`, token: '' })
})

// Ensure product-images bucket dir exists
ensureDir(path.join(STORAGE_ROOT, 'product-images'))

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Storage API running on port ${PORT}`)
  console.log(`Storage root: ${STORAGE_ROOT}`)
})
