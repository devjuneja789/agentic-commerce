import { config } from '../config/env'

export interface CreatePayPalOrderParams {
  amount: number // decimal currency unit (e.g. 19.99 USD)
  currency: string
  description: string
  referenceId: string
  customer?: { name?: string; email?: string }
}

export interface PayPalOrderResult {
  id: string
  approvalUrl: string
  status: string
}

interface PayPalAuthToken {
  accessToken: string
  expiresAt: number
}

let cachedToken: PayPalAuthToken | null = null

function getBaseUrl(): string {
  return config.paypal.environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/**
 * Fetch or reuse an OAuth 2.0 Bearer token from PayPal.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = config.paypal
  if (!clientId || !clientSecret) {
    throw new Error(
      'PayPal credentials not configured — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in server/.env',
    )
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.accessToken
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const url = `${getBaseUrl()}/v1/oauth2/token`

  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }),
    config.paypal.requestTimeoutMs,
    'PayPal OAuth token request',
  )

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Failed to obtain PayPal access token (HTTP ${res.status}): ${errorBody}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }

  return cachedToken.accessToken
}

/**
 * Create a PayPal v2 order with intent CAPTURE and return the checkout approval URL.
 */
export async function createPayPalOrder(params: CreatePayPalOrderParams): Promise<PayPalOrderResult> {
  if (config.paypal.simulateFailure) {
    throw new Error('Simulated PayPal failure (PAYPAL_SIMULATE_FAILURE=true in server/.env)')
  }

  const token = await getPayPalAccessToken()
  const url = `${getBaseUrl()}/v2/checkout/orders`

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: params.referenceId,
        description: params.description,
        amount: {
          currency_code: params.currency || 'USD',
          value: params.amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: config.merchant.name,
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: `${config.clientUrl}/checkout/success?referenceId=${encodeURIComponent(params.referenceId)}`,
      cancel_url: `${config.clientUrl}/checkout/cancel?referenceId=${encodeURIComponent(params.referenceId)}`,
    },
  }

  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }),
    config.paypal.requestTimeoutMs,
    'PayPal order creation',
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`PayPal order creation failed (HTTP ${res.status}): ${errorText}`)
  }

  const data = (await res.json()) as {
    id: string
    status: string
    links?: Array<{ href: string; rel: string; method: string }>
  }

  const approveLink = data.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')
  if (!approveLink) {
    throw new Error(`PayPal order created (${data.id}) but no approval URL was returned.`)
  }

  return {
    id: data.id,
    approvalUrl: approveLink.href,
    status: data.status,
  }
}

/**
 * Create order with one automatic retry for network/transient resilience.
 */
export async function createPayPalOrderWithRetry(
  params: CreatePayPalOrderParams,
  onRetry?: (attempt: number, error: unknown) => void,
): Promise<PayPalOrderResult> {
  try {
    return await createPayPalOrder(params)
  } catch (firstErr) {
    if (onRetry) onRetry(1, firstErr)
    // Invalidate cached token in case failure was due to token expiration/invalidation
    cachedToken = null
    return await createPayPalOrder(params)
  }
}

/**
 * Capture payment for an approved PayPal order.
 */
export async function capturePayPalOrder(orderId: string): Promise<{ id: string; status: string }> {
  const token = await getPayPalAccessToken()
  const url = `${getBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`

  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }),
    config.paypal.requestTimeoutMs,
    'PayPal order capture',
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`PayPal capture failed for order ${orderId} (HTTP ${res.status}): ${errorText}`)
  }

  const data = (await res.json()) as { id: string; status: string }
  return data
}

export interface VerifyWebhookHeaders {
  transmissionId?: string
  transmissionTime?: string
  certUrl?: string
  authAlgo?: string
  transmissionSig?: string
}

/**
 * Verifies the PayPal webhook signature using PayPal's /v1/notifications/verify-webhook-signature endpoint.
 */
export async function verifyPayPalWebhookSignature(
  headers: VerifyWebhookHeaders,
  webhookEvent: Record<string, unknown>,
): Promise<boolean> {
  const webhookId = config.paypal.webhookId
  if (!webhookId) {
    console.warn('[paypal-webhook] PAYPAL_WEBHOOK_ID is not configured — skipping verification.')
    return true
  }

  const { transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig } = headers
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false
  }

  try {
    const token = await getPayPalAccessToken()
    const url = `${getBaseUrl()}/v1/notifications/verify-webhook-signature`

    const verificationPayload = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }

    const res = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationPayload),
      }),
      config.paypal.requestTimeoutMs,
      'PayPal webhook signature verification',
    )

    if (!res.ok) {
      return false
    }

    const result = (await res.json()) as { verification_status?: string }
    return result.verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal-webhook] Signature verification error:', err)
    return false
  }
}

