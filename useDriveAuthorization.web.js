import { ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export default function useDriveAuthorization() {
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId,
    responseType: ResponseType.Token,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return {
    configured: Boolean(webClientId),
    ready: Boolean(request),
    authorize: async () => {
      const result = await promptAsync();
      return result?.authentication?.accessToken || result?.params?.access_token || null;
    },
  };
}
