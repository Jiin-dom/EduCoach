const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(email: string): string | null {
    if (!email.trim()) return "Email is required"
    if (!EMAIL_RE.test(email)) return "Please enter a valid email address"
    return null
}

export function validatePassword(password: string): string[] {
    const errors: string[] = []
    if (password.length < 8) errors.push("At least 8 characters")
    if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter")
    if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter")
    if (!/[0-9]/.test(password)) errors.push("At least one number")
    if (!/[^A-Za-z0-9]/.test(password)) errors.push("At least one special character")
    return errors
}

export function validateName(name: string, label: string): string | null {
    if (!name.trim()) return `${label} is required`
    if (name.trim().length < 2) return `${label} must be at least 2 characters`
    return null
}
