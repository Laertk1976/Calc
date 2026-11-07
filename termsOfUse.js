export const TERMS_OF_USE_URL = 'https://calc-7271f-account.web.app/terms';

export function termsOfUseUrl(language) {
  const code = String(language || '').toLowerCase().split(/[-_]/)[0];
  return ['hy', 'ru', 'ja', 'hi', 'ko'].includes(code)
    ? `${TERMS_OF_USE_URL}/${code}`
    : TERMS_OF_USE_URL;
}
