import { z } from 'zod'

export const usernameFieldSchema = z.string().trim().min(2, 'Au moins 2 caractères').max(24, 'Maximum 24 caractères')
