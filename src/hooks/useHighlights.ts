import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface DocumentHighlight {
  id: string
  document_id: string
  user_id: string
  content: string
  note: string
  color: string
  selection_data: {
    page?: number
    type?: 'summary' | 'pdf' | 'docx'
    rects?: { x: number; y: number; width: number; height: number }[]
  }
  created_at: string
}

export const highlightKeys = {
  all: ['highlights'] as const,
  list: (documentId: string) => [...highlightKeys.all, 'list', documentId] as const,
}

export function useHighlights(documentId: string | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: highlightKeys.list(documentId ?? ''),
    queryFn: async (): Promise<DocumentHighlight[]> => {
      if (!documentId || !user) return []

      const { data, error } = await supabase
        .from('document_highlights')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) {
        if (error.code === '42P01') return []
        throw new Error(error.message)
      }

      const parsedData = (data ?? []).map((item: Record<string, unknown>) => {
        let parsedSelectionData = item.selection_data
        if (typeof parsedSelectionData === 'string') {
          try {
            parsedSelectionData = JSON.parse(parsedSelectionData)
          } catch {
            parsedSelectionData = {}
          }
        }
        return {
          ...item,
          selection_data: parsedSelectionData,
        }
      })

      return parsedData as DocumentHighlight[]
    },
    enabled: !!documentId && !!user,
  })
}

export function useCreateHighlight() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: Omit<DocumentHighlight, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('document_highlights')
        .insert({
          ...payload,
          user_id: user.id,
        })

      if (error) throw new Error(error.message)

      return { document_id: payload.document_id } as Pick<DocumentHighlight, 'document_id'>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: highlightKeys.list(data.document_id) })
    },
  })
}
