import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCallback, useRef } from 'react'

export interface StudyNote {
    id: string
    document_id: string
    user_id: string
    content: string
    updated_at: string
    created_at: string
}

export const noteKeys = {
    all: ['notes'] as const,
    detail: (documentId: string) => [...noteKeys.all, documentId] as const,
}

export function useDocumentNotes(documentId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: noteKeys.detail(documentId ?? ''),
        queryFn: async ({ signal }): Promise<StudyNote | null> => {
            if (!documentId || !user) return null

            const { data, error } = await supabase
                .from('study_notes')
                .select('*')
                .eq('document_id', documentId)
                .eq('user_id', user.id)
                .abortSignal(signal)
                .maybeSingle()

            if (error) throw new Error(error.message)
            return data as StudyNote | null
        },
        enabled: !!documentId && !!user,
    })
}

export function useSaveNotes() {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: async ({ documentId, content }: { documentId: string; content: string }) => {
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('study_notes')
                .upsert(
                    { document_id: documentId, user_id: user.id, content },
                    { onConflict: 'document_id,user_id' }
                )
                .select()
                .single()

            if (error) throw new Error(error.message)
            return data as StudyNote
        },
        onSuccess: (saved) => {
            queryClient.setQueryData(noteKeys.detail(saved.document_id), saved)
        },
    })
}

/**
 * Auto-save hook: debounces writes to 1 second after last keystroke.
 */
export function useAutoSaveNotes(documentId: string | undefined) {
    const saveNotes = useSaveNotes()
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const debouncedSave = useCallback(
        (content: string) => {
            if (!documentId) return
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                saveNotes.mutate({ documentId, content })
            }, 1000)
        },
        [documentId, saveNotes]
    )

    return { debouncedSave, isSaving: saveNotes.isPending }
}
