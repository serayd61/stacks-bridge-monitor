;; ============================================================================
;; NFT Rewards - SIP-009 Non-Fungible Token Rewards
;; ============================================================================
;; Achievement-based NFT rewards for bridge users. Different tiers
;; based on bridge usage, staking, and governance participation.
;; ============================================================================

;; SIP-009 Trait
(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u9001))
(define-constant ERR-TOKEN-NOT-FOUND (err u9002))
(define-constant ERR-ALREADY-CLAIMED (err u9003))
(define-constant ERR-NOT-ELIGIBLE (err u9004))
(define-constant ERR-MAX-SUPPLY-REACHED (err u9005))
(define-constant ERR-TRANSFER-NOT-ALLOWED (err u9006))
(define-constant ERR-INVALID-TIER (err u9007))
(define-constant ERR-MINTING-PAUSED (err u9008))

;; NFT Tiers
(define-constant TIER-BRONZE u1)
(define-constant TIER-SILVER u2)
(define-constant TIER-GOLD u3)
(define-constant TIER-PLATINUM u4)
(define-constant TIER-DIAMOND u5)

;; NFT Definition
(define-non-fungible-token bridge-reward-nft uint)

;; Data Variables
(define-data-var last-token-id uint u0)
(define-data-var minting-paused bool false)
(define-data-var base-uri (string-ascii 200) "https://stacks-bridge-monitor.vercel.app/api/nft/")

;; Max supply per tier
(define-map tier-max-supply uint uint)
(define-map tier-minted uint uint)

;; Tier requirements (minimum bridge transactions)
(define-map tier-requirements
  uint
  {
    min-transactions: uint,
    min-volume: uint,
    name: (string-ascii 20),
    description: (string-ascii 100)
  }
)

;; Token metadata
(define-map token-metadata
  uint
  {
    tier: uint,
    owner: principal,
    minted-at: uint,
    achievement: (string-ascii 100)
  }
)

;; Claimed tiers per user
(define-map user-claimed-tiers
  { user: principal, tier: uint }
  bool
)

;; User achievements
(define-map user-achievements
  principal
  {
    total-bridges: uint,
    total-volume: uint,
    governance-votes: uint,
    staking-days: uint,
    nfts-owned: uint
  }
)

;; Authorized achievement updaters
(define-map achievement-updaters principal bool)

;; Initialize tiers
(map-set tier-max-supply TIER-BRONZE u10000)
(map-set tier-max-supply TIER-SILVER u5000)
(map-set tier-max-supply TIER-GOLD u2000)
(map-set tier-max-supply TIER-PLATINUM u500)
(map-set tier-max-supply TIER-DIAMOND u100)

(map-set tier-minted TIER-BRONZE u0)
(map-set tier-minted TIER-SILVER u0)
(map-set tier-minted TIER-GOLD u0)
(map-set tier-minted TIER-PLATINUM u0)
(map-set tier-minted TIER-DIAMOND u0)

(map-set tier-requirements TIER-BRONZE { min-transactions: u5, min-volume: u1000000, name: "Bronze Bridge", description: "Completed 5 bridge transactions" })
(map-set tier-requirements TIER-SILVER { min-transactions: u25, min-volume: u10000000, name: "Silver Bridge", description: "Completed 25 bridge transactions" })
(map-set tier-requirements TIER-GOLD { min-transactions: u100, min-volume: u100000000, name: "Gold Bridge", description: "Completed 100 bridge transactions" })
(map-set tier-requirements TIER-PLATINUM { min-transactions: u500, min-volume: u1000000000, name: "Platinum Bridge", description: "Completed 500 bridge transactions" })
(map-set tier-requirements TIER-DIAMOND { min-transactions: u1000, min-volume: u10000000000, name: "Diamond Bridge", description: "Completed 1000 bridge transactions" })

(map-set achievement-updaters CONTRACT-OWNER true)

;; ============================================================================
;; SIP-009 Standard Functions
;; ============================================================================

(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
  (ok (some (var-get base-uri)))
)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? bridge-reward-nft token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (nft-transfer? bridge-reward-nft token-id sender recipient)
  )
)

;; ============================================================================
;; Claim NFT Reward
;; ============================================================================

(define-public (claim-reward (tier uint))
  (let
    (
      (token-id (+ (var-get last-token-id) u1))
      (requirements (unwrap! (map-get? tier-requirements tier) ERR-INVALID-TIER))
      (user-stats (default-to
        { total-bridges: u0, total-volume: u0, governance-votes: u0, staking-days: u0, nfts-owned: u0 }
        (map-get? user-achievements tx-sender)))
      (max-supply (unwrap! (map-get? tier-max-supply tier) ERR-INVALID-TIER))
      (current-minted (default-to u0 (map-get? tier-minted tier)))
    )
    (asserts! (not (var-get minting-paused)) ERR-MINTING-PAUSED)
    (asserts! (and (>= tier TIER-BRONZE) (<= tier TIER-DIAMOND)) ERR-INVALID-TIER)
    (asserts! (< current-minted max-supply) ERR-MAX-SUPPLY-REACHED)

    ;; Check not already claimed
    (asserts! (is-none (map-get? user-claimed-tiers { user: tx-sender, tier: tier }))
              ERR-ALREADY-CLAIMED)

    ;; Check eligibility
    (asserts! (>= (get total-bridges user-stats) (get min-transactions requirements)) ERR-NOT-ELIGIBLE)
    (asserts! (>= (get total-volume user-stats) (get min-volume requirements)) ERR-NOT-ELIGIBLE)

    ;; Mint NFT
    (try! (nft-mint? bridge-reward-nft token-id tx-sender))

    ;; Store metadata
    (map-set token-metadata token-id {
      tier: tier,
      owner: tx-sender,
      minted-at: block-height,
      achievement: (get name requirements)
    })

    ;; Mark as claimed
    (map-set user-claimed-tiers { user: tx-sender, tier: tier } true)

    ;; Update counters
    (var-set last-token-id token-id)
    (map-set tier-minted tier (+ current-minted u1))

    ;; Update user nft count
    (map-set user-achievements tx-sender
      (merge user-stats { nfts-owned: (+ (get nfts-owned user-stats) u1) }))

    (print {
      event: "nft-claimed",
      token-id: token-id,
      tier: tier,
      tier-name: (get name requirements),
      owner: tx-sender
    })

    (ok token-id)
  )
)

;; ============================================================================
;; Achievement Updates (called by other contracts)
;; ============================================================================

(define-public (update-achievements
    (user principal)
    (bridges uint)
    (volume uint)
    (votes uint)
    (staking uint)
  )
  (let
    (
      (current (default-to
        { total-bridges: u0, total-volume: u0, governance-votes: u0, staking-days: u0, nfts-owned: u0 }
        (map-get? user-achievements user)))
    )
    (asserts! (is-achievement-updater tx-sender) ERR-NOT-AUTHORIZED)
    (ok (map-set user-achievements user {
      total-bridges: (+ (get total-bridges current) bridges),
      total-volume: (+ (get total-volume current) volume),
      governance-votes: (+ (get governance-votes current) votes),
      staking-days: (+ (get staking-days current) staking),
      nfts-owned: (get nfts-owned current)
    }))
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-achievement-updater (updater principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set achievement-updaters updater enabled))
  )
)

(define-public (toggle-minting-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set minting-paused (not (var-get minting-paused))))
  )
)

(define-public (set-base-uri (new-uri (string-ascii 200)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set base-uri new-uri))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-token-metadata (token-id uint))
  (map-get? token-metadata token-id)
)

(define-read-only (get-user-achievements (user principal))
  (map-get? user-achievements user)
)

(define-read-only (has-claimed-tier (user principal) (tier uint))
  (default-to false (map-get? user-claimed-tiers { user: user, tier: tier }))
)

(define-read-only (get-tier-info (tier uint))
  (map-get? tier-requirements tier)
)

(define-read-only (get-tier-supply (tier uint))
  {
    minted: (default-to u0 (map-get? tier-minted tier)),
    max: (default-to u0 (map-get? tier-max-supply tier))
  }
)

(define-read-only (is-eligible (user principal) (tier uint))
  (match (map-get? tier-requirements tier)
    req
      (match (map-get? user-achievements user)
        stats
          (and
            (>= (get total-bridges stats) (get min-transactions req))
            (>= (get total-volume stats) (get min-volume req))
            (is-none (map-get? user-claimed-tiers { user: user, tier: tier })))
        false
      )
    false
  )
)

(define-read-only (get-nft-stats)
  {
    total-minted: (var-get last-token-id),
    bronze-minted: (default-to u0 (map-get? tier-minted TIER-BRONZE)),
    silver-minted: (default-to u0 (map-get? tier-minted TIER-SILVER)),
    gold-minted: (default-to u0 (map-get? tier-minted TIER-GOLD)),
    platinum-minted: (default-to u0 (map-get? tier-minted TIER-PLATINUM)),
    diamond-minted: (default-to u0 (map-get? tier-minted TIER-DIAMOND)),
    is-paused: (var-get minting-paused)
  }
)

(define-read-only (is-achievement-updater (account principal))
  (default-to false (map-get? achievement-updaters account))
)
