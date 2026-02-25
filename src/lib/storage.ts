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
 * Ensures we have a fresh/valid Supabase session before critical operations.
 *
 * WHY: When the browser tab is backgrounded, idle HTTP connections get killed.
 * Calling getSession() forces the Supabase client to make a fresh network
 * request, which (a) refreshes the token if needed, and (b) re-establishes
 * the underlying HTTP connection so the next API call doesn't hang on a
 * dead socket.
 */
async function ensureFreshSession(): Promise<void> {
    console.log('[Storage] 🔄 Ensuring fresh session before upload...')
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
        console.warn('[Storage] ⚠️ Session refresh failed:', error.message)
        throw new Error('Your session has expired. Please log in again.')
    }

    if (!session) {
        console.error('[Storage] ❌ No active session')
        throw new Error('You are not logged in. Please sign in and try again.')
    }

    const expiresAt = session.expires_at
        ? new Date(session.expires_at * 1000)
        : null
    console.log('[Storage] ✅ Session is fresh', {
        expiresAt: expiresAt?.toLocaleTimeString() ?? 'unknown',
    })
}

/**
 * Upload with a timeout — prevents the upload from hanging forever on a
 * stale HTTP connection. Returns the same shape as supabase.storage.upload().
 */
const UPLOAD_TIMEOUT_MS = 30_000 // 30 seconds

async function uploadWithTimeout(
    bucket: string,
    filePath: string,
    file: File,
    options: { cacheControl: string; upsert: boolean }
) {
    return Promise.race([
        supabase.storage.from(bucket).upload(filePath, file, options),
        new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error('UPLOAD_TIMEOUT')),
                UPLOAD_TIMEOUT_MS
            )
        ),
    ])
}

/**
 * Uploads a file to Supabase Storage
 * Returns the file path on success, or an error object
 *
 * Flow:
 *  1. Validate the file
 *  2. Ensure we have a fresh session (warms the HTTP connection)
 *  3. Upload with a 30s timeout
 *  4. If the upload times out → refresh session → retry once
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

    // Ensure we have a fresh session (also warms the HTTP connection)
    try {
        await ensureFreshSession()
    } catch (sessionError) {
        return { data: null, error: sessionError as Error }
    }

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
                UPLOAD_TIMEOUT_MS / 1000 + 's — refreshing session and retrying...')

            // Refresh session (re-establish connection) and retry once
            try {
                await ensureFreshSession()
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

