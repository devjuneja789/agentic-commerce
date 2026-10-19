import { Router } from 'express'
import { handlePayPalWebhook } from '../controllers/checkout.controller'

const router = Router()

// Handled at /api/webhooks/paypal and /api/webhooks
router.post('/paypal', handlePayPalWebhook)
router.post('/', handlePayPalWebhook)

export default router
