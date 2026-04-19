const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface PasswordRequirementCheck {
    label: string
    met: boolean
}

export const PASSWORD_REQUIREMENTS: ReadonlyArray<{
    label: string
    test: (password: string) => boolean
}> = [
    { label: "At least 8 characters", test: (password) => password.length >= 8 },
    { label: "At least one uppercase letter", test: (password) => /[A-Z]/.test(password) },
    { label: "At least one lowercase letter", test: (password) => /[a-z]/.test(password) },
    { label: "At least one number", test: (password) => /[0-9]/.test(password) },
    { label: "At least one special character", test: (password) => /[^A-Za-z0-9]/.test(password) },
]

export function validateEmail(email: string): string | null {
    if (!email.trim()) return "Email is required"
    if (!EMAIL_RE.test(email)) return "Please enter a valid email address"
    return null
}

export function validatePassword(password: string): string[] {
    return getPasswordRequirementChecks(password)
        .filter((requirement) => !requirement.met)
        .map((requirement) => requirement.label)
}

export function getPasswordRequirementChecks(password: string): PasswordRequirementCheck[] {
    return PASSWORD_REQUIREMENTS.map((requirement) => ({
        label: requirement.label,
        met: requirement.test(password),
    }))
}

export function validateName(name: string, label: string): string | null {
    if (!name.trim()) return `${label} is required`
    if (name.trim().length < 2) return `${label} must be at least 2 characters`
    return null
}
