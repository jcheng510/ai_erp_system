using UnityEngine;
using System;
using System.Collections;

namespace CoinQuestAR.Gameplay
{
    /// <summary>
    /// Represents a collectible coin in the AR world
    /// </summary>
    public class Coin : MonoBehaviour
    {
        [Header("Visual Settings")]
        [SerializeField] private float rotationSpeed = 90f;
        [SerializeField] private float bobSpeed = 2f;
        [SerializeField] private float bobAmount = 0.1f;
        [SerializeField] private ParticleSystem glowEffect;
        [SerializeField] private ParticleSystem collectEffect;
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private AudioClip collectSound;

        [Header("Interaction")]
        [SerializeField] private float collectDistance = 2f;
        [SerializeField] private float gazeTimeRequired = 0.5f;
        [SerializeField] private GameObject highlightRing;

        public CoinType Type { get; private set; }
        public int Value { get; private set; }
        public bool IsCollectable { get; private set; } = true;

        public event Action<Coin> OnCollected;

        private Vector3 startPosition;
        private float gazeTimer = 0f;
        private bool isBeingGazedAt = false;
        private bool isCollected = false;
        private Transform playerCamera;
        private MeshRenderer meshRenderer;

        private void Awake()
        {
            meshRenderer = GetComponent<MeshRenderer>();
            playerCamera = Camera.main.transform;
            startPosition = transform.position;

            if (highlightRing != null)
                highlightRing.SetActive(false);
        }

        public void Initialize(CoinType type, int value)
        {
            Type = type;
            Value = value;

            // Set visual based on coin type
            UpdateVisuals();
        }

        private void Update()
        {
            if (isCollected) return;

            // Rotate and bob animation
            AnimateCoin();

            // Check for player proximity and gaze
            CheckPlayerInteraction();

            // Always face the player slightly
            FacePlayer();
        }

        private void AnimateCoin()
        {
            // Rotation
            transform.Rotate(Vector3.up, rotationSpeed * Time.deltaTime);

            // Bobbing
            float newY = startPosition.y + Mathf.Sin(Time.time * bobSpeed) * bobAmount;
            transform.position = new Vector3(transform.position.x, newY, transform.position.z);
        }

        private void FacePlayer()
        {
            if (playerCamera == null) return;

            Vector3 directionToPlayer = playerCamera.position - transform.position;
            directionToPlayer.y = 0;

            if (directionToPlayer.magnitude > 0.1f)
            {
                Quaternion targetRotation = Quaternion.LookRotation(directionToPlayer);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, Time.deltaTime * 2f);
            }
        }

        private void CheckPlayerInteraction()
        {
            if (!IsCollectable) return;

            float distanceToPlayer = Vector3.Distance(transform.position, playerCamera.position);

            // Check if player is close enough
            if (distanceToPlayer <= collectDistance)
            {
                // Check if player is looking at the coin
                if (IsPlayerGazingAtCoin())
                {
                    if (!isBeingGazedAt)
                    {
                        isBeingGazedAt = true;
                        OnGazeEnter();
                    }

                    gazeTimer += Time.deltaTime;

                    // Update highlight progress
                    UpdateHighlightProgress(gazeTimer / gazeTimeRequired);

                    if (gazeTimer >= gazeTimeRequired)
                    {
                        Collect();
                    }
                }
                else
                {
                    ResetGaze();
                }
            }
            else
            {
                ResetGaze();
            }
        }

        private bool IsPlayerGazingAtCoin()
        {
            Ray gazeRay = new Ray(playerCamera.position, playerCamera.forward);

            // Check if the gaze ray hits this coin
            if (Physics.Raycast(gazeRay, out RaycastHit hit, collectDistance * 1.5f))
            {
                return hit.collider.gameObject == gameObject;
            }

            // Alternative: Check if coin is within a cone in front of the player
            Vector3 directionToCoin = (transform.position - playerCamera.position).normalized;
            float angle = Vector3.Angle(playerCamera.forward, directionToCoin);

            return angle < 15f; // 15 degree cone
        }

        private void OnGazeEnter()
        {
            if (highlightRing != null)
                highlightRing.SetActive(true);

            // Scale up slightly
            StartCoroutine(ScaleTo(transform.localScale * 1.2f, 0.2f));
        }

        private void ResetGaze()
        {
            if (isBeingGazedAt)
            {
                isBeingGazedAt = false;
                gazeTimer = 0f;

                if (highlightRing != null)
                    highlightRing.SetActive(false);

                // Reset scale
                StartCoroutine(ScaleTo(Vector3.one, 0.2f));
            }
        }

        private void UpdateHighlightProgress(float progress)
        {
            if (highlightRing != null)
            {
                // Update ring fill or scale based on progress
                float scale = 1f + (progress * 0.5f);
                highlightRing.transform.localScale = Vector3.one * scale;
            }
        }

        public void Collect()
        {
            if (isCollected) return;
            isCollected = true;
            IsCollectable = false;

            Debug.Log($"[CoinQuest] Collecting {Type} coin worth {Value}!");

            // Play effects
            StartCoroutine(PlayCollectSequence());
        }

        private IEnumerator PlayCollectSequence()
        {
            // Play sound
            if (audioSource != null && collectSound != null)
            {
                audioSource.PlayOneShot(collectSound);
            }

            // Play particle effect
            if (collectEffect != null)
            {
                collectEffect.transform.parent = null;
                collectEffect.Play();
            }

            // Animate coin flying to player
            Vector3 startPos = transform.position;
            Vector3 endPos = playerCamera.position + playerCamera.forward * 0.5f;
            float duration = 0.3f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                float easeIn = t * t;

                transform.position = Vector3.Lerp(startPos, endPos, easeIn);
                transform.localScale = Vector3.Lerp(Vector3.one, Vector3.zero, easeIn);

                yield return null;
            }

            // Notify listeners
            OnCollected?.Invoke(this);

            // Destroy the coin
            Destroy(gameObject);
        }

        public void Despawn()
        {
            if (isCollected) return;

            StartCoroutine(DespawnSequence());
        }

        private IEnumerator DespawnSequence()
        {
            float duration = 0.5f;
            float elapsed = 0f;
            Vector3 startScale = transform.localScale;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                transform.localScale = Vector3.Lerp(startScale, Vector3.zero, t);
                yield return null;
            }

            Destroy(gameObject);
        }

        private IEnumerator ScaleTo(Vector3 targetScale, float duration)
        {
            Vector3 startScale = transform.localScale;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                transform.localScale = Vector3.Lerp(startScale, targetScale, t);
                yield return null;
            }

            transform.localScale = targetScale;
        }

        private void UpdateVisuals()
        {
            if (meshRenderer == null) return;

            Color coinColor = Type switch
            {
                CoinType.Gold => new Color(1f, 0.84f, 0f),
                CoinType.Silver => new Color(0.75f, 0.75f, 0.75f),
                CoinType.Special => new Color(0.5f, 0f, 1f),
                _ => new Color(0.8f, 0.5f, 0.2f)
            };

            meshRenderer.material.color = coinColor;

            // Special coins have extra glow
            if (Type == CoinType.Special && glowEffect != null)
            {
                var main = glowEffect.main;
                main.startColor = coinColor;
                glowEffect.Play();
            }
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(transform.position, collectDistance);
        }
    }

    public enum CoinType
    {
        Bronze,
        Silver,
        Gold,
        Special
    }
}
