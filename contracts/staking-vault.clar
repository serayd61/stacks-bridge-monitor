;; ============================================================================
;; Staking Vault - Token Staking & Rewards
;; ============================================================================
;; Users stake BRIDGE tokens to earn protocol fees and governance power.
;; Supports flexible and locked staking with different reward multipliers.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u5001))
(define-constant ERR-INSUFFICIENT-BALANCE (err u5002))
(define-constant ERR-NO-STAKE (err u5003))
(define-constant ERR-LOCK-NOT-EXPIRED (err u5004))
(define-constant ERR-INVALID-AMOUNT (err u5005))
(define-constant ERR-INVALID-LOCK-PERIOD (err u5006))
(define-constant ERR-STAKING-PAUSED (err u5007))
(define-constant ERR-ALREADY-STAKING (err u5008))
(define-constant ERR-NO-REWARDS (err u5009))

;; Lock Period Multipliers (in basis points, 100 = 1x)
(define-constant FLEX-MULTIPLIER u100) ;; 1x
(define-constant SHORT-LOCK-MULTIPLIER u150) ;; 1.5x (30 days)
(define-constant MED-LOCK-MULTIPLIER u200) ;; 2x (90 days)
(define-constant LONG-LOCK-MULTIPLIER u300) ;; 3x (180 days)

;; Lock periods in blocks (~10 min per block)
(define-constant LOCK-30-DAYS u4320)
(define-constant LOCK-90-DAYS u12960)
(define-constant LOCK-180-DAYS u25920)

;; Data Variables
(define-data-var total-staked uint u0)
(define-data-var total-rewards-distributed uint u0)
(define-data-var reward-per-block uint u1000) ;; rewards per block
(define-data-var staking-paused bool false)
(define-data-var total-stakers uint u0)
(define-data-var last-reward-block uint u0)
(define-data-var accumulated-reward-per-share uint u0)
(define-data-var precision-factor uint u1000000000000) ;; 1e12

;; Staker Info
(define-map stakers
  principal
  {
    amount: uint,
    lock-until: uint,
    lock-type: uint, ;; 0=flex, 1=30d, 2=90d, 3=180d
    multiplier: uint,
    reward-debt: uint,
    pending-rewards: uint,
    staked-at: uint,
    last-claim: uint
  }
)

;; Staking snapshots for governance
(define-map staking-snapshots
  { staker: principal, block: uint }
  uint
)

;; ============================================================================
;; Staking Functions
;; ============================================================================

(define-public (stake (amount uint) (lock-type uint))
  (let
    (
      (existing (map-get? stakers tx-sender))
      (multiplier (get-multiplier lock-type))
      (lock-period (get-lock-period lock-type))
    )
    (asserts! (not (var-get staking-paused)) ERR-STAKING-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= lock-type u3) ERR-INVALID-LOCK-PERIOD)
    (asserts! (is-none existing) ERR-ALREADY-STAKING)

    ;; Update reward accumulator
    (update-rewards)

    ;; Record stake
    (map-set stakers tx-sender {
      amount: amount,
      lock-until: (+ block-height lock-period),
      lock-type: lock-type,
      multiplier: multiplier,
      reward-debt: (/ (* amount (var-get accumulated-reward-per-share)) (var-get precision-factor)),
      pending-rewards: u0,
      staked-at: block-height,
      last-claim: block-height
    })

    ;; Update totals
    (var-set total-staked (+ (var-get total-staked) amount))
    (var-set total-stakers (+ (var-get total-stakers) u1))

    ;; Snapshot for governance
    (map-set staking-snapshots
      { staker: tx-sender, block: block-height }
      amount)

    (print {
      event: "staked",
      staker: tx-sender,
      amount: amount,
      lock-type: lock-type,
      multiplier: multiplier,
      lock-until: (+ block-height lock-period)
    })

    (ok true)
  )
)

(define-public (unstake)
  (let
    (
      (staker-info (unwrap! (map-get? stakers tx-sender) ERR-NO-STAKE))
      (amount (get amount staker-info))
    )
    ;; Check lock period
    (asserts! (>= block-height (get lock-until staker-info)) ERR-LOCK-NOT-EXPIRED)

    ;; Update rewards before unstaking
    (update-rewards)

    ;; Calculate pending rewards
    (let
      (
        (pending (calculate-pending-rewards tx-sender))
      )
      ;; Remove stake
      (map-delete stakers tx-sender)

      ;; Update totals
      (var-set total-staked (- (var-get total-staked) amount))
      (var-set total-stakers (- (var-get total-stakers) u1))

      (print {
        event: "unstaked",
        staker: tx-sender,
        amount: amount,
        rewards: pending
      })

      (ok { amount: amount, rewards: pending })
    )
  )
)

;; ============================================================================
;; Reward Functions
;; ============================================================================

(define-public (claim-rewards)
  (let
    (
      (staker-info (unwrap! (map-get? stakers tx-sender) ERR-NO-STAKE))
      (pending (calculate-pending-rewards tx-sender))
    )
    (asserts! (> pending u0) ERR-NO-REWARDS)

    ;; Update rewards
    (update-rewards)

    ;; Update staker's reward debt
    (map-set stakers tx-sender
      (merge staker-info {
        reward-debt: (/ (* (get amount staker-info) (var-get accumulated-reward-per-share)) (var-get precision-factor)),
        pending-rewards: u0,
        last-claim: block-height
      }))

    (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) pending))

    (print {
      event: "rewards-claimed",
      staker: tx-sender,
      amount: pending,
      block: block-height
    })

    (ok pending)
  )
)

;; ============================================================================
;; Internal Functions
;; ============================================================================

(define-private (update-rewards)
  (let
    (
      (total (var-get total-staked))
    )
    (if (and (> total u0) (> block-height (var-get last-reward-block)))
      (let
        (
          (blocks-elapsed (- block-height (var-get last-reward-block)))
          (reward (* blocks-elapsed (var-get reward-per-block)))
          (reward-per-share (+ (var-get accumulated-reward-per-share)
                               (/ (* reward (var-get precision-factor)) total)))
        )
        (var-set accumulated-reward-per-share reward-per-share)
        (var-set last-reward-block block-height)
        true
      )
      (begin
        (var-set last-reward-block block-height)
        true
      )
    )
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-staker-info (staker principal))
  (map-get? stakers staker)
)

(define-read-only (calculate-pending-rewards (staker principal))
  (match (map-get? stakers staker)
    staker-info
      (let
        (
          (amount (get amount staker-info))
          (debt (get reward-debt staker-info))
          (multiplier (get multiplier staker-info))
          (base-reward (- (/ (* amount (var-get accumulated-reward-per-share)) (var-get precision-factor)) debt))
        )
        (/ (* base-reward multiplier) u100)
      )
    u0
  )
)

(define-read-only (get-staking-stats)
  {
    total-staked: (var-get total-staked),
    total-stakers: (var-get total-stakers),
    total-rewards-distributed: (var-get total-rewards-distributed),
    reward-per-block: (var-get reward-per-block),
    is-paused: (var-get staking-paused)
  }
)

(define-read-only (get-multiplier (lock-type uint))
  (if (is-eq lock-type u0) FLEX-MULTIPLIER
    (if (is-eq lock-type u1) SHORT-LOCK-MULTIPLIER
      (if (is-eq lock-type u2) MED-LOCK-MULTIPLIER
        LONG-LOCK-MULTIPLIER)))
)

(define-read-only (get-lock-period (lock-type uint))
  (if (is-eq lock-type u0) u0
    (if (is-eq lock-type u1) LOCK-30-DAYS
      (if (is-eq lock-type u2) LOCK-90-DAYS
        LOCK-180-DAYS)))
)

(define-read-only (get-apy-estimate)
  (let
    (
      (total (var-get total-staked))
      (yearly-blocks u52560) ;; ~365 days
    )
    (if (> total u0)
      (/ (* (var-get reward-per-block) yearly-blocks u100) total)
      u0
    )
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-reward-per-block (reward uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (update-rewards)
    (ok (var-set reward-per-block reward))
  )
)

(define-public (toggle-staking-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set staking-paused (not (var-get staking-paused))))
  )
)
