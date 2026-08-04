import { z } from 'zod'

export const usernameFieldSchema = z.string().trim().min(2, 'Au moins 2 caractères').max(24, 'Maximum 24 caractères')
export const emailFieldSchema = z.string().min(1, 'Email requis').email('Email invalide')
export const passwordFieldSchema = z.string().min(8, 'Au moins 8 caractères')
