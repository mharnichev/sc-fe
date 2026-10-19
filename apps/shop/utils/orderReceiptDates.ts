import type { CustomerShipment } from '~/types/order'
import { deliveryStatus } from './shipmentStatus'
export const orderReceiptDates = (shipments: CustomerShipment[] = []) => {
  const real = shipments.filter(shipment => !shipment.simulation)
  return real.filter(shipment => deliveryStatus(shipment) === 'delivered' && shipment.return_of_shipment_id == null).map(shipment => {
    const times = (shipment.events || []).filter(event => event.normalized_status === 'delivered').map(event => event.event_at).filter((value): value is string => !!value && Number.isFinite(Date.parse(value)))
    const fallback = shipment.provider_event_at
    const date = times.sort((a, b) => Date.parse(b) - Date.parse(a))[0] || (fallback && Number.isFinite(Date.parse(fallback)) ? fallback : null)
    return { id: shipment.id, date }
  })
}
