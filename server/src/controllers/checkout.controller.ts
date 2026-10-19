import { NextFunction, Request, Response } from 'express'
import { IOrder, Order } from '../models/Order'
import { releaseStock, verifyProduct } from '../services/verification.service'
import { evaluateGuardrails } from '../services/guardrails.service'
import {
  createPayPalOrderWithRetry,
  capturePayPalOrder,
  verifyPayPalWebhookSignature,
} from '../services/paypal.service'
import { logAudit, resolveActor } from '../services/audit.service'
import { config } from '../config/env'

interface CheckoutRequestBody {
  quantity?: number
  quotedPrice?: number
  actor?: string
  customerName?: string
  customerEmail?: string
  customerContact?: string
}

// POST /api/checkout/:productId
// The moment "the AI buyer picked this" becomes a real payment attempt.
export async function createCheckout(
  req: Request<{ productId: string }, unknown, CheckoutRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { productId } = req.params
    const rawQuantity = req.body.quantity
    const quantity = rawQuantity && rawQuantity > 0 ? Math.floor(rawQuantity) : 1
    const quotedPrice = req.body.quotedPrice
    const actor = resolveActor(req)

    // --- Verify + atomically reserve stock ---
    const verification = await verifyProduct(productId, quantity, quotedPrice)

    if (!verification.ok) {
      const status =
        verification.code === 'INVALID_PRODUCT_ID' ? 400 : verification.code === 'PRODUCT_NOT_FOUND' ? 404 : 409 // OUT_OF_STOCK or PRICE_MISMATCH

      await logAudit({
        actor,
        action: 'verify',
        decision: verification.code,
        reasoning: verification.message,
        input: { productId, quantity, quotedPrice },
        result: verification.details,
        productId: verification.code !== 'INVALID_PRODUCT_ID' ? productId : undefined,
      })

      res.status(status).json({
        error: verification.code,
        message: verification.message,
        ...verification.details,
      })
      return
    }

    // Stock for `quantity` units is already atomically decremented at this
    // point. Every exit path below this line that doesn't end in a
    // completed order MUST call releaseStock, or inventory leaks.
    const { product } = verification
    const amount = product.price.amount * quantity

    await logAudit({
      actor,
      action: 'verify',
      decision: 'verified',
      reasoning: `"${product.name}" was in stock and ${quantity} unit(s) reserved; price matches the quote.`,
      input: { productId, quantity, quotedPrice },
      result: { sku: product.sku, currentPrice: product.price.amount, remainingStock: product.stock },
      productId: product._id,
    })

    try {
      // --- Bound + gate ---
      const guardrail = evaluateGuardrails(amount)

      const order = await Order.create({
        product: {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          imageUrl: product.imageUrl,
          unitPrice: { amount: product.price.amount, currency: product.price.currency },
        },
        quantity,
        amount,
        currency: product.price.currency,
        actor,
        guardrailDecision: guardrail.decision,
        guardrailReasoning: guardrail.reasoning,
        status:
          guardrail.decision === 'rejected'
            ? 'rejected'
            : guardrail.decision === 'pending_approval'
              ? 'pending_approval'
              : 'awaiting_payment',
      } satisfies Omit<IOrder, 'rejectionReason'>)

      if (guardrail.decision === 'rejected') {
        // The order never proceeds — release the stock reserved for it.
        await releaseStock(product._id, quantity)

        await logAudit({
          actor,
          action: 'gate',
          decision: guardrail.decision,
          reasoning: guardrail.reasoning,
          input: { amount, maxOrderValue: config.guardrails.maxOrderValue },
          result: { orderId: order._id.toString(), stockReleased: quantity },
          orderId: order._id,
          productId: product._id,
        })

        res.status(422).json({
          error: 'ORDER_VALUE_EXCEEDS_MAX',
          message: guardrail.reasoning,
          orderId: order._id.toString(),
          amount,
          maxOrderValue: config.guardrails.maxOrderValue,
        })
        return
      }

      if (guardrail.decision === 'pending_approval') {
        // Stock stays held while a human decides — not released here.
        await logAudit({
          actor,
          action: 'gate',
          decision: guardrail.decision,
          reasoning: `${guardrail.reasoning} ${quantity} unit(s) held pending that decision.`,
          input: { amount, approvalThreshold: config.guardrails.approvalThreshold },
          result: { orderId: order._id.toString() },
          orderId: order._id,
          productId: product._id,
        })

        res.status(202).json({
          status: 'pending_approval',
          message: guardrail.reasoning,
          orderId: order._id.toString(),
          amount,
          approvalThreshold: config.guardrails.approvalThreshold,
        })
        return
      }

      await logAudit({
        actor,
        action: 'gate',
        decision: guardrail.decision,
        reasoning: guardrail.reasoning,
        input: { amount, approvalThreshold: config.guardrails.approvalThreshold },
        result: { orderId: order._id.toString() },
        orderId: order._id,
        productId: product._id,
      })

      // --- auto_proceed: issue PayPal checkout order (with retry-once) ---
      try {
        const ppOrder = await createPayPalOrderWithRetry(
          {
            amount,
            currency: product.price.currency || 'USD',
            description: `${product.name} x${quantity}`,
            referenceId: order._id.toString(),
            customer: {
              name: req.body.customerName,
              email: req.body.customerEmail,
            },
          },
          async (attempt, retryErr) => {
            await logAudit({
              actor,
              action: 'payment_failed',
              decision: 'retry',
              reasoning: `PayPal order creation attempt ${attempt} failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}. Retrying once.`,
              input: { orderId: order._id.toString(), attempt },
              orderId: order._id,
              productId: product._id,
            })
          },
        )

        order.paypal = {
          orderId: ppOrder.id,
          approvalUrl: ppOrder.approvalUrl,
          status: ppOrder.status,
        }
        await order.save()

        await logAudit({
          actor,
          action: 'payment_created',
          decision: 'success',
          reasoning: `PayPal checkout order created (${ppOrder.id}) for $${amount}.`,
          input: { orderId: order._id.toString(), amount, currency: product.price.currency },
          result: { paypalOrderId: ppOrder.id, approvalUrl: ppOrder.approvalUrl },
          orderId: order._id,
          productId: product._id,
        })

        res.status(201).json({
          status: 'awaiting_payment',
          orderId: order._id.toString(),
          amount,
          currency: product.price.currency || 'USD',
          paymentLink: ppOrder.approvalUrl,
          approvalUrl: ppOrder.approvalUrl,
          gateway: 'paypal',
          paypalOrderId: ppOrder.id,
        })
      } catch (err) {
        await releaseStock(product._id, quantity)
        const message = err instanceof Error ? err.message : 'PayPal order creation failed'

        order.status = 'failed'
        order.rejectionReason = message
        await order.save()

        await logAudit({
          actor,
          action: 'payment_failed',
          decision: 'failure',
          reasoning: message,
          input: { orderId: order._id.toString(), amount },
          result: { stockReleased: quantity },
          orderId: order._id,
          productId: product._id,
        })

        res.status(502).json({
          error: 'PAYPAL_ORDER_FAILED',
          message: 'Could not create a PayPal checkout order for this item after retrying.',
          orderId: order._id.toString(),
        })
      }
    } catch (err) {
      // Anything unexpected after stock was reserved (e.g. Order.create()
      // itself throwing) — release the reservation before bubbling up, so a
      // rare DB hiccup doesn't quietly lock inventory forever.
      await releaseStock(product._id, quantity)
      throw err
    }
  } catch (err) {
    next(err)
  }
}

// POST /api/webhooks/paypal
// PayPal notifies our server when order status changes (approved, completed, denied, etc.)
export async function handlePayPalWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const headers = {
      transmissionId: req.headers['paypal-transmission-id'] as string | undefined,
      transmissionTime: req.headers['paypal-transmission-time'] as string | undefined,
      certUrl: req.headers['paypal-cert-url'] as string | undefined,
      authAlgo: req.headers['paypal-auth-algo'] as string | undefined,
      transmissionSig: req.headers['paypal-transmission-sig'] as string | undefined,
    }

    if (config.paypal.webhookId) {
      const isValid = await verifyPayPalWebhookSignature(headers, req.body)
      if (!isValid) {
        console.warn('[paypal-webhook] Failed signature verification')
        res.status(400).json({ error: 'INVALID_SIGNATURE' })
        return
      }
    } else {
      console.warn('[paypal-webhook] PAYPAL_WEBHOOK_ID not set — accepting webhook without signature verification.')
    }

    const event = req.body?.event_type as string | undefined
    const resource = req.body?.resource

    if (!event || !resource) {
      res.status(200).json({ received: true })
      return
    }

    // Identify target order either via custom_id / reference_id or order id
    const paypalOrderId = resource.id || resource.order_id
    const referenceId =
      resource.purchase_units?.[0]?.reference_id ||
      resource.reference_id ||
      resource.custom_id

    let order = null
    if (referenceId) {
      order = await Order.findById(referenceId)
    }
    if (!order && paypalOrderId) {
      order = await Order.findOne({ 'paypal.orderId': paypalOrderId })
    }

    if (!order) {
      res.status(200).json({ received: true, note: 'Order not found, acknowledged' })
      return
    }

    if (event === 'CHECKOUT.ORDER.APPROVED') {
      // The buyer approved on PayPal — we can capture the payment immediately
      try {
        const captureResult = await capturePayPalOrder(order.paypal?.orderId || paypalOrderId)
        order.status = 'paid'
        if (!order.paypal) order.paypal = {}
        order.paypal.captureId = captureResult.id
        order.paypal.status = captureResult.status
        await order.save()

        await logAudit({
          actor: 'paypal-webhook',
          action: 'payment_confirmed',
          decision: 'paid',
          reasoning: `PayPal order approved and auto-captured (Capture ID: ${captureResult.id}).`,
          input: { event, paypalOrderId },
          result: { captureId: captureResult.id, status: captureResult.status },
          orderId: order._id,
          productId: order.product.productId,
        })
      } catch (captureErr) {
        console.error('[paypal-webhook] Auto-capture failed after approval:', captureErr)
      }
    } else if (event === 'PAYMENT.CAPTURE.COMPLETED') {
      order.status = 'paid'
      if (!order.paypal) order.paypal = {}
      order.paypal.captureId = resource.id
      order.paypal.status = 'COMPLETED'
      await order.save()

      await logAudit({
        actor: 'paypal-webhook',
        action: 'payment_confirmed',
        decision: 'paid',
        reasoning: 'PayPal confirmed capture completion via webhook.',
        input: { event, captureId: resource.id },
        result: { status: 'COMPLETED' },
        orderId: order._id,
        productId: order.product.productId,
      })
    } else if (event === 'PAYMENT.CAPTURE.DENIED' || event === 'CHECKOUT.ORDER.VOIDED') {
      order.status = 'cancelled'
      if (!order.paypal) order.paypal = {}
      order.paypal.status = event
      await order.save()

      await releaseStock(order.product.productId, order.quantity)

      await logAudit({
        actor: 'paypal-webhook',
        action: 'payment_cancelled',
        decision: event,
        reasoning: `PayPal reported ${event}. Released ${order.quantity} reserved unit(s) back to stock.`,
        input: { event, resourceId: resource.id },
        result: { stockReleased: order.quantity },
        orderId: order._id,
        productId: order.product.productId,
      })
    }

    res.status(200).json({ received: true })
  } catch (err) {
    next(err)
  }
}

// POST /api/checkout/:orderId/capture
// Useful for client return_url redirect when buyer finishes PayPal checkout flow
export async function captureOrderEndpoint(req: Request<{ orderId: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId } = req.params
    const order = await Order.findById(orderId)
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` })
      return
    }

    if (order.status === 'paid') {
      res.status(200).json({ status: 'paid', message: 'Order is already paid', orderId })
      return
    }

    if (!order.paypal?.orderId) {
      res.status(400).json({ error: 'NOT_PAYPAL_ORDER', message: 'Order does not have a PayPal order ID' })
      return
    }

    const captureResult = await capturePayPalOrder(order.paypal.orderId)
    order.status = 'paid'
    order.paypal.captureId = captureResult.id
    order.paypal.status = captureResult.status
    await order.save()

    await logAudit({
      actor: 'client-redirect-capture',
      action: 'payment_confirmed',
      decision: 'paid',
      reasoning: `PayPal order captured upon return redirect (Capture ID: ${captureResult.id}).`,
      input: { orderId, paypalOrderId: order.paypal.orderId },
      result: { captureId: captureResult.id, status: captureResult.status },
      orderId: order._id,
      productId: order.product.productId,
    })

    res.status(200).json({
      status: 'paid',
      orderId: order._id.toString(),
      captureId: captureResult.id,
    })
  } catch (err) {
    next(err)
  }
}
