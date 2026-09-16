const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export default function useDriveAuthorization() {
  return {
    configured: Boolean(webClientId),
    ready: true,
    authorize: async () => {
      const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ webClientId, scopes: ['email', 'profile'] });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      let result = await GoogleSignin.signInSilently();
      if (!isSuccessResponse(result)) result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return null;
      if (!result.data.scopes.includes(DRIVE_SCOPE)) {
        result = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
        if (!result || !isSuccessResponse(result)) return null;
      }
      return (await GoogleSignin.getTokens()).accessToken;
    },
  };
}
