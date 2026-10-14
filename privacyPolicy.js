export const PRIVACY_POLICY_URL = 'https://calc-7271f-account.web.app/privacy';

export function privacyPolicyUrl(language) {
  const code = String(language || '').toLowerCase().split(/[-_]/)[0];
  return ['hy', 'ru', 'ja', 'hi', 'ko'].includes(code)
    ? `${PRIVACY_POLICY_URL}/${code}`
    : PRIVACY_POLICY_URL;
}
