using UnityEngine;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Networking;

namespace CoinQuestAR.Core
{
    /// <summary>
    /// Manages the player's coin wallet and sync with server
    /// </summary>
    public class WalletManager : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private string apiBaseUrl = "https://api.coinquestar.com/v1";
        [SerializeField] private float syncInterval = 30f;
        [SerializeField] private int minCoinsToSync = 10;

        public int LocalBalance { get; private set; }
        public int ServerBalance { get; private set; }
        public int PendingCoins { get; private set; }
        public float RealMoneyValue { get; private set; }
        public bool IsSyncing { get; private set; }

        public event Action<int> OnBalanceChanged;
        public event Action<int> OnCoinsAdded;
        public event Action<RedemptionResult> OnRedemptionComplete;
        public event Action<string> OnSyncError;

        private string authToken;
        private Queue<CoinTransaction> pendingTransactions = new Queue<CoinTransaction>();
        private List<RedemptionOption> availableRedemptions = new List<RedemptionOption>();

        private const float COIN_TO_DOLLAR_RATE = 0.001f; // 1000 coins = $1

        private void Start()
        {
            LoadLocalWallet();
            StartCoroutine(AutoSyncLoop());
        }

        public IEnumerator SyncWithServer()
        {
            if (IsSyncing) yield break;

            IsSyncing = true;
            Debug.Log("[Wallet] Syncing with server...");

            // Get current balance from server
            using (UnityWebRequest request = UnityWebRequest.Get($"{apiBaseUrl}/wallet/balance"))
            {
                request.SetRequestHeader("Authorization", $"Bearer {authToken}");

                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    var response = JsonUtility.FromJson<BalanceResponse>(request.downloadHandler.text);
                    ServerBalance = response.balance;
                    RealMoneyValue = response.balance * COIN_TO_DOLLAR_RATE;

                    // Sync pending transactions
                    yield return SyncPendingTransactions();

                    LocalBalance = ServerBalance + PendingCoins;
                    OnBalanceChanged?.Invoke(LocalBalance);

                    Debug.Log($"[Wallet] Sync complete. Balance: {LocalBalance} coins (${RealMoneyValue:F2})");
                }
                else
                {
                    OnSyncError?.Invoke(request.error);
                    Debug.LogWarning($"[Wallet] Sync failed: {request.error}");
                }
            }

            IsSyncing = false;
        }

        private IEnumerator SyncPendingTransactions()
        {
            while (pendingTransactions.Count > 0)
            {
                var transaction = pendingTransactions.Peek();

                var transactionData = new TransactionRequest
                {
                    amount = transaction.Amount,
                    type = transaction.Type.ToString(),
                    timestamp = transaction.Timestamp,
                    location = transaction.Location
                };

                string json = JsonUtility.ToJson(transactionData);

                using (UnityWebRequest request = new UnityWebRequest($"{apiBaseUrl}/wallet/transaction", "POST"))
                {
                    byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
                    request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                    request.downloadHandler = new DownloadHandlerBuffer();
                    request.SetRequestHeader("Content-Type", "application/json");
                    request.SetRequestHeader("Authorization", $"Bearer {authToken}");

                    yield return request.SendWebRequest();

                    if (request.result == UnityWebRequest.Result.Success)
                    {
                        pendingTransactions.Dequeue();
                        PendingCoins -= transaction.Amount;
                        SaveLocalWallet();
                    }
                    else
                    {
                        // Keep transaction in queue for retry
                        Debug.LogWarning($"[Wallet] Failed to sync transaction: {request.error}");
                        break;
                    }
                }
            }
        }

        public void AddCoins(int amount)
        {
            if (amount <= 0) return;

            LocalBalance += amount;
            PendingCoins += amount;

            var transaction = new CoinTransaction
            {
                Amount = amount,
                Type = TransactionType.Collect,
                Timestamp = DateTime.UtcNow.ToString("o"),
                Location = GetCurrentLocationString()
            };

            pendingTransactions.Enqueue(transaction);
            SaveLocalWallet();

            OnCoinsAdded?.Invoke(amount);
            OnBalanceChanged?.Invoke(LocalBalance);

            // Auto-sync if enough pending coins
            if (PendingCoins >= minCoinsToSync)
            {
                StartCoroutine(SyncWithServer());
            }
        }

        public IEnumerator RedeemCoins(RedemptionOption option)
        {
            if (LocalBalance < option.CoinCost)
            {
                OnRedemptionComplete?.Invoke(new RedemptionResult
                {
                    Success = false,
                    Message = "Insufficient coins"
                });
                yield break;
            }

            Debug.Log($"[Wallet] Redeeming {option.CoinCost} coins for {option.Name}...");

            var redemptionRequest = new RedemptionRequest
            {
                optionId = option.Id,
                coinAmount = option.CoinCost
            };

            string json = JsonUtility.ToJson(redemptionRequest);

            using (UnityWebRequest request = new UnityWebRequest($"{apiBaseUrl}/wallet/redeem", "POST"))
            {
                byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");
                request.SetRequestHeader("Authorization", $"Bearer {authToken}");

                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    var response = JsonUtility.FromJson<RedemptionResponse>(request.downloadHandler.text);

                    LocalBalance -= option.CoinCost;
                    ServerBalance = response.newBalance;
                    RealMoneyValue = ServerBalance * COIN_TO_DOLLAR_RATE;

                    SaveLocalWallet();
                    OnBalanceChanged?.Invoke(LocalBalance);

                    OnRedemptionComplete?.Invoke(new RedemptionResult
                    {
                        Success = true,
                        Message = response.message,
                        RewardDetails = response.rewardDetails
                    });

                    Debug.Log($"[Wallet] Redemption successful! New balance: {LocalBalance}");
                }
                else
                {
                    OnRedemptionComplete?.Invoke(new RedemptionResult
                    {
                        Success = false,
                        Message = $"Redemption failed: {request.error}"
                    });
                }
            }
        }

        public IEnumerator GetRedemptionOptions()
        {
            using (UnityWebRequest request = UnityWebRequest.Get($"{apiBaseUrl}/redemption/options"))
            {
                request.SetRequestHeader("Authorization", $"Bearer {authToken}");

                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    var response = JsonUtility.FromJson<RedemptionOptionsResponse>(request.downloadHandler.text);
                    availableRedemptions = new List<RedemptionOption>(response.options);
                }
            }
        }

        public List<RedemptionOption> GetAvailableRedemptions()
        {
            return availableRedemptions;
        }

        public float GetRealMoneyValue(int coins)
        {
            return coins * COIN_TO_DOLLAR_RATE;
        }

        private IEnumerator AutoSyncLoop()
        {
            while (true)
            {
                yield return new WaitForSeconds(syncInterval);
                yield return SyncWithServer();
            }
        }

        private void LoadLocalWallet()
        {
            LocalBalance = PlayerPrefs.GetInt("WalletBalance", 0);
            PendingCoins = PlayerPrefs.GetInt("PendingCoins", 0);

            // Load pending transactions
            string transactionsJson = PlayerPrefs.GetString("PendingTransactions", "");
            if (!string.IsNullOrEmpty(transactionsJson))
            {
                var saved = JsonUtility.FromJson<SavedTransactions>(transactionsJson);
                if (saved != null && saved.transactions != null)
                {
                    foreach (var t in saved.transactions)
                    {
                        pendingTransactions.Enqueue(t);
                    }
                }
            }
        }

        private void SaveLocalWallet()
        {
            PlayerPrefs.SetInt("WalletBalance", LocalBalance);
            PlayerPrefs.SetInt("PendingCoins", PendingCoins);

            var saved = new SavedTransactions
            {
                transactions = pendingTransactions.ToArray()
            };
            PlayerPrefs.SetString("PendingTransactions", JsonUtility.ToJson(saved));
            PlayerPrefs.Save();
        }

        private string GetCurrentLocationString()
        {
            var locationService = FindObjectOfType<LocationService>();
            if (locationService != null && locationService.CurrentLocation != null)
            {
                return $"{locationService.CurrentLocation.Latitude},{locationService.CurrentLocation.Longitude}";
            }
            return "0,0";
        }

        public void SetAuthToken(string token)
        {
            authToken = token;
        }
    }

    [Serializable]
    public class CoinTransaction
    {
        public int Amount;
        public TransactionType Type;
        public string Timestamp;
        public string Location;
    }

    public enum TransactionType
    {
        Collect,
        Redeem,
        Bonus,
        Transfer
    }

    [Serializable]
    public class RedemptionOption
    {
        public string Id;
        public string Name;
        public string Description;
        public int CoinCost;
        public RedemptionType Type;
        public float DollarValue;
        public string ImageUrl;
        public bool IsAvailable;
    }

    public enum RedemptionType
    {
        Cash,
        GiftCard,
        PhysicalPrize,
        InGameItem,
        Donation
    }

    [Serializable]
    public class RedemptionResult
    {
        public bool Success;
        public string Message;
        public string RewardDetails;
    }

    // API Request/Response classes
    [Serializable]
    public class BalanceResponse
    {
        public int balance;
        public int lifetimeEarnings;
        public int lifetimeRedeemed;
    }

    [Serializable]
    public class TransactionRequest
    {
        public int amount;
        public string type;
        public string timestamp;
        public string location;
    }

    [Serializable]
    public class RedemptionRequest
    {
        public string optionId;
        public int coinAmount;
    }

    [Serializable]
    public class RedemptionResponse
    {
        public bool success;
        public int newBalance;
        public string message;
        public string rewardDetails;
    }

    [Serializable]
    public class RedemptionOptionsResponse
    {
        public RedemptionOption[] options;
    }

    [Serializable]
    public class SavedTransactions
    {
        public CoinTransaction[] transactions;
    }
}
