/** The app's own files (shell, fort data, predictions, audio), stored on the device. */
export interface OfflineFiles {
  /** How many of the app's files are stored for offline use. */
  status(): Promise<{ stored: number; total: number }>;
  /** Stores whatever is missing, reporting progress after each file. */
  store(onProgress: (stored: number, total: number) => void): Promise<void>;
  /** Asks the browser not to evict our storage when space runs low. False if it declines. */
  keep(): Promise<boolean>;
}
