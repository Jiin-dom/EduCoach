/**
 * Supabase Storage Utilities
 * 
 * This module provides helper functions for interacting with Supabase Storage.
 * All files are stored in user-specific folders to ensure proper RLS isolation.
 * 
 * Storage Structure:
 * documents/
 *   └── {user_id}/
 *       └── {timestamp}_{filename}
 */

import { supabase } from './supabase'

const DOCUMENTS_BUCKET = 'documents'

// Allowed file types for upload
export const ALLOWED_FILE_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
    'text/markdown': 'md',
} as const

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES

// Maximum file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Validates a file before upload
 * Returns an error message if invalid, null if valid
 */
export function validateFile(file: File): string | null {
    console.log('[Storage] 🔍 Validating file:', {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: file.type,
        maxSize: `${MAX_FILE_SIZE / (1024 * 1024)} MB`
    })

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        console.error('[Storage] ❌ Size check failed:', errorMsg)
        return errorMsg
    }

    // Check file type
    if (!(file.type in ALLOWED_FILE_TYPES)) {
        const allowedTypes = Object.values(ALLOWED_FILE_TYPES).join(', ')
        const errorMsg = `Invalid file type. Allowed types: ${allowedTypes}`
        console.error('[Storage] ❌ Type check failed:', errorMsg, '| Got:', file.type)
        return errorMsg
    }

    console.log('[Storage] ✅ File validation passed')
    return null
}

/**
 * Generates a unique file path for storage
 * Format: {user_id}/{timestamp}_{sanitized_filename}
 */
export function generateFilePath(userId: string, fileName: string): string {
    const timestamp = Date.now()
    // Sanitize filename: remove special chars, replace spaces with underscores
    const sanitizedName = fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\s+/g, '_')
        .toLowerCase()

    const path = `${userId}/${timestamp}_${sanitizedName}`
    console.log('[Storage] 📂 Generated file path:', path)
    return path
}

/**
 * Warms the HTTP connection to Supabase before a critical operation.
 *
 * WHY: When the browser tab has been backgrounded, idle HTTP/2 connections
 * get killed by the OS. The browser doesn't realise the socket is dead,
 * so the next fetch() reuses it and hangs forever.
 *
 * This lightweight HEAD request forces the browser to test the socket.
 * If it's dead → the browser tears it down and creates a fresh one.
 * If it's alive → the ping completes instantly and we proceed.
 *
 * IMPORTANT: We do NOT call getSession() here. Supabase's auth client
 * uses the browser Web Locks API internally, and aborting an auth fetch
 * corrupts the lock, causing all subsequent getSession() calls to deadlock.
 */
async function warmConnection(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    try {
        await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'HEAD',
            headers: { apikey: supabaseKey },
            signal: AbortSignal.timeout(5000),
        })
        console.log('[Storage] 🏓 REST connection is alive')
    } catch {
        console.log('[Storage] 🏓 REST stale socket detected, browser will use fresh connection')
    }

    try {
        await fetch(`${supabaseUrl}/storage/v1/`, {
            method: 'HEAD',
            headers: { apikey: supabaseKey },
            signal: AbortSignal.timeout(5000),
        })
        console.log('[Storage] 🏓 Storage connection is alive')
    } catch {
        console.log('[Storage] 🏓 Storage stale socket detected, browser will use fresh connection')
    }
}

/**
 * Reads the Supabase access token directly from localStorage.
 *
 * WHY: Supabase's getSession() uses the Web Locks API internally.
 * When the browser tab has been backgrounded, a zombie token-refresh
 * can hold the lock forever, causing getSession() (and therefore
 * supabase.storage.upload()) to deadlock. Reading from localStorage
 * bypasses the lock entirely — the token there is always the most
 * recently persisted one and is perfectly fine for authorising an upload.
 */
function getAccessTokenDirect(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    try {
        const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
        const storageKey = `sb-${projectRef}-auth-token`
        const stored = localStorage.getItem(storageKey)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.access_token) {
                return parsed.access_token
            }
        }
    } catch { /* fall through to anon key */ }
    return supabaseKey
}

/**
 * Upload via raw fetch — completely bypasses the Supabase JS client
 * (and its internal getSession() Web Lock) to avoid deadlocks after
 * the tab has been backgrounded.
 *
 * Uses AbortSignal.timeout() so the fetch is genuinely cancelled when
 * the timeout fires (unlike Promise.race which leaves orphaned requests).
 */
const UPLOAD_TIMEOUT_MS = 30_000 // 30 seconds

async function uploadWithTimeout(
    bucket: string,
    filePath: string,
    file: File,
    options: { cacheControl: string; upsert: boolean }
): Promise<{ data: { path: string } | null; error: { message: string } | null }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const accessToken = getAccessTokenDirect()

    try {
        const response = await fetch(
            `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': supabaseKey,
                    'cache-control': options.cacheControl,
                    'x-upsert': String(options.upsert),
                },
                body: file,
                signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
            }
        )

        if (!response.ok) {
            const body = await response.json().catch(() => ({ message: response.statusText }))
            return { data: null, error: { message: body.message || body.error || response.statusText } }
        }

        const body = await response.json()
        const returnedKey: string = body.Key ?? ''
        const path = returnedKey.startsWith(`${bucket}/`)
            ? returnedKey.slice(bucket.length + 1)
            : returnedKey

        return { data: { path }, error: null }
    } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
            throw new Error('UPLOAD_TIMEOUT')
        }
        throw err
    }
}

/**
 * Uploads a file to Supabase Storage
 * Returns the file path on success, or an error object
 *
 * Flow:
 *  1. Validate the file
 *  2. Warm the HTTP connection (detect dead sockets)
 *  3. Upload with a 30s timeout
 *  4. If the upload times out → warm connection again → retry once
 */
export async function uploadFile(
    userId: string,
    file: File
): Promise<{ data: { path: string } | null; error: Error | null }> {
    console.log('[Storage] 🚀 Starting file upload to Supabase Storage...', {
        userId,
        fileName: file.name,
        fileSize: formatFileSize(file.size)
    })

    // Validate the file first
    const validationError = validateFile(file)
    if (validationError) {
        console.error('[Storage] ❌ Validation failed, aborting upload')
        return { data: null, error: new Error(validationError) }
    }

    // Warm the HTTP connection (detect dead sockets without touching auth locks)
    await warmConnection()

    // Generate unique path
    const filePath = generateFilePath(userId, file.name)
    console.log('[Storage] 📤 Uploading to bucket:', DOCUMENTS_BUCKET, '| Path:', filePath)

    // Upload with timeout + 1 retry on timeout
    const uploadOptions = { cacheControl: '3600', upsert: false }
    const uploadStartTime = performance.now()

    let data: { path: string } | null = null
    let error: { message: string } | null = null

    try {
        const result = await uploadWithTimeout(
            DOCUMENTS_BUCKET,
            filePath,
            file,
            uploadOptions
        )
        data = result.data
        error = result.error
    } catch (err) {
        if (err instanceof Error && err.message === 'UPLOAD_TIMEOUT') {
            console.warn('[Storage] ⏰ Upload timed out after ' +
                UPLOAD_TIMEOUT_MS / 1000 + 's — warming connection and retrying...')

            await warmConnection()

            try {
                const retryResult = await uploadWithTimeout(
                    DOCUMENTS_BUCKET,
                    filePath,
                    file,
                    uploadOptions
                )
                data = retryResult.data
                error = retryResult.error
            } catch (retryErr) {
                const msg = retryErr instanceof Error ? retryErr.message : 'Unknown error'
                console.error('[Storage] ❌ Retry also failed:', msg)

                return {
                    data: null,
                    error: new Error(
                        msg === 'UPLOAD_TIMEOUT'
                            ? 'Upload timed out. Please check your connection and try again.'
                            : msg
                    ),
                }
            }
        } else {
            return { data: null, error: err as Error }
        }
    }

    const uploadDuration = (performance.now() - uploadStartTime).toFixed(2)

    if (error) {
        console.error('[Storage] ❌ Supabase upload failed:', {
            error: error.message,
            duration: `${uploadDuration}ms`
        })
        return { data: null, error: new Error(error.message) }
    }

    console.log('[Storage] ✅ Upload successful!', {
        path: data!.path,
        duration: `${uploadDuration}ms`,
        bucket: DOCUMENTS_BUCKET
    })

    return { data: { path: data!.path }, error: null }
}

/**
 * Deletes a file from Supabase Storage
 */
export async function deleteFile(
    filePath: string
): Promise<{ error: Error | null }> {
    const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([filePath])

    if (error) {
        console.error('Delete error:', error)
        return { error: new Error(error.message) }
    }

    return { error: null }
}

/**
 * Gets a signed URL for downloading/viewing a file
 * URL is valid for 1 hour by default
 */
export async function getFileUrl(
    filePath: string,
    expiresIn: number = 3600
): Promise<{ data: { signedUrl: string } | null; error: Error | null }> {
    const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(filePath, expiresIn)

    if (error) {
        console.error('URL generation error:', error)
        return { data: null, error: new Error(error.message) }
    }

    return { data: { signedUrl: data.signedUrl }, error: null }
}

/**
 * Downloads a file's content as text (for processing)
 * Only works for text-based files (txt, md)
 */
export async function downloadFileAsText(
    filePath: string
): Promise<{ data: string | null; error: Error | null }> {
    const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(filePath)

    if (error) {
        console.error('Download error:', error)
        return { data: null, error: new Error(error.message) }
    }

    try {
        const text = await data.text()
        return { data: text, error: null }
    } catch (err) {
        return { data: null, error: new Error('Failed to read file as text') }
    }
}

/**
 * Downloads a file as a Blob (for PDF processing or binary files)
 */
export async function downloadFileAsBlob(
    filePath: string
): Promise<{ data: Blob | null; error: Error | null }> {
    const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(filePath)

    if (error) {
        console.error('Download error:', error)
        return { data: null, error: new Error(error.message) }
    }

    return { data, error: null }
}

/**
 * Gets file type from MIME type
 */
export function getFileTypeFromMime(mimeType: string): string {
    return ALLOWED_FILE_TYPES[mimeType as AllowedMimeType] || 'unknown'
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

