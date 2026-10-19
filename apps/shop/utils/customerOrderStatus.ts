import type { CustomerOrder } from '~/types/order'
import { deliveryStatus, shipmentStatusIcon, shipmentStatusTone } from './shipmentStatus'

export const customerOrderStatus = (order: Pick<CustomerOrder, 'status' | 'shipments'>, locale = 'uk') => {
  const en = locale === 'en'
  const all = order.shipments || []
  // A simulated parcel must never supply receipt evidence for a real parcel.
  const real = all.filter(shipment => !shipment.simulation)
  const shipments = real.length ? real : all
  const mockOnly = all.length > 0 && real.length === 0
  const present = (label: string, state: string) => ({
    label: mockOnly ? `${en ? 'Test' : 'Тест'}: ${label}` : label, tone: shipmentStatusTone(state), icon: shipmentStatusIcon(state),
  })
  if (order.status === 'cancelled') return present(en ? 'Cancelled' : 'Скасовано', 'cancelled')
  if (!shipments.length) return present(
    ['pending', 'confirmed', 'paid', 'completed'].includes(order.status)
      ? (en ? 'Accepted' : 'Прийнято') : (en ? 'No information' : 'Немає даних'), 'accepted')
  const states = shipments.map(deliveryStatus)
  const known = ['preparing', 'created', 'handed_over', 'in_transit', 'ready_for_pickup', 'delivered', 'refused', 'returning', 'returned', 'cancelled']
  if (states.some(state => !known.includes(state))) return present(en ? 'Needs attention' : 'Потрібне уточнення', 'requires_review')
  if (states.includes('returning')) return present(states.every(state => state === 'returning') ? (en ? 'Returning' : 'Повертається') : (en ? 'Some parcels returning' : 'Є повернення'), 'returning')
  if (states.includes('returned')) return present(states.every(state => state === 'returned') ? (en ? 'Returned' : 'Повернено') : (en ? 'Some parcels returned' : 'Є повернені посилки'), 'returned')
  if (states.includes('refused')) return present(states.every(state => state === 'refused') ? (en ? 'Refused' : 'Відмова') : (en ? 'Some parcels refused' : 'Є відмова'), 'refused')
  if (shipments.some(shipment => shipment.return_of_shipment_id != null)) {
    return present(en ? 'Return shipment' : 'Повернення', 'returning')
  }
  // Cancelled labels may remain in history alongside replacement parcels.
  const current = states.filter(state => state !== 'cancelled')
  if (!current.length) return present(en ? 'Delivery cancelled' : 'Доставку скасовано', 'cancelled')
  const received = current.filter(state => state === 'delivered').length
  if (received === current.length) return present(current.length === 1
    ? (en ? 'Parcel received' : 'Посилку отримано')
    : (en ? 'All parcels received' : 'Усі посилки отримано'), 'delivered')
  if (received > 0) return present(en ? `${received} of ${current.length} parcels received`
    : `Отримано ${received} з ${current.length} посилок`, 'partial')
  const ready = current.filter(state => state === 'ready_for_pickup').length
  if (ready > 0) return present(ready === current.length
    ? (en ? 'Ready to collect' : 'У відділенні')
    : (en ? `${ready} of ${current.length} parcels ready to collect` : `У відділенні: ${ready} з ${current.length} посилок`), 'ready_for_pickup')
  if (current.includes('in_transit')) return present(en ? 'In transit' : 'У дорозі', 'in_transit')
  if (current.includes('handed_over')) return present(en ? 'With carrier' : 'Передано пошті', 'handed_over')
  return present(en ? 'Preparing' : 'Готуємо', 'preparing')
}
