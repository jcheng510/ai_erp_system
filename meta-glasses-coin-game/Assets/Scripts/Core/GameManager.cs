using UnityEngine;
using System;
using System.Collections.Generic;

namespace CoinQuestAR.Core
{
    /// <summary>
    /// Central game manager that coordinates all game systems
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Game Settings")]
        [SerializeField] private float coinSpawnRadius = 50f;
        [SerializeField] private int maxActiveCoins = 20;
        [SerializeField] private float coinRefreshInterval = 30f;

        [Header("References")]
        [SerializeField] private CoinSpawner coinSpawner;
        [SerializeField] private LocationService locationService;
        [SerializeField] private WalletManager walletManager;
        [SerializeField] private UIManager uiManager;

        public GameState CurrentState { get; private set; } = GameState.Initializing;
        public PlayerData PlayerData { get; private set; }

        public event Action<GameState> OnGameStateChanged;
        public event Action<int> OnCoinsCollected;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
                return;
            }

            InitializeGame();
        }

        private void InitializeGame()
        {
            Debug.Log("[CoinQuest] Initializing game systems...");

            PlayerData = new PlayerData();
            LoadPlayerData();

            SetGameState(GameState.Loading);
        }

        private void Start()
        {
            StartCoroutine(InitializeServices());
        }

        private System.Collections.IEnumerator InitializeServices()
        {
            // Initialize location services
            yield return locationService.Initialize();

            if (!locationService.IsAvailable)
            {
                SetGameState(GameState.Error);
                uiManager.ShowError("Location services required for gameplay");
                yield break;
            }

            // Initialize wallet and sync with server
            yield return walletManager.SyncWithServer();

            // Start coin spawning
            coinSpawner.Initialize(coinSpawnRadius, maxActiveCoins);

            SetGameState(GameState.Playing);
            Debug.Log("[CoinQuest] Game initialized successfully!");
        }

        public void SetGameState(GameState newState)
        {
            if (CurrentState == newState) return;

            CurrentState = newState;
            OnGameStateChanged?.Invoke(newState);

            Debug.Log($"[CoinQuest] Game state changed to: {newState}");
        }

        public void CollectCoin(Coin coin)
        {
            if (CurrentState != GameState.Playing) return;

            int coinValue = coin.Value;

            // Apply any active multipliers
            coinValue = ApplyMultipliers(coinValue);

            PlayerData.TotalCoins += coinValue;
            PlayerData.CoinsCollectedToday += coinValue;
            PlayerData.TotalCoinsCollected++;

            walletManager.AddCoins(coinValue);
            OnCoinsCollected?.Invoke(coinValue);

            SavePlayerData();

            Debug.Log($"[CoinQuest] Collected coin worth {coinValue}! Total: {PlayerData.TotalCoins}");
        }

        private int ApplyMultipliers(int baseValue)
        {
            float multiplier = 1f;

            // Combo multiplier
            if (PlayerData.CurrentCombo > 1)
            {
                multiplier += (PlayerData.CurrentCombo - 1) * 0.1f;
            }

            // Distance bonus
            if (PlayerData.DistanceWalkedToday > 1000) // meters
            {
                multiplier += 0.25f;
            }

            // Step goal bonus
            if (PlayerData.StepsToday >= PlayerData.DailyStepGoal)
            {
                multiplier += 0.5f;
            }

            return Mathf.RoundToInt(baseValue * multiplier);
        }

        public void PauseGame()
        {
            if (CurrentState == GameState.Playing)
            {
                SetGameState(GameState.Paused);
                coinSpawner.PauseSpawning();
            }
        }

        public void ResumeGame()
        {
            if (CurrentState == GameState.Paused)
            {
                SetGameState(GameState.Playing);
                coinSpawner.ResumeSpawning();
            }
        }

        private void LoadPlayerData()
        {
            string json = PlayerPrefs.GetString("PlayerData", "");
            if (!string.IsNullOrEmpty(json))
            {
                PlayerData = JsonUtility.FromJson<PlayerData>(json);
            }

            // Reset daily stats if new day
            if (PlayerData.LastPlayDate.Date != DateTime.Today)
            {
                PlayerData.CoinsCollectedToday = 0;
                PlayerData.StepsToday = 0;
                PlayerData.DistanceWalkedToday = 0;
                PlayerData.LastPlayDate = DateTime.Today;
            }
        }

        private void SavePlayerData()
        {
            string json = JsonUtility.ToJson(PlayerData);
            PlayerPrefs.SetString("PlayerData", json);
            PlayerPrefs.Save();
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                SavePlayerData();
            }
        }

        private void OnApplicationQuit()
        {
            SavePlayerData();
        }
    }

    public enum GameState
    {
        Initializing,
        Loading,
        Playing,
        Paused,
        Error
    }

    [Serializable]
    public class PlayerData
    {
        public string PlayerId;
        public string DisplayName;
        public int TotalCoins;
        public int TotalCoinsCollected;
        public int CoinsCollectedToday;
        public int CurrentCombo;
        public int HighestCombo;
        public int StepsToday;
        public int DailyStepGoal = 10000;
        public float DistanceWalkedToday;
        public float TotalDistanceWalked;
        public DateTime LastPlayDate;
        public int CurrentLevel;
        public int ExperiencePoints;
        public List<string> UnlockedAchievements = new List<string>();
    }
}
