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
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    }

    // Check file type
    if (!(file.type in ALLOWED_FILE_TYPES)) {
        const allowedTypes = Object.values(ALLOWED_FILE_TYPES).join(', ')
        return `Invalid file type. Allowed types: ${allowedTypes}`
    }

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
    
    return `${userId}/${timestamp}_${sanitizedName}`
}

/**
 * Uploads a file to Supabase Storage
 * Returns the file path on success, or an error object
 */
export async function uploadFile(
    userId: string,
    file: File
): Promise<{ data: { path: string } | null; error: Error | null }> {
    // Validate the file first
    const validationError = validateFile(file)
    if (validationError) {
        return { data: null, error: new Error(validationError) }
    }

    // Generate unique path
    const filePath = generateFilePath(userId, file.name)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600', // 1 hour cache
            upsert: false, // Don't overwrite existing files
        })

    if (error) {
        console.error('Upload error:', error)
        return { data: null, error: new Error(error.message) }
    }

    return { data: { path: data.path }, error: null }
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

