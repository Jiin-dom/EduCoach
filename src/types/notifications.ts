export type NotificationType =
  | 'document_ready'
  | 'document_error'
  | 'quiz_ready'
  | 'quiz_error'
  | 'quiz_attempt_completed'
  | 'deadline_reminder'
  | 'exam_reminder'
  | 'trial_started'
  | 'trial_reminder'
  | 'trial_ended'
  | 'subscription_changed'
  | 'ai_tutor_quota_warning'
  | 'ai_tutor_quota_reached'
  | 'mastery_level_up'
  | 'mastery_level_down'
  | 'progress_milestone'
  | 'streak_milestone'

export type NotificationEntityType =
  | 'document'
  | 'quiz'
  | 'attempt'
  | 'subscription'
  | 'concept'
  | 'system'
  | null

export interface NotificationPayloadMap {
  document_ready: { documentTitle: string; status: 'ready' }
  document_error: { documentTitle: string; status: 'error'; error?: string | null }
  quiz_ready: { quizTitle: string; status: 'ready' }
  quiz_error: { quizTitle: string; status: 'error'; error?: string | null }
  quiz_attempt_completed: {
    quizId: string
    score: number | null
    correctAnswers: number
    totalQuestions: number
  }
  deadline_reminder: { dueDate: string; tag: 'd-3' | 'd-1' | 'd0' | 'overdue' }
  exam_reminder: { examDate: string; tag: 'd-3' | 'd-1' | 'd0' | 'overdue' }
  trial_started: { plan: 'free' | 'premium'; status: string; trialEndsAt: string }
  trial_reminder: { trialEndsAt: string; tag: 'd-3' | 'd-1' | 'd0' }
  trial_ended: { trialEndsAt: string }
  subscription_changed: {
    previousPlan: string
    newPlan: string
    previousStatus: string
    newStatus: string
  }
  ai_tutor_quota_warning: { limit: number; messagesUsed: number; remaining: number; date: string }
  ai_tutor_quota_reached: { limit: number; messagesUsed: number; date: string }
  mastery_level_up: { conceptName?: string; from: string; to: string }
  mastery_level_down: { conceptName?: string; from: string; to: string }
  progress_milestone: { quizzesCompleted: number }
  streak_milestone: { streakDays: number }
}

export type NotificationPayload = NotificationPayloadMap[NotificationType]

export interface NotificationRecord {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  cta_route: string | null
  entity_type: NotificationEntityType
  entity_id: string | null
  payload: NotificationPayload
  read_at: string | null
  created_at: string
  expires_at: string | null
  dedupe_key: string | null
}
