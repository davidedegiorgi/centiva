export type AuthenticatedStartupView = 'capture' | 'dashboard'

interface StartupContext {
  isMobile: boolean
  isGoogleAuthenticationReturn: boolean
}

interface ImmediateCameraContext extends StartupContext {
  isLoading: boolean
  hasAuthenticationHint: boolean
}

export function getAuthenticatedStartupView({
  isMobile,
  isGoogleAuthenticationReturn,
}: StartupContext): AuthenticatedStartupView {
  return isMobile && !isGoogleAuthenticationReturn ? 'capture' : 'dashboard'
}

export function shouldShowImmediateCamera({
  isLoading,
  hasAuthenticationHint,
  isMobile,
  isGoogleAuthenticationReturn,
}: ImmediateCameraContext): boolean {
  return isLoading
    && hasAuthenticationHint
    && isMobile
    && !isGoogleAuthenticationReturn
}
