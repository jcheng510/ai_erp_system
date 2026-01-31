using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using CoinQuestAR.Core;

namespace CoinQuestAR.Gameplay
{
    /// <summary>
    /// Handles spawning coins in AR space based on player location
    /// </summary>
    public class CoinSpawner : MonoBehaviour
    {
        [Header("Coin Prefabs")]
        [SerializeField] private GameObject goldCoinPrefab;
        [SerializeField] private GameObject silverCoinPrefab;
        [SerializeField] private GameObject bronzeCoinPrefab;
        [SerializeField] private GameObject specialCoinPrefab;

        [Header("Spawn Settings")]
        [SerializeField] private float minSpawnDistance = 5f;
        [SerializeField] private float maxSpawnDistance = 30f;
        [SerializeField] private float minSpawnHeight = 0.5f;
        [SerializeField] private float maxSpawnHeight = 2f;
        [SerializeField] private float spawnInterval = 5f;

        [Header("Coin Distribution")]
        [Range(0, 100)] [SerializeField] private int goldCoinChance = 10;
        [Range(0, 100)] [SerializeField] private int silverCoinChance = 30;
        [Range(0, 100)] [SerializeField] private int specialCoinChance = 5;

        private float spawnRadius;
        private int maxCoins;
        private List<Coin> activeCoins = new List<Coin>();
        private bool isSpawning = false;
        private Transform playerTransform;
        private LocationService locationService;

        public void Initialize(float radius, int maxActiveCoins)
        {
            spawnRadius = radius;
            maxCoins = maxActiveCoins;
            playerTransform = Camera.main.transform;
            locationService = FindObjectOfType<LocationService>();

            StartSpawning();
        }

        public void StartSpawning()
        {
            if (!isSpawning)
            {
                isSpawning = true;
                StartCoroutine(SpawnLoop());
            }
        }

        public void PauseSpawning()
        {
            isSpawning = false;
            StopCoroutine(SpawnLoop());
        }

        public void ResumeSpawning()
        {
            StartSpawning();
        }

        private IEnumerator SpawnLoop()
        {
            while (isSpawning)
            {
                if (activeCoins.Count < maxCoins)
                {
                    SpawnCoin();
                }

                // Clean up distant coins
                CleanupDistantCoins();

                yield return new WaitForSeconds(spawnInterval);
            }
        }

        private void SpawnCoin()
        {
            Vector3 spawnPosition = GetValidSpawnPosition();
            if (spawnPosition == Vector3.zero) return;

            CoinType coinType = DetermineCoinType();
            GameObject coinPrefab = GetCoinPrefab(coinType);

            GameObject coinObject = Instantiate(coinPrefab, spawnPosition, Quaternion.identity);
            Coin coin = coinObject.GetComponent<Coin>();

            if (coin != null)
            {
                coin.Initialize(coinType, GetCoinValue(coinType));
                coin.OnCollected += HandleCoinCollected;
                activeCoins.Add(coin);

                // Add spawn effect
                StartCoroutine(PlaySpawnEffect(coinObject));
            }
        }

        private Vector3 GetValidSpawnPosition()
        {
            int maxAttempts = 10;

            for (int i = 0; i < maxAttempts; i++)
            {
                // Random position around player
                Vector2 randomCircle = Random.insideUnitCircle.normalized;
                float distance = Random.Range(minSpawnDistance, maxSpawnDistance);

                Vector3 offset = new Vector3(randomCircle.x * distance, 0, randomCircle.y * distance);
                Vector3 potentialPosition = playerTransform.position + offset;

                // Raycast to find ground
                if (Physics.Raycast(potentialPosition + Vector3.up * 10f, Vector3.down, out RaycastHit hit, 20f))
                {
                    float spawnHeight = Random.Range(minSpawnHeight, maxSpawnHeight);
                    Vector3 finalPosition = hit.point + Vector3.up * spawnHeight;

                    // Check if position is valid (not inside objects, safe area)
                    if (IsValidSpawnLocation(finalPosition))
                    {
                        return finalPosition;
                    }
                }
            }

            // Fallback: spawn in front of player
            return playerTransform.position + playerTransform.forward * minSpawnDistance + Vector3.up;
        }

        private bool IsValidSpawnLocation(Vector3 position)
        {
            // Check for obstacles
            Collider[] colliders = Physics.OverlapSphere(position, 0.5f);
            if (colliders.Length > 0) return false;

            // Check if not too close to other coins
            foreach (Coin coin in activeCoins)
            {
                if (coin != null && Vector3.Distance(coin.transform.position, position) < 2f)
                {
                    return false;
                }
            }

            // Check if in safe zone (not roads, water, etc.)
            if (locationService != null && !locationService.IsLocationSafe(position))
            {
                return false;
            }

            return true;
        }

        private CoinType DetermineCoinType()
        {
            int roll = Random.Range(0, 100);

            if (roll < specialCoinChance)
                return CoinType.Special;
            if (roll < specialCoinChance + goldCoinChance)
                return CoinType.Gold;
            if (roll < specialCoinChance + goldCoinChance + silverCoinChance)
                return CoinType.Silver;

            return CoinType.Bronze;
        }

        private GameObject GetCoinPrefab(CoinType type)
        {
            return type switch
            {
                CoinType.Gold => goldCoinPrefab,
                CoinType.Silver => silverCoinPrefab,
                CoinType.Special => specialCoinPrefab,
                _ => bronzeCoinPrefab
            };
        }

        private int GetCoinValue(CoinType type)
        {
            return type switch
            {
                CoinType.Special => 100,
                CoinType.Gold => 25,
                CoinType.Silver => 10,
                CoinType.Bronze => 5,
                _ => 1
            };
        }

        private void HandleCoinCollected(Coin coin)
        {
            coin.OnCollected -= HandleCoinCollected;
            activeCoins.Remove(coin);
            GameManager.Instance.CollectCoin(coin);
        }

        private void CleanupDistantCoins()
        {
            float despawnDistance = spawnRadius * 1.5f;

            for (int i = activeCoins.Count - 1; i >= 0; i--)
            {
                Coin coin = activeCoins[i];
                if (coin == null)
                {
                    activeCoins.RemoveAt(i);
                    continue;
                }

                float distance = Vector3.Distance(playerTransform.position, coin.transform.position);
                if (distance > despawnDistance)
                {
                    coin.Despawn();
                    activeCoins.RemoveAt(i);
                }
            }
        }

        private IEnumerator PlaySpawnEffect(GameObject coinObject)
        {
            Vector3 targetScale = coinObject.transform.localScale;
            coinObject.transform.localScale = Vector3.zero;

            float duration = 0.3f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                float easeOut = 1f - Mathf.Pow(1f - t, 3f);
                coinObject.transform.localScale = Vector3.Lerp(Vector3.zero, targetScale, easeOut);
                yield return null;
            }

            coinObject.transform.localScale = targetScale;
        }

        public List<Coin> GetActiveCoins()
        {
            return new List<Coin>(activeCoins);
        }

        public int GetActiveCoinCount()
        {
            return activeCoins.Count;
        }
    }
}
