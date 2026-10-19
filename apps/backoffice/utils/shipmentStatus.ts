const labels: Record<string, string> = {
  created: 'Підготовлено', unknown: 'Результат не визначено — потрібна звірка',
  handed_over: 'Передано перевізнику', in_transit: 'У дорозі', delivered: 'Доставлено', refused: 'Відмова отримувача',
  returning: 'Повертається', returned: 'Повернуто перевізником', cancelled: 'Скасовано',
  requires_review: 'Потрібна перевірка',
}
export const shipmentStatusLabel = (status: string) => labels[status] || 'Потрібна перевірка'

export const orderUsesNovaPoshta = (order: { fulfillment_method?: string | null, shipping_company?: string | null }) =>
  order.fulfillment_method === 'nova_poshta' || (order.fulfillment_method == null && ['nova_poshta', 'novaPoshta', 'novaPost'].includes(order.shipping_company || ''))

export const storedShipmentAddressReady = (snapshot?: Record<string, unknown> | null) =>
  !!(snapshot?.shippingCityRef && (snapshot.shippingWarehouseRef || snapshot.shippingStreetRef)
    && (snapshot.shippingWarehouseRef || snapshot.buildingNumber))

export const shipmentAddressSummary = (snapshot: Record<string, unknown> | null | undefined, labels: { shipping_city?: string | null, shipping_warehouse_number?: string | null, shipping_street?: string | null }) => ({
  city: String(snapshot?.cityLabel || labels.shipping_city || 'Не вказано'),
  destination: String(snapshot?.warehouseLabel || snapshot?.streetLabel || labels.shipping_warehouse_number || labels.shipping_street || 'Не вказано'),
  cityRef: String(snapshot?.shippingCityRef || 'Відсутній'),
  destinationRef: String(snapshot?.shippingWarehouseRef || snapshot?.shippingStreetRef || 'Відсутній'),
})
