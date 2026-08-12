/** Frontend gate for admin provider invoice collection UI (no secrets). */
export function isProviderInvoiceCollectionUiEnabled(): boolean {
  return import.meta.env.VITE_PROVIDER_INVOICE_COLLECTION_ENABLED === 'true';
}
