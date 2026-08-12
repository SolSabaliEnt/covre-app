/** Frontend gate for provider Add payment method UI (no secrets). */
export function isProviderPaymentMethodSetupUiEnabled(): boolean {
  return import.meta.env.VITE_PROVIDER_PAYMENT_METHOD_SETUP_ENABLED === 'true';
}
