// Purchases are available in the Google Play Android build only.
export default function useProBilling() {
  return { price: null, busy: false, message: 'Purchase Pro in the Google Play version of Calc.', buy: async () => {}, restore: async () => {}, retry: async () => {}, available: false };
}
