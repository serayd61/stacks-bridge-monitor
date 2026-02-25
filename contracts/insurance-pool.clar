;; ============================================================================
;; Insurance Pool - Bridge Operation Insurance
;; ============================================================================
;; Provides insurance coverage for bridge operations against smart contract
;; failures, oracle manipulation, and cross-chain transaction failures.
;; Users can purchase coverage and file claims through governance.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u12001))
(define-constant ERR-INVALID-AMOUNT (err u12002))
(define-constant ERR-POOL-UNDERFUNDED (err u12003))
(define-constant ERR-POLICY-NOT-FOUND (err u12004))
(define-constant ERR-POLICY-EXPIRED (err u12005))
(define-constant ERR-CLAIM-NOT-FOUND (err u12006))
(define-constant ERR-CLAIM-ALREADY-PROCESSED (err u12007))
(define-constant ERR-COVERAGE-LIMIT-EXCEEDED (err u12008))
(define-constant ERR-INSUFFICIENT-PREMIUM (err u12009))
(define-constant ERR-POOL-PAUSED (err u12010))
(define-constant ERR-ALREADY-STAKED (err u12011))
(define-constant ERR-NO-STAKE (err u12012))
(define-constant ERR-COOLDOWN-ACTIVE (err u12013))

;; Claim Statuses
(define-constant CLAIM-PENDING u0)
(define-constant CLAIM-APPROVED u1)
(define-constant CLAIM-REJECTED u2)
(define-constant CLAIM-PAID u3)

;; Coverage Types
(define-constant COVERAGE-BRIDGE-FAILURE u0)
(define-constant COVERAGE-ORACLE-MANIPULATION u1)
(define-constant COVERAGE-SMART-CONTRACT u2)
(define-constant COVERAGE-CROSS-CHAIN u3)

;; Parameters
(define-constant BPS-DENOMINATOR u10000)
(define-constant MIN-COVERAGE-PERIOD u144)  ;; ~1 day
(define-constant MAX-COVERAGE-PERIOD u52560) ;; ~365 days

;; Data Variables
(define-data-var total-pool-balance uint u0)
(define-data-var total-coverage-active uint u0)
(define-data-var total-premiums-collected uint u0)
(define-data-var total-claims-paid uint u0)
(define-data-var policy-count uint u0)
(define-data-var claim-count uint u0)
(define-data-var total-stakers uint u0)
(define-data-var total-staked uint u0)
(define-data-var base-premium-rate uint u200) ;; 2% annualized
(define-data-var max-coverage-ratio uint u5000) ;; 50% of pool can be active coverage
(define-data-var claim-assessment-period uint u1008) ;; ~7 days
(define-data-var unstake-cooldown uint u2016) ;; ~14 days
(define-data-var pool-paused bool false)
(define-data-var min-stake-amount uint u100000000) ;; 100 tokens

;; Coverage type parameters
(define-map coverage-params
  uint ;; coverage-type
  {
    name: (string-ascii 32),
    premium-multiplier: uint, ;; multiplier in bps (10000 = 1x)
    max-payout-bps: uint,     ;; max payout as % of coverage (in bps)
    is-active: bool
  }
)

;; Insurance policies
(define-map policies
  uint ;; policy-id
  {
    holder: principal,
    coverage-type: uint,
    coverage-amount: uint,
    premium-paid: uint,
    start-block: uint,
    end-block: uint,
    is-active: bool
  }
)

;; Claims
(define-map claims
  uint ;; claim-id
  {
    claimant: principal,
    policy-id: uint,
    amount-requested: uint,
    amount-approved: uint,
    evidence-hash: (buff 32),
    status: uint,
    filed-at: uint,
    resolved-at: uint,
    assessor: (optional principal)
  }
)

;; Insurance stakers (underwriters)
(define-map stakers
  principal
  {
    amount: uint,
    staked-at: uint,
    unstake-requested-at: uint,
    earned-premiums: uint,
    share-bps: uint
  }
)

;; Assessors (claim reviewers)
(define-map assessors principal bool)

;; User policies list
(define-map user-policy-count principal uint)

;; Initialize coverage types
(map-set coverage-params COVERAGE-BRIDGE-FAILURE
  { name: "Bridge Failure", premium-multiplier: u10000, max-payout-bps: u10000, is-active: true })
(map-set coverage-params COVERAGE-ORACLE-MANIPULATION
  { name: "Oracle Manipulation", premium-multiplier: u15000, max-payout-bps: u8000, is-active: true })
(map-set coverage-params COVERAGE-SMART-CONTRACT
  { name: "Smart Contract Bug", premium-multiplier: u12000, max-payout-bps: u10000, is-active: true })
(map-set coverage-params COVERAGE-CROSS-CHAIN
  { name: "Cross-Chain Failure", premium-multiplier: u13000, max-payout-bps: u9000, is-active: true })

;; ============================================================================
;; Insurance Staking (Underwriting)
;; ============================================================================

(define-public (stake-insurance (amount uint))
  (let
    (
      (existing (map-get? stakers tx-sender))
    )
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= amount (var-get min-stake-amount)) ERR-INVALID-AMOUNT)
    (asserts! (is-none existing) ERR-ALREADY-STAKED)

    (map-set stakers tx-sender {
      amount: amount,
      staked-at: block-height,
      unstake-requested-at: u0,
      earned-premiums: u0,
      share-bps: (if (> (var-get total-staked) u0)
        (/ (* amount BPS-DENOMINATOR) (+ (var-get total-staked) amount))
        BPS-DENOMINATOR)
    })

    (var-set total-staked (+ (var-get total-staked) amount))
    (var-set total-pool-balance (+ (var-get total-pool-balance) amount))
    (var-set total-stakers (+ (var-get total-stakers) u1))

    (print {
      event: "insurance-staked",
      staker: tx-sender,
      amount: amount,
      total-pool: (var-get total-pool-balance)
    })

    (ok true)
  )
)

(define-public (request-unstake)
  (let
    (
      (staker-info (unwrap! (map-get? stakers tx-sender) ERR-NO-STAKE))
    )
    (asserts! (is-eq (get unstake-requested-at staker-info) u0) ERR-COOLDOWN-ACTIVE)

    (map-set stakers tx-sender
      (merge staker-info { unstake-requested-at: block-height }))

    (print {
      event: "unstake-requested",
      staker: tx-sender,
      cooldown-ends: (+ block-height (var-get unstake-cooldown))
    })

    (ok true)
  )
)

(define-public (complete-unstake)
  (let
    (
      (staker-info (unwrap! (map-get? stakers tx-sender) ERR-NO-STAKE))
    )
    (asserts! (> (get unstake-requested-at staker-info) u0) ERR-NO-STAKE)
    (asserts! (>= block-height (+ (get unstake-requested-at staker-info) (var-get unstake-cooldown)))
              ERR-COOLDOWN-ACTIVE)

    (var-set total-staked (- (var-get total-staked) (get amount staker-info)))
    (var-set total-pool-balance (- (var-get total-pool-balance) (get amount staker-info)))
    (var-set total-stakers (- (var-get total-stakers) u1))

    (map-delete stakers tx-sender)

    (print {
      event: "insurance-unstaked",
      staker: tx-sender,
      amount: (get amount staker-info),
      earned: (get earned-premiums staker-info)
    })

    (ok (get amount staker-info))
  )
)

;; ============================================================================
;; Policy Purchase
;; ============================================================================

(define-public (purchase-coverage (coverage-type uint) (coverage-amount uint) (duration-blocks uint))
  (let
    (
      (policy-id (var-get policy-count))
      (params (unwrap! (map-get? coverage-params coverage-type) ERR-INVALID-AMOUNT))
      (premium (calculate-premium coverage-type coverage-amount duration-blocks))
      (max-coverage (/ (* (var-get total-pool-balance) (var-get max-coverage-ratio)) BPS-DENOMINATOR))
    )
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    (asserts! (get is-active params) ERR-POOL-PAUSED)
    (asserts! (> coverage-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= duration-blocks MIN-COVERAGE-PERIOD) ERR-INVALID-AMOUNT)
    (asserts! (<= duration-blocks MAX-COVERAGE-PERIOD) ERR-INVALID-AMOUNT)
    (asserts! (<= (+ (var-get total-coverage-active) coverage-amount) max-coverage)
              ERR-COVERAGE-LIMIT-EXCEEDED)
    (asserts! (> premium u0) ERR-INSUFFICIENT-PREMIUM)

    ;; Create policy
    (map-set policies policy-id {
      holder: tx-sender,
      coverage-type: coverage-type,
      coverage-amount: coverage-amount,
      premium-paid: premium,
      start-block: block-height,
      end-block: (+ block-height duration-blocks),
      is-active: true
    })

    ;; Update counters
    (var-set policy-count (+ policy-id u1))
    (var-set total-coverage-active (+ (var-get total-coverage-active) coverage-amount))
    (var-set total-premiums-collected (+ (var-get total-premiums-collected) premium))
    (var-set total-pool-balance (+ (var-get total-pool-balance) premium))

    ;; Update user policy count
    (map-set user-policy-count tx-sender
      (+ (default-to u0 (map-get? user-policy-count tx-sender)) u1))

    (print {
      event: "coverage-purchased",
      policy-id: policy-id,
      holder: tx-sender,
      coverage-type: coverage-type,
      coverage-amount: coverage-amount,
      premium: premium,
      duration: duration-blocks
    })

    (ok policy-id)
  )
)

;; ============================================================================
;; Claims
;; ============================================================================

(define-public (file-claim (policy-id uint) (amount uint) (evidence-hash (buff 32)))
  (let
    (
      (policy (unwrap! (map-get? policies policy-id) ERR-POLICY-NOT-FOUND))
      (claim-id (var-get claim-count))
    )
    (asserts! (is-eq (get holder policy) tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (get is-active policy) ERR-POLICY-EXPIRED)
    (asserts! (<= block-height (get end-block policy)) ERR-POLICY-EXPIRED)
    (asserts! (<= amount (get coverage-amount policy)) ERR-COVERAGE-LIMIT-EXCEEDED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    (map-set claims claim-id {
      claimant: tx-sender,
      policy-id: policy-id,
      amount-requested: amount,
      amount-approved: u0,
      evidence-hash: evidence-hash,
      status: CLAIM-PENDING,
      filed-at: block-height,
      resolved-at: u0,
      assessor: none
    })

    (var-set claim-count (+ claim-id u1))

    (print {
      event: "claim-filed",
      claim-id: claim-id,
      policy-id: policy-id,
      claimant: tx-sender,
      amount: amount
    })

    (ok claim-id)
  )
)

(define-public (assess-claim (claim-id uint) (approved bool) (approved-amount uint))
  (let
    (
      (claim (unwrap! (map-get? claims claim-id) ERR-CLAIM-NOT-FOUND))
    )
    (asserts! (or (is-eq tx-sender CONTRACT-OWNER)
                  (default-to false (map-get? assessors tx-sender)))
              ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status claim) CLAIM-PENDING) ERR-CLAIM-ALREADY-PROCESSED)

    (if approved
      (begin
        (asserts! (<= approved-amount (get amount-requested claim)) ERR-INVALID-AMOUNT)
        (asserts! (<= approved-amount (var-get total-pool-balance)) ERR-POOL-UNDERFUNDED)

        (map-set claims claim-id
          (merge claim {
            status: CLAIM-APPROVED,
            amount-approved: approved-amount,
            resolved-at: block-height,
            assessor: (some tx-sender)
          }))

        (print {
          event: "claim-approved",
          claim-id: claim-id,
          approved-amount: approved-amount,
          assessor: tx-sender
        })

        (ok CLAIM-APPROVED)
      )
      (begin
        (map-set claims claim-id
          (merge claim {
            status: CLAIM-REJECTED,
            resolved-at: block-height,
            assessor: (some tx-sender)
          }))

        (print {
          event: "claim-rejected",
          claim-id: claim-id,
          assessor: tx-sender
        })

        (ok CLAIM-REJECTED)
      )
    )
  )
)

(define-public (execute-claim-payout (claim-id uint))
  (let
    (
      (claim (unwrap! (map-get? claims claim-id) ERR-CLAIM-NOT-FOUND))
      (policy (unwrap! (map-get? policies (get policy-id claim)) ERR-POLICY-NOT-FOUND))
    )
    (asserts! (is-eq (get status claim) CLAIM-APPROVED) ERR-CLAIM-ALREADY-PROCESSED)
    (asserts! (<= (get amount-approved claim) (var-get total-pool-balance)) ERR-POOL-UNDERFUNDED)

    ;; Update claim status
    (map-set claims claim-id
      (merge claim { status: CLAIM-PAID }))

    ;; Deactivate policy after payout
    (map-set policies (get policy-id claim)
      (merge policy { is-active: false }))

    ;; Update pool balance
    (var-set total-pool-balance (- (var-get total-pool-balance) (get amount-approved claim)))
    (var-set total-claims-paid (+ (var-get total-claims-paid) (get amount-approved claim)))
    (var-set total-coverage-active (- (var-get total-coverage-active) (get coverage-amount policy)))

    (print {
      event: "claim-paid",
      claim-id: claim-id,
      claimant: (get claimant claim),
      amount: (get amount-approved claim)
    })

    (ok (get amount-approved claim))
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-assessor (assessor principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set assessors assessor enabled))
  )
)

(define-public (set-base-premium-rate (rate uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> rate u0) ERR-INVALID-AMOUNT)
    (ok (var-set base-premium-rate rate))
  )
)

(define-public (set-max-coverage-ratio (ratio uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= ratio BPS-DENOMINATOR) ERR-INVALID-AMOUNT)
    (ok (var-set max-coverage-ratio ratio))
  )
)

(define-public (toggle-pool-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set pool-paused (not (var-get pool-paused))))
  )
)

(define-public (update-coverage-type (coverage-type uint) (multiplier uint) (max-payout uint) (active bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (match (map-get? coverage-params coverage-type)
      params
        (ok (map-set coverage-params coverage-type
          (merge params {
            premium-multiplier: multiplier,
            max-payout-bps: max-payout,
            is-active: active
          })))
      ERR-INVALID-AMOUNT
    )
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (calculate-premium (coverage-type uint) (coverage-amount uint) (duration-blocks uint))
  (let
    (
      (params (unwrap-panic (map-get? coverage-params coverage-type)))
      (annual-blocks u52560)
      (base-premium (/ (* coverage-amount (var-get base-premium-rate)) BPS-DENOMINATOR))
      (duration-adjusted (/ (* base-premium duration-blocks) annual-blocks))
      (type-adjusted (/ (* duration-adjusted (get premium-multiplier params)) BPS-DENOMINATOR))
    )
    type-adjusted
  )
)

(define-read-only (get-policy (policy-id uint))
  (map-get? policies policy-id)
)

(define-read-only (get-claim (claim-id uint))
  (map-get? claims claim-id)
)

(define-read-only (get-staker-info (staker principal))
  (map-get? stakers staker)
)

(define-read-only (get-coverage-type-info (coverage-type uint))
  (map-get? coverage-params coverage-type)
)

(define-read-only (get-insurance-stats)
  {
    total-pool-balance: (var-get total-pool-balance),
    total-coverage-active: (var-get total-coverage-active),
    total-premiums-collected: (var-get total-premiums-collected),
    total-claims-paid: (var-get total-claims-paid),
    total-policies: (var-get policy-count),
    total-claims: (var-get claim-count),
    total-stakers: (var-get total-stakers),
    total-staked: (var-get total-staked),
    utilization-ratio: (if (> (var-get total-pool-balance) u0)
      (/ (* (var-get total-coverage-active) BPS-DENOMINATOR) (var-get total-pool-balance))
      u0),
    is-paused: (var-get pool-paused)
  }
)

(define-read-only (get-available-coverage)
  (let
    (
      (max-coverage (/ (* (var-get total-pool-balance) (var-get max-coverage-ratio)) BPS-DENOMINATOR))
    )
    (if (> max-coverage (var-get total-coverage-active))
      (- max-coverage (var-get total-coverage-active))
      u0
    )
  )
)

(define-read-only (is-assessor (account principal))
  (default-to false (map-get? assessors account))
)
