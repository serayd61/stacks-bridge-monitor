;; ============================================================================
;; Flash Loan - Uncollateralized Instant Loans
;; ============================================================================
;; Provides flash loan functionality for DeFi arbitrage and liquidations.
;; Borrowers must repay principal + fee within the same transaction.
;; Supports multiple asset pools with configurable parameters.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u11001))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u11002))
(define-constant ERR-LOAN-NOT-REPAID (err u11003))
(define-constant ERR-INVALID-AMOUNT (err u11004))
(define-constant ERR-POOL-NOT-FOUND (err u11005))
(define-constant ERR-POOL-PAUSED (err u11006))
(define-constant ERR-LOAN-ACTIVE (err u11007))
(define-constant ERR-NO-ACTIVE-LOAN (err u11008))
(define-constant ERR-REENTRANCY (err u11009))
(define-constant ERR-MAX-LOAN-EXCEEDED (err u11010))
(define-constant ERR-POOL-EXISTS (err u11011))
(define-constant ERR-INVALID-FEE (err u11012))

;; Fee basis points
(define-constant BPS-DENOMINATOR u10000)
(define-constant MAX-FLASH-FEE-BPS u100) ;; Max 1% flash loan fee

;; Data Variables
(define-data-var flash-fee-bps uint u9) ;; 0.09% default flash loan fee
(define-data-var total-flash-loans uint u0)
(define-data-var total-flash-volume uint u0)
(define-data-var total-fees-earned uint u0)
(define-data-var protocol-paused bool false)
(define-data-var pool-count uint u0)
(define-data-var reentrancy-guard bool false)

;; Flash Loan Pool
(define-map pools
  uint ;; pool-id
  {
    name: (string-ascii 32),
    total-liquidity: uint,
    available-liquidity: uint,
    total-borrowed: uint,
    total-fees: uint,
    fee-bps: uint,
    max-loan-percentage: uint, ;; max % of pool that can be borrowed (in bps)
    is-active: bool,
    created-at: uint
  }
)

;; Liquidity provider positions
(define-map lp-positions
  { pool-id: uint, provider: principal }
  {
    deposited: uint,
    shares: uint,
    earned-fees: uint,
    deposited-at: uint
  }
)

;; Pool total shares
(define-map pool-shares uint uint)

;; Active flash loan tracking (per-block)
(define-map active-loans
  principal
  {
    pool-id: uint,
    amount: uint,
    fee: uint,
    block: uint
  }
)

;; Flash loan history
(define-map loan-history
  uint ;; loan-id
  {
    borrower: principal,
    pool-id: uint,
    amount: uint,
    fee: uint,
    block: uint,
    repaid: bool
  }
)

;; Provider fee claim tracking
(define-map provider-claimed-fees
  { pool-id: uint, provider: principal }
  uint
)

;; ============================================================================
;; Pool Management
;; ============================================================================

(define-public (create-pool (name (string-ascii 32)) (fee-bps uint) (max-loan-pct uint))
  (let
    (
      (pool-id (var-get pool-count))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= fee-bps MAX-FLASH-FEE-BPS) ERR-INVALID-FEE)
    (asserts! (<= max-loan-pct BPS-DENOMINATOR) ERR-INVALID-AMOUNT)

    (map-set pools pool-id {
      name: name,
      total-liquidity: u0,
      available-liquidity: u0,
      total-borrowed: u0,
      total-fees: u0,
      fee-bps: fee-bps,
      max-loan-percentage: max-loan-pct,
      is-active: true,
      created-at: block-height
    })

    (map-set pool-shares pool-id u0)
    (var-set pool-count (+ pool-id u1))

    (print {
      event: "pool-created",
      pool-id: pool-id,
      name: name,
      fee-bps: fee-bps,
      max-loan-pct: max-loan-pct
    })

    (ok pool-id)
  )
)

;; ============================================================================
;; Liquidity Provision
;; ============================================================================

(define-public (deposit-liquidity (pool-id uint) (amount uint))
  (let
    (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (current-shares (default-to u0 (map-get? pool-shares pool-id)))
      (existing (map-get? lp-positions { pool-id: pool-id, provider: tx-sender }))
      (new-shares (if (is-eq current-shares u0)
        amount
        (/ (* amount current-shares) (get total-liquidity pool))))
    )
    (asserts! (get is-active pool) ERR-POOL-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    ;; Update pool
    (map-set pools pool-id
      (merge pool {
        total-liquidity: (+ (get total-liquidity pool) amount),
        available-liquidity: (+ (get available-liquidity pool) amount)
      }))

    ;; Update shares
    (map-set pool-shares pool-id (+ current-shares new-shares))

    ;; Update or create LP position
    (match existing
      prev-position
        (map-set lp-positions { pool-id: pool-id, provider: tx-sender }
          (merge prev-position {
            deposited: (+ (get deposited prev-position) amount),
            shares: (+ (get shares prev-position) new-shares)
          }))
      (map-set lp-positions { pool-id: pool-id, provider: tx-sender } {
        deposited: amount,
        shares: new-shares,
        earned-fees: u0,
        deposited-at: block-height
      })
    )

    (print {
      event: "liquidity-deposited",
      pool-id: pool-id,
      provider: tx-sender,
      amount: amount,
      shares: new-shares
    })

    (ok new-shares)
  )
)

(define-public (withdraw-liquidity (pool-id uint) (shares uint))
  (let
    (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (position (unwrap! (map-get? lp-positions { pool-id: pool-id, provider: tx-sender }) ERR-NOT-AUTHORIZED))
      (total-shares (default-to u0 (map-get? pool-shares pool-id)))
      (withdraw-amount (/ (* shares (get total-liquidity pool)) total-shares))
    )
    (asserts! (<= shares (get shares position)) ERR-INVALID-AMOUNT)
    (asserts! (<= withdraw-amount (get available-liquidity pool)) ERR-INSUFFICIENT-LIQUIDITY)

    ;; Update pool
    (map-set pools pool-id
      (merge pool {
        total-liquidity: (- (get total-liquidity pool) withdraw-amount),
        available-liquidity: (- (get available-liquidity pool) withdraw-amount)
      }))

    ;; Update shares
    (map-set pool-shares pool-id (- total-shares shares))

    ;; Update position
    (if (is-eq shares (get shares position))
      (map-delete lp-positions { pool-id: pool-id, provider: tx-sender })
      (map-set lp-positions { pool-id: pool-id, provider: tx-sender }
        (merge position {
          deposited: (- (get deposited position) withdraw-amount),
          shares: (- (get shares position) shares)
        }))
    )

    (print {
      event: "liquidity-withdrawn",
      pool-id: pool-id,
      provider: tx-sender,
      amount: withdraw-amount,
      shares: shares
    })

    (ok withdraw-amount)
  )
)

;; ============================================================================
;; Flash Loan Operations
;; ============================================================================

(define-public (initiate-flash-loan (pool-id uint) (amount uint))
  (let
    (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (fee (calculate-flash-fee pool-id amount))
      (max-loan (/ (* (get available-liquidity pool) (get max-loan-percentage pool)) BPS-DENOMINATOR))
      (loan-id (var-get total-flash-loans))
    )
    (asserts! (not (var-get protocol-paused)) ERR-POOL-PAUSED)
    (asserts! (not (var-get reentrancy-guard)) ERR-REENTRANCY)
    (asserts! (get is-active pool) ERR-POOL-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (get available-liquidity pool)) ERR-INSUFFICIENT-LIQUIDITY)
    (asserts! (<= amount max-loan) ERR-MAX-LOAN-EXCEEDED)
    (asserts! (is-none (map-get? active-loans tx-sender)) ERR-LOAN-ACTIVE)

    ;; Set reentrancy guard
    (var-set reentrancy-guard true)

    ;; Record active loan
    (map-set active-loans tx-sender {
      pool-id: pool-id,
      amount: amount,
      fee: fee,
      block: block-height
    })

    ;; Record in history
    (map-set loan-history loan-id {
      borrower: tx-sender,
      pool-id: pool-id,
      amount: amount,
      fee: fee,
      block: block-height,
      repaid: false
    })

    ;; Reduce available liquidity
    (map-set pools pool-id
      (merge pool {
        available-liquidity: (- (get available-liquidity pool) amount),
        total-borrowed: (+ (get total-borrowed pool) amount)
      }))

    (var-set total-flash-loans (+ loan-id u1))
    (var-set total-flash-volume (+ (var-get total-flash-volume) amount))

    (print {
      event: "flash-loan-initiated",
      loan-id: loan-id,
      borrower: tx-sender,
      pool-id: pool-id,
      amount: amount,
      fee: fee,
      block: block-height
    })

    (ok { loan-id: loan-id, amount: amount, fee: fee })
  )
)

(define-public (repay-flash-loan (pool-id uint) (amount uint))
  (let
    (
      (loan (unwrap! (map-get? active-loans tx-sender) ERR-NO-ACTIVE-LOAN))
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (required-repayment (+ (get amount loan) (get fee loan)))
    )
    (asserts! (is-eq pool-id (get pool-id loan)) ERR-POOL-NOT-FOUND)
    (asserts! (>= amount required-repayment) ERR-LOAN-NOT-REPAID)
    (asserts! (is-eq block-height (get block loan)) ERR-LOAN-NOT-REPAID)

    ;; Restore liquidity + fee
    (map-set pools pool-id
      (merge pool {
        available-liquidity: (+ (get available-liquidity pool) (get amount loan) (get fee loan)),
        total-liquidity: (+ (get total-liquidity pool) (get fee loan)),
        total-fees: (+ (get total-fees pool) (get fee loan))
      }))

    ;; Clear active loan
    (map-delete active-loans tx-sender)

    ;; Update total fees
    (var-set total-fees-earned (+ (var-get total-fees-earned) (get fee loan)))

    ;; Release reentrancy guard
    (var-set reentrancy-guard false)

    (print {
      event: "flash-loan-repaid",
      borrower: tx-sender,
      pool-id: pool-id,
      amount: (get amount loan),
      fee: (get fee loan),
      block: block-height
    })

    (ok true)
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-flash-fee (new-fee-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-fee-bps MAX-FLASH-FEE-BPS) ERR-INVALID-FEE)
    (ok (var-set flash-fee-bps new-fee-bps))
  )
)

(define-public (toggle-pool-status (pool-id uint))
  (let
    ((pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set pools pool-id
      (merge pool { is-active: (not (get is-active pool)) })))
  )
)

(define-public (toggle-protocol-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set protocol-paused (not (var-get protocol-paused))))
  )
)

(define-public (update-pool-fee (pool-id uint) (new-fee-bps uint))
  (let
    ((pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-fee-bps MAX-FLASH-FEE-BPS) ERR-INVALID-FEE)
    (ok (map-set pools pool-id
      (merge pool { fee-bps: new-fee-bps })))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (calculate-flash-fee (pool-id uint) (amount uint))
  (let
    (
      (pool-fee (match (map-get? pools pool-id)
        pool (get fee-bps pool)
        (var-get flash-fee-bps)))
    )
    (/ (* amount pool-fee) BPS-DENOMINATOR)
  )
)

(define-read-only (get-pool-info (pool-id uint))
  (map-get? pools pool-id)
)

(define-read-only (get-lp-position (pool-id uint) (provider principal))
  (map-get? lp-positions { pool-id: pool-id, provider: provider })
)

(define-read-only (get-active-loan (borrower principal))
  (map-get? active-loans borrower)
)

(define-read-only (get-loan-info (loan-id uint))
  (map-get? loan-history loan-id)
)

(define-read-only (get-flash-loan-stats)
  {
    total-loans: (var-get total-flash-loans),
    total-volume: (var-get total-flash-volume),
    total-fees-earned: (var-get total-fees-earned),
    default-fee-bps: (var-get flash-fee-bps),
    pool-count: (var-get pool-count),
    is-paused: (var-get protocol-paused)
  }
)

(define-read-only (get-max-flash-loan (pool-id uint))
  (match (map-get? pools pool-id)
    pool (/ (* (get available-liquidity pool) (get max-loan-percentage pool)) BPS-DENOMINATOR)
    u0
  )
)

(define-read-only (get-pool-utilization (pool-id uint))
  (match (map-get? pools pool-id)
    pool
      (if (> (get total-liquidity pool) u0)
        (/ (* (- (get total-liquidity pool) (get available-liquidity pool)) u10000) (get total-liquidity pool))
        u0)
    u0
  )
)
