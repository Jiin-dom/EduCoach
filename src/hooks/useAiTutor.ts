/**
 * useAiTutor Hook
 *
 * React Query hook for the AI Tutor RAG chat.
 * Provides queries for conversations/messages and a mutation
 * to send messages through the ai-tutor Edge Function.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, ensureFreshSession } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatConversation {
    id: string
    user_id: string
    document_id: string | null
    title: string
    created_at: string
    updated_at: string
}

export interface ChatMessage {
    id: string
    conversation_id: string
    role: 'user' | 'assistant'
    content: string
    bloom_level: string | null
    retrieved_chunk_ids: string[]
    similarity_scores: number[]
    source_citations: SourceCitation[] | null
    model_used: string | null
    created_at: string
}

export interface SourceCitation {
    documentId: string
    documentTitle: string
    chunkId: string
    chunkPreview: string
    similarity: number
}

export interface SendMessageInput {
    message: string
    conversationId?: string
    documentId?: string
}

export interface SendMessageResponse {
    success: boolean
    answer: string
    sources: SourceCitation[]
    conversationId: string
    chunksUsed: number
    error?: string
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const chatKeys = {
    all: ['chat'] as const,
    conversations: () => [...chatKeys.all, 'conversations'] as const,
    conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
    messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useConversations() {
    const { user } = useAuth()

    return useQuery({
        queryKey: chatKeys.conversations(),
        queryFn: async ({ signal }): Promise<ChatConversation[]> => {
            if (!user) return []

            const { data, error } = await supabase
                .from('chat_conversations')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return data as ChatConversation[]
        },
        enabled: !!user,
    })
}

export function useConversationMessages(conversationId: string | undefined) {
    const { user } = useAuth()

    return useQuery({
        queryKey: chatKeys.messages(conversationId ?? ''),
        queryFn: async ({ signal }): Promise<ChatMessage[]> => {
            if (!conversationId || !user) return []

            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .abortSignal(signal)

            if (error) throw new Error(error.message)
            return data as ChatMessage[]
        },
        enabled: !!conversationId && !!user,
    })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSendMessage() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: SendMessageInput): Promise<SendMessageResponse> => {
            await ensureFreshSession()

            const { data, error } = await supabase.functions.invoke('ai-tutor', {
                body: {
                    message: input.message,
                    conversationId: input.conversationId || undefined,
                    documentId: input.documentId || undefined,
                },
            })

            if (error) {
                throw new Error(error.message || 'Failed to get AI response')
            }

            if (data && !data.success) {
                throw new Error(data.error || 'AI tutor returned an error')
            }

            return data as SendMessageResponse
        },
        onSuccess: (_data, input) => {
            queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
            if (input.conversationId) {
                queryClient.invalidateQueries({
                    queryKey: chatKeys.messages(input.conversationId),
                })
            }
        },
    })
}

export function useDeleteConversation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { error } = await supabase
                .from('chat_conversations')
                .delete()
                .eq('id', conversationId)

            if (error) throw new Error(error.message)
            return conversationId
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: chatKeys.all })
        },
    })
}
