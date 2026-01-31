using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;
using CoinQuestAR.Core;

namespace CoinQuestAR.UI
{
    /// <summary>
    /// Manages all UI elements for the AR coin game
    /// </summary>
    public class UIManager : MonoBehaviour
    {
        [Header("HUD Elements")]
        [SerializeField] private GameObject hudPanel;
        [SerializeField] private TextMeshProUGUI coinBalanceText;
        [SerializeField] private TextMeshProUGUI comboText;
        [SerializeField] private TextMeshProUGUI distanceText;
        [SerializeField] private TextMeshProUGUI stepsText;
        [SerializeField] private Image comboProgressBar;

        [Header("Coin Collection Feedback")]
        [SerializeField] private GameObject coinPopupPrefab;
        [SerializeField] private Transform coinPopupContainer;
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private AudioClip coinCollectSound;

        [Header("Screens")]
        [SerializeField] private GameObject mainMenuScreen;
        [SerializeField] private GameObject walletScreen;
        [SerializeField] private GameObject redemptionScreen;
        [SerializeField] private GameObject settingsScreen;
        [SerializeField] private GameObject leaderboardScreen;
        [SerializeField] private GameObject loadingScreen;
        [SerializeField] private GameObject errorScreen;

        [Header("Wallet UI")]
        [SerializeField] private TextMeshProUGUI walletBalanceText;
        [SerializeField] private TextMeshProUGUI walletDollarValueText;
        [SerializeField] private TextMeshProUGUI todayEarningsText;
        [SerializeField] private TextMeshProUGUI weeklyEarningsText;

        [Header("Redemption UI")]
        [SerializeField] private Transform redemptionOptionsContainer;
        [SerializeField] private GameObject redemptionOptionPrefab;

        [Header("Error UI")]
        [SerializeField] private TextMeshProUGUI errorMessageText;

        private GameManager gameManager;
        private WalletManager walletManager;
        private int displayedBalance = 0;
        private Coroutine balanceAnimationCoroutine;

        private void Start()
        {
            gameManager = GameManager.Instance;
            walletManager = FindObjectOfType<WalletManager>();

            SubscribeToEvents();
            InitializeUI();
        }

        private void SubscribeToEvents()
        {
            if (gameManager != null)
            {
                gameManager.OnGameStateChanged += HandleGameStateChanged;
                gameManager.OnCoinsCollected += HandleCoinsCollected;
            }

            if (walletManager != null)
            {
                walletManager.OnBalanceChanged += HandleBalanceChanged;
            }
        }

        private void InitializeUI()
        {
            HideAllScreens();
            hudPanel.SetActive(false);
            loadingScreen.SetActive(true);
        }

        private void HandleGameStateChanged(GameState newState)
        {
            switch (newState)
            {
                case GameState.Loading:
                    HideAllScreens();
                    loadingScreen.SetActive(true);
                    break;

                case GameState.Playing:
                    HideAllScreens();
                    hudPanel.SetActive(true);
                    UpdateHUD();
                    break;

                case GameState.Paused:
                    mainMenuScreen.SetActive(true);
                    break;

                case GameState.Error:
                    HideAllScreens();
                    errorScreen.SetActive(true);
                    break;
            }
        }

        private void HandleCoinsCollected(int amount)
        {
            // Show coin popup
            ShowCoinPopup(amount);

            // Play sound
            if (audioSource != null && coinCollectSound != null)
            {
                audioSource.pitch = 1f + (gameManager.PlayerData.CurrentCombo * 0.05f);
                audioSource.PlayOneShot(coinCollectSound);
            }

            // Update combo display
            UpdateComboDisplay();
        }

        private void HandleBalanceChanged(int newBalance)
        {
            // Animate balance change
            if (balanceAnimationCoroutine != null)
            {
                StopCoroutine(balanceAnimationCoroutine);
            }
            balanceAnimationCoroutine = StartCoroutine(AnimateBalanceChange(newBalance));
        }

        private IEnumerator AnimateBalanceChange(int targetBalance)
        {
            float duration = 0.5f;
            float elapsed = 0f;
            int startBalance = displayedBalance;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                displayedBalance = Mathf.RoundToInt(Mathf.Lerp(startBalance, targetBalance, t));
                coinBalanceText.text = $"{displayedBalance:N0}";
                yield return null;
            }

            displayedBalance = targetBalance;
            coinBalanceText.text = $"{targetBalance:N0}";
        }

        private void ShowCoinPopup(int amount)
        {
            if (coinPopupPrefab == null || coinPopupContainer == null) return;

            GameObject popup = Instantiate(coinPopupPrefab, coinPopupContainer);
            CoinPopup popupScript = popup.GetComponent<CoinPopup>();

            if (popupScript != null)
            {
                popupScript.Initialize(amount, gameManager.PlayerData.CurrentCombo);
            }
        }

        private void UpdateComboDisplay()
        {
            int combo = gameManager.PlayerData.CurrentCombo;

            if (combo > 1)
            {
                comboText.gameObject.SetActive(true);
                comboText.text = $"x{combo} COMBO!";

                // Pulse animation
                StartCoroutine(PulseComboText());
            }
            else
            {
                comboText.gameObject.SetActive(false);
            }
        }

        private IEnumerator PulseComboText()
        {
            Vector3 originalScale = comboText.transform.localScale;
            Vector3 targetScale = originalScale * 1.3f;

            comboText.transform.localScale = targetScale;

            float duration = 0.2f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                comboText.transform.localScale = Vector3.Lerp(targetScale, originalScale, t);
                yield return null;
            }
        }

        private void UpdateHUD()
        {
            if (gameManager?.PlayerData == null) return;

            var data = gameManager.PlayerData;

            coinBalanceText.text = $"{data.TotalCoins:N0}";
            distanceText.text = $"{data.DistanceWalkedToday:N0}m";
            stepsText.text = $"{data.StepsToday:N0} steps";
        }

        public void ShowWallet()
        {
            HideAllScreens();
            walletScreen.SetActive(true);
            UpdateWalletScreen();
        }

        private void UpdateWalletScreen()
        {
            if (walletManager == null) return;

            walletBalanceText.text = $"{walletManager.LocalBalance:N0}";
            walletDollarValueText.text = $"${walletManager.RealMoneyValue:F2}";

            if (gameManager?.PlayerData != null)
            {
                todayEarningsText.text = $"+{gameManager.PlayerData.CoinsCollectedToday:N0} today";
            }
        }

        public void ShowRedemption()
        {
            HideAllScreens();
            redemptionScreen.SetActive(true);
            StartCoroutine(LoadRedemptionOptions());
        }

        private IEnumerator LoadRedemptionOptions()
        {
            yield return walletManager.GetRedemptionOptions();

            // Clear existing options
            foreach (Transform child in redemptionOptionsContainer)
            {
                Destroy(child.gameObject);
            }

            // Create option cards
            foreach (var option in walletManager.GetAvailableRedemptions())
            {
                GameObject optionCard = Instantiate(redemptionOptionPrefab, redemptionOptionsContainer);
                RedemptionOptionCard card = optionCard.GetComponent<RedemptionOptionCard>();

                if (card != null)
                {
                    card.Initialize(option, () => OnRedemptionOptionSelected(option));
                }
            }
        }

        private void OnRedemptionOptionSelected(RedemptionOption option)
        {
            if (walletManager.LocalBalance < option.CoinCost)
            {
                ShowNotification("Not enough coins!");
                return;
            }

            // Show confirmation dialog
            ShowRedemptionConfirmation(option);
        }

        private void ShowRedemptionConfirmation(RedemptionOption option)
        {
            // Implementation would show a confirmation dialog
            Debug.Log($"Confirming redemption: {option.Name} for {option.CoinCost} coins");
        }

        public void ShowLeaderboard()
        {
            HideAllScreens();
            leaderboardScreen.SetActive(true);
        }

        public void ShowSettings()
        {
            HideAllScreens();
            settingsScreen.SetActive(true);
        }

        public void ShowMainMenu()
        {
            HideAllScreens();
            mainMenuScreen.SetActive(true);
            gameManager.PauseGame();
        }

        public void ResumeGame()
        {
            HideAllScreens();
            hudPanel.SetActive(true);
            gameManager.ResumeGame();
        }

        public void ShowError(string message)
        {
            HideAllScreens();
            errorScreen.SetActive(true);
            errorMessageText.text = message;
        }

        public void ShowNotification(string message)
        {
            // Create and show a temporary notification
            Debug.Log($"[UI] Notification: {message}");
        }

        private void HideAllScreens()
        {
            mainMenuScreen?.SetActive(false);
            walletScreen?.SetActive(false);
            redemptionScreen?.SetActive(false);
            settingsScreen?.SetActive(false);
            leaderboardScreen?.SetActive(false);
            loadingScreen?.SetActive(false);
            errorScreen?.SetActive(false);
        }

        private void Update()
        {
            // Update distance and steps periodically
            if (gameManager?.CurrentState == GameState.Playing)
            {
                UpdateHUD();
            }
        }

        private void OnDestroy()
        {
            if (gameManager != null)
            {
                gameManager.OnGameStateChanged -= HandleGameStateChanged;
                gameManager.OnCoinsCollected -= HandleCoinsCollected;
            }

            if (walletManager != null)
            {
                walletManager.OnBalanceChanged -= HandleBalanceChanged;
            }
        }
    }

    /// <summary>
    /// Coin collection popup that animates and fades out
    /// </summary>
    public class CoinPopup : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI amountText;
        [SerializeField] private TextMeshProUGUI comboText;
        [SerializeField] private float lifetime = 1.5f;
        [SerializeField] private float riseSpeed = 50f;

        private CanvasGroup canvasGroup;

        public void Initialize(int amount, int combo)
        {
            amountText.text = $"+{amount}";

            if (combo > 1)
            {
                comboText.text = $"x{combo}";
                comboText.gameObject.SetActive(true);
            }
            else
            {
                comboText.gameObject.SetActive(false);
            }

            canvasGroup = GetComponent<CanvasGroup>();
            if (canvasGroup == null)
            {
                canvasGroup = gameObject.AddComponent<CanvasGroup>();
            }

            StartCoroutine(AnimateAndDestroy());
        }

        private IEnumerator AnimateAndDestroy()
        {
            float elapsed = 0f;
            Vector3 startPosition = transform.localPosition;

            while (elapsed < lifetime)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / lifetime;

                // Rise up
                transform.localPosition = startPosition + Vector3.up * (riseSpeed * t);

                // Fade out in last 30%
                if (t > 0.7f)
                {
                    canvasGroup.alpha = 1f - ((t - 0.7f) / 0.3f);
                }

                yield return null;
            }

            Destroy(gameObject);
        }
    }

    /// <summary>
    /// UI card for redemption options
    /// </summary>
    public class RedemptionOptionCard : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI nameText;
        [SerializeField] private TextMeshProUGUI descriptionText;
        [SerializeField] private TextMeshProUGUI costText;
        [SerializeField] private TextMeshProUGUI valueText;
        [SerializeField] private Image iconImage;
        [SerializeField] private Button selectButton;

        public void Initialize(RedemptionOption option, System.Action onSelect)
        {
            nameText.text = option.Name;
            descriptionText.text = option.Description;
            costText.text = $"{option.CoinCost:N0} coins";
            valueText.text = $"${option.DollarValue:F2}";

            selectButton.onClick.RemoveAllListeners();
            selectButton.onClick.AddListener(() => onSelect?.Invoke());

            // Set button interactable based on availability
            selectButton.interactable = option.IsAvailable;
        }
    }
}
