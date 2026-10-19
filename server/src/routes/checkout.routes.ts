import { Router } from 'express'
import {
  createCheckout,
  captureOrderEndpoint,
  getOrderEndpoint,
  getPendingOrdersEndpoint,
  approveOrderEndpoint,
  denyOrderEndpoint,
} from '../controllers/checkout.controller'

const router = Router()

// Literal route for pending approvals queue must come before /:orderId
router.get('/pending', getPendingOrdersEndpoint)

router.post('/:productId', createCheckout)
router.post('/:orderId/capture', captureOrderEndpoint)
router.post('/:orderId/approve', approveOrderEndpoint)
router.post('/:orderId/deny', denyOrderEndpoint)
router.get('/:orderId', getOrderEndpoint)

export default router
