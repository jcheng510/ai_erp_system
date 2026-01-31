using UnityEngine;
using System;
using System.Collections;
using System.Collections.Generic;

namespace CoinQuestAR.Core
{
    /// <summary>
    /// Handles GPS location tracking and geofencing for coin spawning
    /// </summary>
    public class LocationService : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private float updateInterval = 1f;
        [SerializeField] private float desiredAccuracy = 5f;
        [SerializeField] private float updateDistance = 2f;

        public bool IsAvailable { get; private set; }
        public bool IsTracking { get; private set; }
        public GeoLocation CurrentLocation { get; private set; }
        public float CurrentSpeed { get; private set; }
        public float TotalDistance { get; private set; }

        public event Action<GeoLocation> OnLocationUpdated;
        public event Action<float> OnDistanceWalked;
        public event Action<SafeZone> OnEnteredSafeZone;
        public event Action<SafeZone> OnExitedSafeZone;

        private GeoLocation lastLocation;
        private List<SafeZone> safeZones = new List<SafeZone>();
        private List<DangerZone> dangerZones = new List<DangerZone>();
        private SafeZone currentSafeZone;

        public IEnumerator Initialize()
        {
            Debug.Log("[LocationService] Initializing location services...");

#if UNITY_EDITOR
            // Mock location for editor testing
            IsAvailable = true;
            CurrentLocation = new GeoLocation(37.7749f, -122.4194f, 0f); // San Francisco
            yield return null;
#else
            // Check if user has location service enabled
            if (!Input.location.isEnabledByUser)
            {
                Debug.LogWarning("[LocationService] Location services disabled by user");
                IsAvailable = false;
                yield break;
            }

            // Start location service
            Input.location.Start(desiredAccuracy, updateDistance);

            // Wait for initialization
            int maxWait = 20;
            while (Input.location.status == LocationServiceStatus.Initializing && maxWait > 0)
            {
                yield return new WaitForSeconds(1);
                maxWait--;
            }

            if (maxWait <= 0)
            {
                Debug.LogWarning("[LocationService] Timed out waiting for location");
                IsAvailable = false;
                yield break;
            }

            if (Input.location.status == LocationServiceStatus.Failed)
            {
                Debug.LogWarning("[LocationService] Unable to determine device location");
                IsAvailable = false;
                yield break;
            }

            IsAvailable = true;
            UpdateCurrentLocation();
#endif

            // Load safe zones from server/cache
            yield return LoadZoneData();

            // Start tracking
            StartTracking();
        }

        public void StartTracking()
        {
            if (!IsAvailable) return;

            IsTracking = true;
            StartCoroutine(TrackingLoop());
            Debug.Log("[LocationService] Location tracking started");
        }

        public void StopTracking()
        {
            IsTracking = false;
            StopCoroutine(TrackingLoop());
            Debug.Log("[LocationService] Location tracking stopped");
        }

        private IEnumerator TrackingLoop()
        {
            while (IsTracking)
            {
                UpdateCurrentLocation();
                yield return new WaitForSeconds(updateInterval);
            }
        }

        private void UpdateCurrentLocation()
        {
#if UNITY_EDITOR
            // Simulate movement in editor
            float lat = CurrentLocation.Latitude + UnityEngine.Random.Range(-0.0001f, 0.0001f);
            float lon = CurrentLocation.Longitude + UnityEngine.Random.Range(-0.0001f, 0.0001f);
            CurrentLocation = new GeoLocation(lat, lon, 0f);
            CurrentSpeed = UnityEngine.Random.Range(1f, 2f); // Walking speed
#else
            if (Input.location.status != LocationServiceStatus.Running) return;

            var data = Input.location.lastData;
            CurrentLocation = new GeoLocation(
                data.latitude,
                data.longitude,
                data.altitude
            );
#endif

            // Calculate distance traveled
            if (lastLocation != null)
            {
                float distance = CalculateDistance(lastLocation, CurrentLocation);
                if (distance > 0.5f && distance < 100f) // Filter out GPS jumps
                {
                    TotalDistance += distance;
                    OnDistanceWalked?.Invoke(distance);
                }

                // Calculate speed
                CurrentSpeed = distance / updateInterval;
            }

            lastLocation = CurrentLocation;
            OnLocationUpdated?.Invoke(CurrentLocation);

            // Check zone transitions
            CheckZoneTransitions();
        }

        private void CheckZoneTransitions()
        {
            SafeZone newZone = null;

            foreach (var zone in safeZones)
            {
                if (IsInsideZone(CurrentLocation, zone))
                {
                    newZone = zone;
                    break;
                }
            }

            if (newZone != currentSafeZone)
            {
                if (currentSafeZone != null)
                {
                    OnExitedSafeZone?.Invoke(currentSafeZone);
                }

                currentSafeZone = newZone;

                if (currentSafeZone != null)
                {
                    OnEnteredSafeZone?.Invoke(currentSafeZone);
                }
            }
        }

        public bool IsLocationSafe(Vector3 worldPosition)
        {
            // Convert world position to geo coordinates
            GeoLocation geoPos = WorldToGeo(worldPosition);

            // Check danger zones
            foreach (var zone in dangerZones)
            {
                if (IsInsideDangerZone(geoPos, zone))
                {
                    return false;
                }
            }

            return true;
        }

        public bool IsInsideZone(GeoLocation location, SafeZone zone)
        {
            float distance = CalculateDistance(location, zone.Center);
            return distance <= zone.Radius;
        }

        public bool IsInsideDangerZone(GeoLocation location, DangerZone zone)
        {
            float distance = CalculateDistance(location, zone.Center);
            return distance <= zone.Radius;
        }

        /// <summary>
        /// Calculate distance between two geo coordinates using Haversine formula
        /// </summary>
        public float CalculateDistance(GeoLocation from, GeoLocation to)
        {
            const float EarthRadius = 6371000f; // meters

            float lat1Rad = from.Latitude * Mathf.Deg2Rad;
            float lat2Rad = to.Latitude * Mathf.Deg2Rad;
            float deltaLat = (to.Latitude - from.Latitude) * Mathf.Deg2Rad;
            float deltaLon = (to.Longitude - from.Longitude) * Mathf.Deg2Rad;

            float a = Mathf.Sin(deltaLat / 2) * Mathf.Sin(deltaLat / 2) +
                      Mathf.Cos(lat1Rad) * Mathf.Cos(lat2Rad) *
                      Mathf.Sin(deltaLon / 2) * Mathf.Sin(deltaLon / 2);

            float c = 2 * Mathf.Atan2(Mathf.Sqrt(a), Mathf.Sqrt(1 - a));

            return EarthRadius * c;
        }

        /// <summary>
        /// Convert geo coordinates to world position (relative to player)
        /// </summary>
        public Vector3 GeoToWorld(GeoLocation location)
        {
            if (CurrentLocation == null) return Vector3.zero;

            float latDiff = location.Latitude - CurrentLocation.Latitude;
            float lonDiff = location.Longitude - CurrentLocation.Longitude;

            // Approximate meters per degree
            float metersPerDegLat = 111320f;
            float metersPerDegLon = 111320f * Mathf.Cos(CurrentLocation.Latitude * Mathf.Deg2Rad);

            float x = lonDiff * metersPerDegLon;
            float z = latDiff * metersPerDegLat;

            return new Vector3(x, 0, z);
        }

        /// <summary>
        /// Convert world position to geo coordinates
        /// </summary>
        public GeoLocation WorldToGeo(Vector3 worldPosition)
        {
            if (CurrentLocation == null) return new GeoLocation(0, 0, 0);

            float metersPerDegLat = 111320f;
            float metersPerDegLon = 111320f * Mathf.Cos(CurrentLocation.Latitude * Mathf.Deg2Rad);

            float latOffset = worldPosition.z / metersPerDegLat;
            float lonOffset = worldPosition.x / metersPerDegLon;

            return new GeoLocation(
                CurrentLocation.Latitude + latOffset,
                CurrentLocation.Longitude + lonOffset,
                worldPosition.y
            );
        }

        private IEnumerator LoadZoneData()
        {
            // In production, this would fetch from server
            // For now, add some default safe zones

            safeZones.Add(new SafeZone
            {
                Id = "park_central",
                Name = "Central Park",
                Center = new GeoLocation(37.7694f, -122.4862f, 0),
                Radius = 500f,
                BonusMultiplier = 1.5f
            });

            // Add danger zones (roads, water, etc.)
            dangerZones.Add(new DangerZone
            {
                Id = "highway_101",
                Type = DangerType.Road,
                Center = new GeoLocation(37.7749f, -122.4000f, 0),
                Radius = 50f
            });

            yield return null;
        }

        private void OnDestroy()
        {
            StopTracking();

#if !UNITY_EDITOR
            Input.location.Stop();
#endif
        }
    }

    [Serializable]
    public class GeoLocation
    {
        public float Latitude;
        public float Longitude;
        public float Altitude;

        public GeoLocation(float lat, float lon, float alt)
        {
            Latitude = lat;
            Longitude = lon;
            Altitude = alt;
        }
    }

    [Serializable]
    public class SafeZone
    {
        public string Id;
        public string Name;
        public GeoLocation Center;
        public float Radius;
        public float BonusMultiplier = 1f;
        public bool IsActive = true;
    }

    [Serializable]
    public class DangerZone
    {
        public string Id;
        public DangerType Type;
        public GeoLocation Center;
        public float Radius;
    }

    public enum DangerType
    {
        Road,
        Water,
        Construction,
        PrivateProperty,
        Other
    }
}
