import { Router } from 'express'
import { createCheckout, captureOrderEndpoint } from '../controllers/checkout.controller'

const router = Router()

router.post('/:productId', createCheckout)
router.post('/:orderId/capture', captureOrderEndpoint)

export default router
