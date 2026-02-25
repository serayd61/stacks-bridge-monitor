;; ============================================================================
;; Referral System - User Growth & Rewards Program
;; ============================================================================
;; Incentivizes user growth through a multi-tier referral program.
;; Users earn rewards for referring new users who perform bridge operations.
;; Supports multi-level referrals, campaigns, and leaderboard tracking.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u16001))
(define-constant ERR-INVALID-AMOUNT (err u16002))
(define-constant ERR-ALREADY-REGISTERED (err u16003))
(define-constant ERR-NOT-REGISTERED (err u16004))
(define-constant ERR-SELF-REFERRAL (err u16005))
(define-constant ERR-INVALID-CODE (err u16006))
(define-constant ERR-CODE-EXISTS (err u16007))
(define-constant ERR-NO-REWARDS (err u16008))
(define-constant ERR-CAMPAIGN-NOT-FOUND (err u16009))
(define-constant ERR-CAMPAIGN-EXPIRED (err u16010))
(define-constant ERR-PROGRAM-PAUSED (err u16011))
(define-constant ERR-MAX-LEVEL-REACHED (err u16012))
(define-constant ERR-COOLDOWN-ACTIVE (err u16013))

;; Referral Tiers
(define-constant TIER-BRONZE u0)
(define-constant TIER-SILVER u1)
(define-constant TIER-GOLD u2)
(define-constant TIER-PLATINUM u3)
(define-constant TIER-DIAMOND u4)

;; Parameters
(define-constant BPS-DENOMINATOR u10000)
(define-constant MAX-REFERRAL-LEVELS u3) ;; up to 3 levels deep

;; Data Variables
(define-data-var total-referrers uint u0)
(define-data-var total-referrals uint u0)
(define-data-var total-rewards-distributed uint u0)
(define-data-var total-volume-referred uint u0)
(define-data-var base-referral-rate uint u300) ;; 3% base referral reward
(define-data-var level2-rate uint u100) ;; 1% for level 2
(define-data-var level3-rate uint u50) ;; 0.5% for level 3
(define-data-var min-operation-amount uint u1000000) ;; minimum bridge amount for referral credit
(define-data-var reward-claim-cooldown uint u144) ;; ~1 day
(define-data-var campaign-count uint u0)
(define-data-var program-paused bool false)

;; Referrer profiles
(define-map referrers
  principal
  {
    referral-code: (buff 16),
    referred-by: (optional principal),
    tier: uint,
    total-referrals: uint,
    active-referrals: uint,
    total-volume: uint,
    total-earned: uint,
    pending-rewards: uint,
    last-claim: uint,
    registered-at: uint,
    level2-referrals: uint,
    level3-referrals: uint
  }
)

;; Referral code to principal mapping
(define-map code-to-referrer (buff 16) principal)

;; Individual referral records
(define-map referral-records
  { referrer: principal, referred: principal }
  {
    volume-generated: uint,
    rewards-earned: uint,
    level: uint,
    is-active: bool,
    referred-at: uint
  }
)

;; Tier configurations
(define-map tier-config
  uint ;; tier
  {
    name: (string-ascii 16),
    min-referrals: uint,
    min-volume: uint,
    bonus-rate-bps: uint, ;; additional bonus on top of base rate
    max-levels: uint
  }
)

;; Active campaigns (bonus reward periods)
(define-map campaigns
  uint ;; campaign-id
  {
    name: (string-ascii 50),
    bonus-multiplier: uint, ;; in bps (10000 = 1x)
    start-block: uint,
    end-block: uint,
    total-rewards: uint,
    max-rewards: uint,
    is-active: bool
  }
)

;; Leaderboard tracking (per epoch)
(define-map epoch-leaderboard
  { epoch: uint, referrer: principal }
  {
    referrals: uint,
    volume: uint,
    rewards: uint
  }
)

;; Initialize tiers
(map-set tier-config TIER-BRONZE
  { name: "Bronze", min-referrals: u0, min-volume: u0, bonus-rate-bps: u0, max-levels: u1 })
(map-set tier-config TIER-SILVER
  { name: "Silver", min-referrals: u5, min-volume: u10000000000, bonus-rate-bps: u50, max-levels: u2 })
(map-set tier-config TIER-GOLD
  { name: "Gold", min-referrals: u20, min-volume: u100000000000, bonus-rate-bps: u100, max-levels: u2 })
(map-set tier-config TIER-PLATINUM
  { name: "Platinum", min-referrals: u50, min-volume: u500000000000, bonus-rate-bps: u200, max-levels: u3 })
(map-set tier-config TIER-DIAMOND
  { name: "Diamond", min-referrals: u100, min-volume: u2000000000000, bonus-rate-bps: u500, max-levels: u3 })

;; ============================================================================
;; Registration
;; ============================================================================

(define-public (register-referrer (referral-code (buff 16)))
  (begin
    (asserts! (not (var-get program-paused)) ERR-PROGRAM-PAUSED)
    (asserts! (is-none (map-get? referrers tx-sender)) ERR-ALREADY-REGISTERED)
    (asserts! (> (len referral-code) u0) ERR-INVALID-CODE)
    (asserts! (is-none (map-get? code-to-referrer referral-code)) ERR-CODE-EXISTS)

    (map-set referrers tx-sender {
      referral-code: referral-code,
      referred-by: none,
      tier: TIER-BRONZE,
      total-referrals: u0,
      active-referrals: u0,
      total-volume: u0,
      total-earned: u0,
      pending-rewards: u0,
      last-claim: u0,
      registered-at: block-height,
      level2-referrals: u0,
      level3-referrals: u0
    })

    (map-set code-to-referrer referral-code tx-sender)
    (var-set total-referrers (+ (var-get total-referrers) u1))

    (print {
      event: "referrer-registered",
      referrer: tx-sender,
      code: referral-code
    })

    (ok true)
  )
)

(define-public (register-with-referral (referral-code (buff 16)) (own-code (buff 16)))
  (let
    (
      (referrer-addr (unwrap! (map-get? code-to-referrer referral-code) ERR-INVALID-CODE))
      (referrer-info (unwrap! (map-get? referrers referrer-addr) ERR-NOT-REGISTERED))
    )
    (asserts! (not (var-get program-paused)) ERR-PROGRAM-PAUSED)
    (asserts! (is-none (map-get? referrers tx-sender)) ERR-ALREADY-REGISTERED)
    (asserts! (not (is-eq referrer-addr tx-sender)) ERR-SELF-REFERRAL)
    (asserts! (> (len own-code) u0) ERR-INVALID-CODE)
    (asserts! (is-none (map-get? code-to-referrer own-code)) ERR-CODE-EXISTS)

    ;; Register the new user
    (map-set referrers tx-sender {
      referral-code: own-code,
      referred-by: (some referrer-addr),
      tier: TIER-BRONZE,
      total-referrals: u0,
      active-referrals: u0,
      total-volume: u0,
      total-earned: u0,
      pending-rewards: u0,
      last-claim: u0,
      registered-at: block-height,
      level2-referrals: u0,
      level3-referrals: u0
    })

    (map-set code-to-referrer own-code tx-sender)

    ;; Update referrer's counts
    (map-set referrers referrer-addr
      (merge referrer-info {
        total-referrals: (+ (get total-referrals referrer-info) u1),
        active-referrals: (+ (get active-referrals referrer-info) u1)
      }))

    ;; Create referral record
    (map-set referral-records { referrer: referrer-addr, referred: tx-sender }
      { volume-generated: u0, rewards-earned: u0, level: u1, is-active: true, referred-at: block-height })

    ;; Handle level 2 referral
    (match (get referred-by referrer-info)
      level2-referrer
        (begin
          (match (map-get? referrers level2-referrer)
            l2-info
              (begin
                (map-set referrers level2-referrer
                  (merge l2-info { level2-referrals: (+ (get level2-referrals l2-info) u1) }))
                (map-set referral-records { referrer: level2-referrer, referred: tx-sender }
                  { volume-generated: u0, rewards-earned: u0, level: u2, is-active: true, referred-at: block-height })

                ;; Handle level 3
                (match (get referred-by l2-info)
                  level3-referrer
                    (match (map-get? referrers level3-referrer)
                      l3-info
                        (begin
                          (map-set referrers level3-referrer
                            (merge l3-info { level3-referrals: (+ (get level3-referrals l3-info) u1) }))
                          (map-set referral-records { referrer: level3-referrer, referred: tx-sender }
                            { volume-generated: u0, rewards-earned: u0, level: u3, is-active: true, referred-at: block-height })
                          true)
                      true)
                  true)
              )
            true)
        )
      true
    )

    (var-set total-referrers (+ (var-get total-referrers) u1))
    (var-set total-referrals (+ (var-get total-referrals) u1))

    (print {
      event: "registered-with-referral",
      user: tx-sender,
      referrer: referrer-addr,
      code: own-code
    })

    (ok true)
  )
)

;; ============================================================================
;; Referral Rewards
;; ============================================================================

(define-public (record-referral-volume (user principal) (volume uint))
  (let
    (
      (user-info (unwrap! (map-get? referrers user) ERR-NOT-REGISTERED))
    )
    (asserts! (or (is-eq tx-sender CONTRACT-OWNER)
                  (default-to false (map-get? referrers tx-sender)))
              ERR-NOT-AUTHORIZED)
    (asserts! (>= volume (var-get min-operation-amount)) ERR-INVALID-AMOUNT)

    ;; Credit level 1 referrer
    (match (get referred-by user-info)
      referrer-addr
        (let
          (
            (referrer-info (unwrap! (map-get? referrers referrer-addr) ERR-NOT-REGISTERED))
            (tier-info (unwrap-panic (map-get? tier-config (get tier referrer-info))))
            (base-reward (/ (* volume (var-get base-referral-rate)) BPS-DENOMINATOR))
            (bonus-reward (/ (* base-reward (get bonus-rate-bps tier-info)) BPS-DENOMINATOR))
            (campaign-bonus (get-active-campaign-bonus))
            (total-reward (/ (* (+ base-reward bonus-reward) campaign-bonus) BPS-DENOMINATOR))
          )
          ;; Update referrer
          (map-set referrers referrer-addr
            (merge referrer-info {
              total-volume: (+ (get total-volume referrer-info) volume),
              pending-rewards: (+ (get pending-rewards referrer-info) total-reward)
            }))

          ;; Update referral record
          (match (map-get? referral-records { referrer: referrer-addr, referred: user })
            record
              (map-set referral-records { referrer: referrer-addr, referred: user }
                (merge record {
                  volume-generated: (+ (get volume-generated record) volume),
                  rewards-earned: (+ (get rewards-earned record) total-reward)
                }))
            true
          )

          ;; Level 2 rewards
          (match (get referred-by referrer-info)
            l2-referrer
              (let
                (
                  (l2-info (unwrap! (map-get? referrers l2-referrer) ERR-NOT-REGISTERED))
                  (l2-tier (unwrap-panic (map-get? tier-config (get tier l2-info))))
                  (l2-reward (if (>= (get max-levels l2-tier) u2)
                    (/ (* volume (var-get level2-rate)) BPS-DENOMINATOR)
                    u0))
                )
                (if (> l2-reward u0)
                  (map-set referrers l2-referrer
                    (merge l2-info {
                      pending-rewards: (+ (get pending-rewards l2-info) l2-reward)
                    }))
                  true
                )

                ;; Level 3 rewards
                (match (get referred-by l2-info)
                  l3-referrer
                    (let
                      (
                        (l3-info (unwrap! (map-get? referrers l3-referrer) ERR-NOT-REGISTERED))
                        (l3-tier (unwrap-panic (map-get? tier-config (get tier l3-info))))
                        (l3-reward (if (>= (get max-levels l3-tier) u3)
                          (/ (* volume (var-get level3-rate)) BPS-DENOMINATOR)
                          u0))
                      )
                      (if (> l3-reward u0)
                        (map-set referrers l3-referrer
                          (merge l3-info {
                            pending-rewards: (+ (get pending-rewards l3-info) l3-reward)
                          }))
                        true
                      )
                      (ok true)
                    )
                  (ok true)
                )
              )
            (ok true)
          )
        )
      (ok true)
    )
  )
)

(define-public (claim-referral-rewards)
  (let
    (
      (referrer-info (unwrap! (map-get? referrers tx-sender) ERR-NOT-REGISTERED))
      (pending (get pending-rewards referrer-info))
    )
    (asserts! (> pending u0) ERR-NO-REWARDS)
    (asserts! (>= block-height (+ (get last-claim referrer-info) (var-get reward-claim-cooldown)))
              ERR-COOLDOWN-ACTIVE)

    (map-set referrers tx-sender
      (merge referrer-info {
        pending-rewards: u0,
        total-earned: (+ (get total-earned referrer-info) pending),
        last-claim: block-height
      }))

    (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) pending))

    (print {
      event: "referral-rewards-claimed",
      referrer: tx-sender,
      amount: pending
    })

    (ok pending)
  )
)

;; ============================================================================
;; Tier Management
;; ============================================================================

(define-public (upgrade-tier)
  (let
    (
      (referrer-info (unwrap! (map-get? referrers tx-sender) ERR-NOT-REGISTERED))
      (current-tier (get tier referrer-info))
      (new-tier (determine-tier (get total-referrals referrer-info) (get total-volume referrer-info)))
    )
    (asserts! (> new-tier current-tier) ERR-INVALID-AMOUNT)

    (map-set referrers tx-sender
      (merge referrer-info { tier: new-tier }))

    (print {
      event: "tier-upgraded",
      referrer: tx-sender,
      old-tier: current-tier,
      new-tier: new-tier
    })

    (ok new-tier)
  )
)

;; ============================================================================
;; Campaign Management
;; ============================================================================

(define-public (create-campaign
    (name (string-ascii 50))
    (bonus-multiplier uint)
    (duration-blocks uint)
    (max-rewards uint)
  )
  (let
    (
      (campaign-id (var-get campaign-count))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> bonus-multiplier BPS-DENOMINATOR) ERR-INVALID-AMOUNT) ;; must be > 1x

    (map-set campaigns campaign-id {
      name: name,
      bonus-multiplier: bonus-multiplier,
      start-block: block-height,
      end-block: (+ block-height duration-blocks),
      total-rewards: u0,
      max-rewards: max-rewards,
      is-active: true
    })

    (var-set campaign-count (+ campaign-id u1))

    (print {
      event: "campaign-created",
      campaign-id: campaign-id,
      name: name,
      bonus: bonus-multiplier,
      duration: duration-blocks
    })

    (ok campaign-id)
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-base-referral-rate (rate uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= rate u1000) ERR-INVALID-AMOUNT) ;; max 10%
    (ok (var-set base-referral-rate rate))
  )
)

(define-public (set-min-operation-amount (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set min-operation-amount amount))
  )
)

(define-public (toggle-program-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set program-paused (not (var-get program-paused))))
  )
)

(define-public (end-campaign (campaign-id uint))
  (let
    ((campaign (unwrap! (map-get? campaigns campaign-id) ERR-CAMPAIGN-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set campaigns campaign-id
      (merge campaign { is-active: false, end-block: block-height })))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-referrer-info (referrer principal))
  (map-get? referrers referrer)
)

(define-read-only (get-referrer-by-code (code (buff 16)))
  (map-get? code-to-referrer code)
)

(define-read-only (get-referral-record (referrer principal) (referred principal))
  (map-get? referral-records { referrer: referrer, referred: referred })
)

(define-read-only (get-tier-info (tier uint))
  (map-get? tier-config tier)
)

(define-read-only (get-campaign (campaign-id uint))
  (map-get? campaigns campaign-id)
)

(define-read-only (determine-tier (referrals uint) (volume uint))
  (if (and (>= referrals u100) (>= volume u2000000000000))
    TIER-DIAMOND
    (if (and (>= referrals u50) (>= volume u500000000000))
      TIER-PLATINUM
      (if (and (>= referrals u20) (>= volume u100000000000))
        TIER-GOLD
        (if (and (>= referrals u5) (>= volume u10000000000))
          TIER-SILVER
          TIER-BRONZE))))
)

(define-read-only (get-active-campaign-bonus)
  ;; Returns the highest active campaign multiplier
  (let
    (
      (count (var-get campaign-count))
    )
    ;; Simple check for campaign 0 (latest active)
    (if (> count u0)
      (match (map-get? campaigns (- count u1))
        campaign
          (if (and (get is-active campaign) (<= block-height (get end-block campaign)))
            (get bonus-multiplier campaign)
            BPS-DENOMINATOR)
        BPS-DENOMINATOR)
      BPS-DENOMINATOR)
  )
)

(define-read-only (get-referral-stats)
  {
    total-referrers: (var-get total-referrers),
    total-referrals: (var-get total-referrals),
    total-rewards-distributed: (var-get total-rewards-distributed),
    total-volume-referred: (var-get total-volume-referred),
    base-rate: (var-get base-referral-rate),
    level2-rate: (var-get level2-rate),
    level3-rate: (var-get level3-rate),
    active-campaigns: (var-get campaign-count),
    is-paused: (var-get program-paused)
  }
)

(define-read-only (get-pending-rewards (referrer principal))
  (match (map-get? referrers referrer)
    info (get pending-rewards info)
    u0)
)

(define-read-only (get-epoch-stats (epoch uint) (referrer principal))
  (map-get? epoch-leaderboard { epoch: epoch, referrer: referrer })
)
