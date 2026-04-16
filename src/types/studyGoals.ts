export type GoalType = 'topic_mastery' | 'quiz_count' | 'overall_mastery'

export interface StudyGoal {
    id: string
    user_id: string
    title: string
    goal_type: GoalType
    target_value: number
    concept_id: string | null
    document_id: string | null
    quiz_id: string | null
    deadline: string | null
    is_completed: boolean
    completed_at: string | null
    created_at: string
    updated_at: string
}
