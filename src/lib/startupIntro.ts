export const STARTUP_INTRO_KEY = "school-startup-intro-v1";
export function canRevealStartup(videoFinished: boolean, authReady: boolean, loaderCount: number, fetchingCount: number) {
  return videoFinished && authReady && loaderCount === 0 && fetchingCount === 0;
}