/**
 * Ensure the page may use the microphone before entering voice mode.
 * Must run from a user gesture so mobile browsers can show the permission prompt.
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  try {
    // Start getUserMedia in the same turn as the click handler. Awaiting
    // Permissions API first can drop the user-gesture context on mobile Safari.
    const mediaPromise = navigator.mediaDevices.getUserMedia({ audio: true });
    const stream = await mediaPromise;
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return true;
  } catch {
    return false;
  }
}
