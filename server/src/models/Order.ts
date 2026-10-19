import { Schema, Types, model } from 'mongoose'

export interface OrderProductSnapshot {
  productId: Types.ObjectId
  name: string
  sku: string
  imageUrl: string
  unitPrice: { amount: number; currency: string }
}

// awaiting_payment -> paid | cancelled  (via PayPal webhook)
// awaiting_payment -> failed            (PayPal call itself failed)
// pending_approval -> ...               (Admin action moves this on)
// rejected                              (bounded guardrail — terminal)
export type OrderStatus = 'pending_approval' | 'awaiting_payment' | 'paid' | 'failed' | 'rejected' | 'cancelled'

export type GuardrailDecision = 'auto_proceed' | 'pending_approval' | 'rejected'

export interface OrderPayPalInfo {
  orderId?: string
  approvalUrl?: string
  captureId?: string
  status?: string
}

export interface IOrder {
  product: OrderProductSnapshot
  quantity: number
  amount: number
  currency: string
  status: OrderStatus
  actor: string
  guardrailDecision: GuardrailDecision
  guardrailReasoning: string
  rejectionReason?: string
  paypal?: OrderPayPalInfo
}

const productSnapshotSchema = new Schema<OrderProductSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    imageUrl: { type: String, required: true },
    unitPrice: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
  },
  { _id: false },
)

const paypalSchema = new Schema<OrderPayPalInfo>(
  {
    orderId: String,
    approvalUrl: String,
    captureId: String,
    status: String,
  },
  { _id: false },
)

const orderSchema = new Schema<IOrder>(
  {
    product: { type: productSnapshotSchema, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD' },
    status: {
      type: String,
      required: true,
      enum: ['pending_approval', 'awaiting_payment', 'paid', 'failed', 'rejected', 'cancelled'],
    },
    actor: { type: String, required: true, default: 'unknown-agent' },
    guardrailDecision: {
      type: String,
      required: true,
      enum: ['auto_proceed', 'pending_approval', 'rejected'],
    },
    guardrailReasoning: { type: String, required: true },
    rejectionReason: String,
    paypal: { type: paypalSchema, required: false },
  },
  { timestamps: true },
)

export const Order = model<IOrder>('Order', orderSchema)
