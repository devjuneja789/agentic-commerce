import dotenv from 'dotenv'

dotenv.config()

function optional(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.warn(`[env] ${name} is not set — features that need it will be skipped until you add it to server/.env`)
    return ''
  }
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',

  mongodbUri: optional('MONGODB_URI'),

  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    environment: (process.env.PAYPAL_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'live',
    webhookId: process.env.PAYPAL_WEBHOOK_ID ?? '',
    requestTimeoutMs: Number(process.env.PAYPAL_TIMEOUT_MS ?? 10000),
    simulateFailure: process.env.PAYPAL_SIMULATE_FAILURE === 'true',
  },

  // Phase 2: bounded + gated checkout thresholds (in USD / major currency unit)
  guardrails: {
    maxOrderValue: Number(process.env.MAX_ORDER_VALUE ?? 500),
    approvalThreshold: Number(process.env.APPROVAL_THRESHOLD ?? 100),
  },

  // Phase 5: simulated AI buyer agent
  llm: {
    apiKey: process.env.LLM_API_KEY ?? '',
    provider: process.env.LLM_PROVIDER ?? 'gemini',
    model: process.env.LLM_MODEL ?? 'gemini-3.5-flash',
    requestTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 15000),
  },

  // Static merchant identity, embedded in every catalog offer's `seller` field
  merchant: {
    id: process.env.MERCHANT_ID ?? 'studio-loom',
    name: process.env.MERCHANT_NAME ?? 'Studio Loom',
  },
}
