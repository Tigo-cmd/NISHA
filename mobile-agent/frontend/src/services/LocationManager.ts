/**
 * LocationManager — Singleton for GPS tracking with Background Support.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

export interface GPSCoords {
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
}

class LocationManager {
  private _coords: GPSCoords | null = null;
  private _subscription: Location.LocationSubscription | null = null;
  private _enabled = false;

  get coords(): GPSCoords | null {
    return this._coords;
  }

  get isEnabled(): boolean {
    return this._enabled;
  }

  async start(): Promise<boolean> {
    if (this._enabled) return true;

    // 1. Request Foreground Permissions
    console.log('[LocationManager] Requesting foreground permissions...');
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      console.warn('[LocationManager] Foreground permission denied');
      return false;
    }
    console.log('[LocationManager] Foreground permission granted');

    // 2. Request Background Permissions
    console.log('[LocationManager] Requesting background permissions...');
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
        console.warn('[LocationManager] Background permission denied. GPS will stop when minimized.');
    } else {
        console.log('[LocationManager] Background permission granted');
    }

    // 3. Get immediate fix
    try {
      console.log('[LocationManager] Getting initial position...');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      this._coords = this._fromPosition(pos);
      console.log('[LocationManager] Initial position acquired:', this._coords.lat, this._coords.lng);
    } catch (e) {
      console.warn('[LocationManager] Failed to get initial position', e);
    }

    // 4. Start Foreground Watch
    console.log('[LocationManager] Starting position watch...');
    this._subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (pos) => {
        this._coords = this._fromPosition(pos);
        // Silently update, only log if explicitly debugging
      }
    );

    // 5. Start Background Updates (if possible)
    if (bgStatus === 'granted') {
        try {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 5000,
                distanceInterval: 10,
                foregroundService: {
                    notificationTitle: "NISHA Sentinel",
                    notificationBody: "Location tracking active in background",
                    notificationColor: "#39d353"
                }
            });
        } catch (e) {
            console.warn('[LocationManager] Failed to start background updates', e);
        }
    }

    this._enabled = true;
    console.log('[LocationManager] Started');
    return true;
  }

  stop() {
    this._subscription?.remove();
    this._subscription = null;
    Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    this._enabled = false;
    this._coords = null;
    console.log('[LocationManager] Stopped');
  }

  // Called by TaskManager in background
  updateFromTask(pos: Location.LocationObject) {
    this._coords = this._fromPosition(pos);
  }

  private _fromPosition(pos: Location.LocationObject): GPSCoords {
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      timestamp: pos.timestamp,
    };
  }
}

export const locationManager = new LocationManager();

// Register the task (this must be done in a separate file or index.js usually, 
// but we define it here for clarity)
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: any) => {
  if (error) {
    console.error('[LocationManager] Task Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      locationManager.updateFromTask(locations[0]);
    }
  }
});
