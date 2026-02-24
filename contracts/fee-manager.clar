;; ============================================================================
;; Fee Manager - Bridge Fee Collection & Distribution
;; ============================================================================
;; Manages fee collection from bridge operations, distributes fees
;; to treasury, stakers, and liquidity providers.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u3001))
(define-constant ERR-INVALID-FEE (err u3002))
(define-constant ERR-NO-FEES-TO-CLAIM (err u3003))
(define-constant ERR-INVALID-PERCENTAGE (err u3004))
(define-constant ERR-INVALID-RECIPIENT (err u3005))
(define-constant ERR-COOLDOWN-ACTIVE (err u3006))

;; Fee basis points (1 bp = 0.01%)
(define-constant MAX-FEE-BPS u500) ;; Max 5%
(define-constant BPS-DENOMINATOR u10000)

;; Data Variables
(define-data-var base-fee-bps uint u25) ;; 0.25% default
(define-data-var treasury-share uint u40) ;; 40% of fees to treasury
(define-data-var staker-share uint u40) ;; 40% of fees to stakers
(define-data-var lp-share uint u20) ;; 20% of fees to LPs
(define-data-var total-fees-collected uint u0)
(define-data-var total-fees-distributed uint u0)
(define-data-var fee-claim-cooldown uint u144) ;; ~1 day in blocks

;; Treasury address
(define-data-var treasury-address principal CONTRACT-OWNER)

;; Fee Tier System (volume-based discounts)
(define-map fee-tiers
  uint ;; tier level
  {
    min-volume: uint,
    fee-bps: uint,
    name: (string-ascii 20)
  }
)

;; User accumulated fees
(define-map user-claimable-fees principal uint)

;; User last claim block
(define-map user-last-claim principal uint)

;; Fee collection tracking per epoch
(define-map epoch-fees uint uint)

;; Whitelisted addresses (zero fee)
(define-map fee-whitelist principal bool)

;; Initialize fee tiers
(map-set fee-tiers u0 { min-volume: u0, fee-bps: u25, name: "Bronze" })
(map-set fee-tiers u1 { min-volume: u10000000000, fee-bps: u20, name: "Silver" })
(map-set fee-tiers u2 { min-volume: u50000000000, fee-bps: u15, name: "Gold" })
(map-set fee-tiers u3 { min-volume: u100000000000, fee-bps: u10, name: "Platinum" })
(map-set fee-tiers u4 { min-volume: u500000000000, fee-bps: u5, name: "Diamond" })

;; ============================================================================
;; Fee Calculation
;; ============================================================================

(define-read-only (calculate-fee (amount uint) (user principal))
  (let
    (
      (is-whitelisted (default-to false (map-get? fee-whitelist user)))
      (fee-bps (var-get base-fee-bps))
    )
    (if is-whitelisted
      u0
      (/ (* amount fee-bps) BPS-DENOMINATOR)
    )
  )
)

(define-read-only (calculate-tiered-fee (amount uint) (user-volume uint))
  (let
    (
      (tier (get-fee-tier user-volume))
      (fee-bps (get fee-bps tier))
    )
    (/ (* amount fee-bps) BPS-DENOMINATOR)
  )
)

;; ============================================================================
;; Fee Collection (called by bridge-registry)
;; ============================================================================

(define-public (collect-fee (amount uint) (payer principal))
  (begin
    (asserts! (> amount u0) ERR-INVALID-FEE)
    ;; Calculate distribution
    (let
      (
        (treasury-amount (/ (* amount (var-get treasury-share)) u100))
        (staker-amount (/ (* amount (var-get staker-share)) u100))
        (lp-amount (- amount (+ treasury-amount staker-amount)))
      )
      ;; Update totals
      (var-set total-fees-collected (+ (var-get total-fees-collected) amount))

      ;; Track epoch fees
      (map-set epoch-fees (/ block-height u144)
        (+ (default-to u0 (map-get? epoch-fees (/ block-height u144))) amount))

      (print {
        event: "fee-collected",
        total: amount,
        treasury: treasury-amount,
        stakers: staker-amount,
        lps: lp-amount,
        payer: payer,
        block: block-height
      })

      (ok {
        total: amount,
        treasury: treasury-amount,
        stakers: staker-amount,
        lps: lp-amount
      })
    )
  )
)

;; ============================================================================
;; Fee Distribution
;; ============================================================================

(define-public (add-claimable-fees (user principal) (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-FEE)
    (ok (map-set user-claimable-fees user
      (+ (default-to u0 (map-get? user-claimable-fees user)) amount)))
  )
)

(define-public (claim-fees)
  (let
    (
      (claimable (default-to u0 (map-get? user-claimable-fees tx-sender)))
      (last-claim (default-to u0 (map-get? user-last-claim tx-sender)))
    )
    (asserts! (> claimable u0) ERR-NO-FEES-TO-CLAIM)
    (asserts! (>= block-height (+ last-claim (var-get fee-claim-cooldown))) ERR-COOLDOWN-ACTIVE)

    ;; Reset claimable and update last claim
    (map-set user-claimable-fees tx-sender u0)
    (map-set user-last-claim tx-sender block-height)
    (var-set total-fees-distributed (+ (var-get total-fees-distributed) claimable))

    (print {
      event: "fees-claimed",
      user: tx-sender,
      amount: claimable,
      block: block-height
    })

    (ok claimable)
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-base-fee (new-fee-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-fee-bps MAX-FEE-BPS) ERR-INVALID-FEE)
    (ok (var-set base-fee-bps new-fee-bps))
  )
)

(define-public (set-fee-distribution (treasury uint) (stakers uint) (lps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (+ treasury (+ stakers lps)) u100) ERR-INVALID-PERCENTAGE)
    (var-set treasury-share treasury)
    (var-set staker-share stakers)
    (var-set lp-share lps)
    (ok true)
  )
)

(define-public (set-treasury-address (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set treasury-address new-treasury))
  )
)

(define-public (set-whitelist (user principal) (whitelisted bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set fee-whitelist user whitelisted))
  )
)

(define-public (set-fee-claim-cooldown (blocks uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set fee-claim-cooldown blocks))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-fee-stats)
  {
    base-fee-bps: (var-get base-fee-bps),
    total-collected: (var-get total-fees-collected),
    total-distributed: (var-get total-fees-distributed),
    pending-distribution: (- (var-get total-fees-collected) (var-get total-fees-distributed)),
    treasury-share: (var-get treasury-share),
    staker-share: (var-get staker-share),
    lp-share: (var-get lp-share)
  }
)

(define-read-only (get-claimable-fees (user principal))
  (default-to u0 (map-get? user-claimable-fees user))
)

(define-read-only (get-fee-tier (volume uint))
  (if (>= volume u500000000000)
    (unwrap-panic (map-get? fee-tiers u4))
    (if (>= volume u100000000000)
      (unwrap-panic (map-get? fee-tiers u3))
      (if (>= volume u50000000000)
        (unwrap-panic (map-get? fee-tiers u2))
        (if (>= volume u10000000000)
          (unwrap-panic (map-get? fee-tiers u1))
          (unwrap-panic (map-get? fee-tiers u0))
        )
      )
    )
  )
)

(define-read-only (get-epoch-fees (epoch uint))
  (default-to u0 (map-get? epoch-fees epoch))
)

(define-read-only (is-whitelisted (user principal))
  (default-to false (map-get? fee-whitelist user))
)

(define-read-only (get-treasury-address)
  (var-get treasury-address)
)
