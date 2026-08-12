import { toast } from 'sonner';
import { createProviderPaymentMethodSetupSessionPreview } from '../repositories/providerPaymentMethodsRepository';
import { isPaymentSetupSessionLive } from './edgeFunctions';

const NOT_CONNECTED_TOAST = 'Payment method setup is not connected yet.';
const PERMISSION_TOAST = 'You do not have permission to manage payment methods.';
const START_FAILED_TOAST = 'Payment setup could not be started.';

function isPermissionSetupError(code: string, message: string): boolean {
  return (
    code === 'forbidden' ||
    code === 'unauthorized' ||
    /forbidden|permission|not authorized|cannot manage payment methods/i.test(message)
  );
}

export type ProviderPaymentMethodSetupReturnPath =
  | '/provider/settings'
  | '/provider/billing';

/**
 * Starts hosted Stripe setup when the Edge function returns a live session.
 * No card/bank fields in-app; no provider_payments or invoice collection.
 */
export async function startProviderPaymentMethodSetup(
  returnPath: ProviderPaymentMethodSetupReturnPath,
): Promise<void> {
  const returnUrl = `${window.location.origin}${returnPath}`;
  const result = await createProviderPaymentMethodSetupSessionPreview({ returnUrl });

  if (!result.ok) {
    if (isPermissionSetupError(result.error.code, result.error.message)) {
      toast.error(PERMISSION_TOAST);
    } else {
      toast.error(START_FAILED_TOAST);
    }
    return;
  }

  const { data } = result;

  if (!data.configured) {
    toast.message(NOT_CONNECTED_TOAST);
    return;
  }

  const liveCheck = {
    ok: true as const,
    configured: true as const,
    processor: data.processor ?? 'stripe',
    setupSessionId: data.setupSessionId ?? '',
    hostedUrl: data.hostedUrl,
  };

  if (
    isPaymentSetupSessionLive(liveCheck) &&
    typeof data.hostedUrl === 'string' &&
    data.hostedUrl.startsWith('https://')
  ) {
    window.location.assign(data.hostedUrl);
    return;
  }

  toast.error(START_FAILED_TOAST);
}
