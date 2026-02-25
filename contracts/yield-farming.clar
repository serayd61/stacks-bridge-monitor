;; ============================================================================
;; Yield Farming - Multi-Pool Farming Rewards
;; ============================================================================
;; Incentivizes liquidity provision through farming rewards.
;; Supports multiple farming pools with configurable allocation points,
;; harvest lockups, and bonus reward periods.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u13001))
(define-constant ERR-INVALID-AMOUNT (err u13002))
(define-constant ERR-FARM-NOT-FOUND (err u13003))
(define-constant ERR-FARM-PAUSED (err u13004))
(define-constant ERR-NO-DEPOSIT (err u13005))
(define-constant ERR-HARVEST-LOCKUP (err u13006))
(define-constant ERR-FARM-EXISTS (err u13007))
(define-constant ERR-NO-REWARDS (err u13008))
(define-constant ERR-BONUS-ENDED (err u13009))
(define-constant ERR-WITHDRAW-LOCKED (err u13010))
(define-constant ERR-MAX-FARMS-REACHED (err u13011))

;; Parameters
(define-constant MAX-FARMS u20)
(define-constant PRECISION u1000000000000) ;; 1e12

;; Data Variables
(define-data-var farm-count uint u0)
(define-data-var total-alloc-points uint u0)
(define-data-var reward-per-block uint u5000000) ;; 5 tokens per block
(define-data-var bonus-multiplier uint u3) ;; 3x during bonus period
(define-data-var bonus-end-block uint u0)
(define-data-var start-block uint block-height)
(define-data-var total-rewards-distributed uint u0)
(define-data-var farming-paused bool false)

;; Farm pools
(define-map farms
  uint ;; farm-id
  {
    name: (string-ascii 32),
    alloc-point: uint,
    total-deposited: uint,
    acc-reward-per-share: uint,
    last-reward-block: uint,
    deposit-fee-bps: uint,     ;; deposit fee in bps
    harvest-lockup: uint,      ;; blocks before harvest allowed
    withdraw-lockup: uint,     ;; blocks before withdraw allowed
    total-depositors: uint,
    is-active: bool,
    created-at: uint
  }
)

;; User deposits per farm
(define-map user-deposits
  { farm-id: uint, user: principal }
  {
    amount: uint,
    reward-debt: uint,
    pending-rewards: uint,
    deposited-at: uint,
    last-harvest: uint,
    boost-multiplier: uint ;; user-specific boost in bps (10000 = 1x)
  }
)

;; Boost tiers based on total deposit amount
(define-map boost-tiers
  uint ;; tier
  {
    min-deposit: uint,
    multiplier-bps: uint,
    name: (string-ascii 16)
  }
)

;; User total deposits across all farms
(define-map user-total-deposited principal uint)

;; Initialize boost tiers
(map-set boost-tiers u0 { min-deposit: u0, multiplier-bps: u10000, name: "Standard" })
(map-set boost-tiers u1 { min-deposit: u10000000000, multiplier-bps: u12000, name: "Bronze Farmer" })
(map-set boost-tiers u2 { min-deposit: u50000000000, multiplier-bps: u15000, name: "Silver Farmer" })
(map-set boost-tiers u3 { min-deposit: u200000000000, multiplier-bps: u20000, name: "Gold Farmer" })
(map-set boost-tiers u4 { min-deposit: u1000000000000, multiplier-bps: u30000, name: "Diamond Farmer" })

;; ============================================================================
;; Farm Management
;; ============================================================================

(define-public (add-farm
    (name (string-ascii 32))
    (alloc-point uint)
    (deposit-fee-bps uint)
    (harvest-lockup uint)
    (withdraw-lockup uint)
  )
  (let
    (
      (farm-id (var-get farm-count))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (< farm-id MAX-FARMS) ERR-MAX-FARMS-REACHED)
    (asserts! (<= deposit-fee-bps u1000) ERR-INVALID-AMOUNT) ;; max 10% deposit fee

    (map-set farms farm-id {
      name: name,
      alloc-point: alloc-point,
      total-deposited: u0,
      acc-reward-per-share: u0,
      last-reward-block: block-height,
      deposit-fee-bps: deposit-fee-bps,
      harvest-lockup: harvest-lockup,
      withdraw-lockup: withdraw-lockup,
      total-depositors: u0,
      is-active: true,
      created-at: block-height
    })

    (var-set total-alloc-points (+ (var-get total-alloc-points) alloc-point))
    (var-set farm-count (+ farm-id u1))

    (print {
      event: "farm-added",
      farm-id: farm-id,
      name: name,
      alloc-point: alloc-point,
      deposit-fee: deposit-fee-bps
    })

    (ok farm-id)
  )
)

(define-public (update-farm-alloc (farm-id uint) (new-alloc-point uint))
  (let
    (
      (farm (unwrap! (map-get? farms farm-id) ERR-FARM-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)

    ;; Update total alloc points
    (var-set total-alloc-points
      (+ (- (var-get total-alloc-points) (get alloc-point farm)) new-alloc-point))

    (map-set farms farm-id
      (merge farm { alloc-point: new-alloc-point }))

    (print {
      event: "farm-alloc-updated",
      farm-id: farm-id,
      old-alloc: (get alloc-point farm),
      new-alloc: new-alloc-point
    })

    (ok true)
  )
)

;; ============================================================================
;; Deposit & Withdraw
;; ============================================================================

(define-public (deposit (farm-id uint) (amount uint))
  (let
    (
      (farm (unwrap! (map-get? farms farm-id) ERR-FARM-NOT-FOUND))
      (existing (map-get? user-deposits { farm-id: farm-id, user: tx-sender }))
      (deposit-fee (/ (* amount (get deposit-fee-bps farm)) u10000))
      (net-amount (- amount deposit-fee))
      (user-total (default-to u0 (map-get? user-total-deposited tx-sender)))
      (boost (get-user-boost (+ user-total net-amount)))
    )
    (asserts! (not (var-get farming-paused)) ERR-FARM-PAUSED)
    (asserts! (get is-active farm) ERR-FARM-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    ;; Update farm rewards
    (let
      ((updated-farm (update-farm-rewards farm-id)))

      ;; Handle existing deposit
      (match existing
        prev-deposit
          (let
            (
              (pending (calculate-user-pending farm-id tx-sender))
            )
            (map-set user-deposits { farm-id: farm-id, user: tx-sender }
              (merge prev-deposit {
                amount: (+ (get amount prev-deposit) net-amount),
                reward-debt: (/ (* (+ (get amount prev-deposit) net-amount)
                                    (get acc-reward-per-share updated-farm)) PRECISION),
                pending-rewards: (+ (get pending-rewards prev-deposit) pending),
                boost-multiplier: boost
              }))
          )
        ;; New deposit
        (begin
          (map-set user-deposits { farm-id: farm-id, user: tx-sender } {
            amount: net-amount,
            reward-debt: (/ (* net-amount (get acc-reward-per-share updated-farm)) PRECISION),
            pending-rewards: u0,
            deposited-at: block-height,
            last-harvest: block-height,
            boost-multiplier: boost
          })
          (map-set farms farm-id
            (merge updated-farm { total-depositors: (+ (get total-depositors updated-farm) u1) }))
        )
      )

      ;; Update farm total
      (map-set farms farm-id
        (merge updated-farm {
          total-deposited: (+ (get total-deposited updated-farm) net-amount)
        }))

      ;; Update user total
      (map-set user-total-deposited tx-sender (+ user-total net-amount))

      (print {
        event: "deposited",
        farm-id: farm-id,
        user: tx-sender,
        amount: net-amount,
        fee: deposit-fee,
        boost: boost
      })

      (ok net-amount)
    )
  )
)

(define-public (withdraw (farm-id uint) (amount uint))
  (let
    (
      (farm (unwrap! (map-get? farms farm-id) ERR-FARM-NOT-FOUND))
      (user-dep (unwrap! (map-get? user-deposits { farm-id: farm-id, user: tx-sender }) ERR-NO-DEPOSIT))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (get amount user-dep)) ERR-INVALID-AMOUNT)
    (asserts! (>= block-height (+ (get deposited-at user-dep) (get withdraw-lockup farm)))
              ERR-WITHDRAW-LOCKED)

    ;; Update farm rewards
    (let
      (
        (updated-farm (update-farm-rewards farm-id))
        (pending (calculate-user-pending farm-id tx-sender))
        (user-total (default-to u0 (map-get? user-total-deposited tx-sender)))
      )

      ;; Update user deposit
      (if (is-eq amount (get amount user-dep))
        ;; Full withdrawal
        (begin
          (map-delete user-deposits { farm-id: farm-id, user: tx-sender })
          (map-set farms farm-id
            (merge updated-farm {
              total-deposited: (- (get total-deposited updated-farm) amount),
              total-depositors: (- (get total-depositors updated-farm) u1)
            }))
        )
        ;; Partial withdrawal
        (begin
          (map-set user-deposits { farm-id: farm-id, user: tx-sender }
            (merge user-dep {
              amount: (- (get amount user-dep) amount),
              reward-debt: (/ (* (- (get amount user-dep) amount)
                                  (get acc-reward-per-share updated-farm)) PRECISION),
              pending-rewards: (+ (get pending-rewards user-dep) pending)
            }))
          (map-set farms farm-id
            (merge updated-farm {
              total-deposited: (- (get total-deposited updated-farm) amount)
            }))
        )
      )

      ;; Update user total
      (map-set user-total-deposited tx-sender
        (if (> user-total amount) (- user-total amount) u0))

      (print {
        event: "withdrawn",
        farm-id: farm-id,
        user: tx-sender,
        amount: amount,
        pending-rewards: pending
      })

      (ok { amount: amount, pending-rewards: pending })
    )
  )
)

;; ============================================================================
;; Harvest
;; ============================================================================

(define-public (harvest (farm-id uint))
  (let
    (
      (farm (unwrap! (map-get? farms farm-id) ERR-FARM-NOT-FOUND))
      (user-dep (unwrap! (map-get? user-deposits { farm-id: farm-id, user: tx-sender }) ERR-NO-DEPOSIT))
      (updated-farm (update-farm-rewards farm-id))
      (pending (calculate-user-pending farm-id tx-sender))
      (total-pending (+ pending (get pending-rewards user-dep)))
      (boosted-reward (/ (* total-pending (get boost-multiplier user-dep)) u10000))
    )
    (asserts! (>= block-height (+ (get last-harvest user-dep) (get harvest-lockup farm)))
              ERR-HARVEST-LOCKUP)
    (asserts! (> boosted-reward u0) ERR-NO-REWARDS)

    ;; Update user deposit
    (map-set user-deposits { farm-id: farm-id, user: tx-sender }
      (merge user-dep {
        reward-debt: (/ (* (get amount user-dep)
                            (get acc-reward-per-share updated-farm)) PRECISION),
        pending-rewards: u0,
        last-harvest: block-height
      }))

    (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) boosted-reward))

    (print {
      event: "harvested",
      farm-id: farm-id,
      user: tx-sender,
      base-reward: total-pending,
      boosted-reward: boosted-reward,
      boost: (get boost-multiplier user-dep)
    })

    (ok boosted-reward)
  )
)

;; ============================================================================
;; Internal Functions
;; ============================================================================

(define-private (update-farm-rewards (farm-id uint))
  (let
    (
      (farm (unwrap-panic (map-get? farms farm-id)))
    )
    (if (and (> block-height (get last-reward-block farm))
             (> (get total-deposited farm) u0))
      (let
        (
          (blocks (- block-height (get last-reward-block farm)))
          (multiplier (get-block-multiplier (get last-reward-block farm) block-height))
          (reward (/ (* blocks (var-get reward-per-block) (get alloc-point farm) multiplier)
                     (var-get total-alloc-points)))
          (new-acc (+ (get acc-reward-per-share farm)
                      (/ (* reward PRECISION) (get total-deposited farm))))
        )
        (map-set farms farm-id
          (merge farm {
            acc-reward-per-share: new-acc,
            last-reward-block: block-height
          }))
        (merge farm { acc-reward-per-share: new-acc, last-reward-block: block-height })
      )
      (begin
        (map-set farms farm-id (merge farm { last-reward-block: block-height }))
        (merge farm { last-reward-block: block-height })
      )
    )
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-reward-per-block (reward uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set reward-per-block reward))
  )
)

(define-public (set-bonus-period (end-block uint) (multiplier uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> end-block block-height) ERR-BONUS-ENDED)
    (var-set bonus-end-block end-block)
    (ok (var-set bonus-multiplier multiplier))
  )
)

(define-public (toggle-farm-status (farm-id uint))
  (let
    ((farm (unwrap! (map-get? farms farm-id) ERR-FARM-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set farms farm-id
      (merge farm { is-active: (not (get is-active farm)) })))
  )
)

(define-public (toggle-farming-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set farming-paused (not (var-get farming-paused))))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-farm-info (farm-id uint))
  (map-get? farms farm-id)
)

(define-read-only (get-user-deposit (farm-id uint) (user principal))
  (map-get? user-deposits { farm-id: farm-id, user: user })
)

(define-read-only (calculate-user-pending (farm-id uint) (user principal))
  (match (map-get? user-deposits { farm-id: farm-id, user: user })
    dep
      (match (map-get? farms farm-id)
        farm
          (let
            (
              (acc (get acc-reward-per-share farm))
            )
            (- (/ (* (get amount dep) acc) PRECISION) (get reward-debt dep))
          )
        u0)
    u0)
)

(define-read-only (get-block-multiplier (from uint) (to uint))
  (let
    ((bonus-end (var-get bonus-end-block)))
    (if (<= to bonus-end)
      (var-get bonus-multiplier)
      (if (>= from bonus-end)
        u1
        ;; Weighted average for partial bonus period
        (let
          (
            (bonus-blocks (- bonus-end from))
            (normal-blocks (- to bonus-end))
            (total-blocks (- to from))
          )
          (/ (+ (* bonus-blocks (var-get bonus-multiplier)) normal-blocks) total-blocks)
        )
      )
    )
  )
)

(define-read-only (get-user-boost (total-deposited uint))
  (if (>= total-deposited u1000000000000)
    (get multiplier-bps (unwrap-panic (map-get? boost-tiers u4)))
    (if (>= total-deposited u200000000000)
      (get multiplier-bps (unwrap-panic (map-get? boost-tiers u3)))
      (if (>= total-deposited u50000000000)
        (get multiplier-bps (unwrap-panic (map-get? boost-tiers u2)))
        (if (>= total-deposited u10000000000)
          (get multiplier-bps (unwrap-panic (map-get? boost-tiers u1)))
          (get multiplier-bps (unwrap-panic (map-get? boost-tiers u0)))))))
)

(define-read-only (get-farming-stats)
  {
    farm-count: (var-get farm-count),
    total-alloc-points: (var-get total-alloc-points),
    reward-per-block: (var-get reward-per-block),
    bonus-multiplier: (var-get bonus-multiplier),
    bonus-end-block: (var-get bonus-end-block),
    total-rewards-distributed: (var-get total-rewards-distributed),
    is-paused: (var-get farming-paused)
  }
)

(define-read-only (get-farm-apy (farm-id uint))
  (match (map-get? farms farm-id)
    farm
      (if (> (get total-deposited farm) u0)
        (let
          (
            (yearly-blocks u52560)
            (farm-reward-per-block (/ (* (var-get reward-per-block) (get alloc-point farm))
                                      (var-get total-alloc-points)))
          )
          (/ (* farm-reward-per-block yearly-blocks u10000) (get total-deposited farm))
        )
        u0)
    u0)
)

(define-read-only (get-boost-tier (tier uint))
  (map-get? boost-tiers tier)
)

(define-read-only (get-user-total-deposited (user principal))
  (default-to u0 (map-get? user-total-deposited user))
)
