;; Bridge Fee Calculator Contract
;; Dynamic fee calculation for sBTC bridge operations
;; Adjusts fees based on network congestion and BTC mempool

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u200))
(define-constant err-not-authorized (err u201))
(define-constant err-invalid-amount (err u202))
(define-constant err-invalid-fee (err u203))

(define-constant BASE-FEE-BPS u30)      ;; 0.3% base fee
(define-constant MIN-FEE u1000)         ;; 1000 sats minimum
(define-constant MAX-FEE-BPS u200)      ;; 2% max fee
(define-constant FEE-DENOMINATOR u10000)

(define-data-var current-fee-bps uint BASE-FEE-BPS)
(define-data-var congestion-multiplier uint u100) ;; 100 = 1x
(define-data-var fee-collector principal contract-owner)
(define-data-var total-fees-collected uint u0)
(define-data-var calculation-count uint u0)

(define-map fee-tiers uint
  {
    min-amount: uint,
    max-amount: uint,
    fee-bps: uint
  }
)

(define-map fee-history uint
  {
    amount: uint,
    fee: uint,
    fee-bps: uint,
    block-height: uint,
    direction: (string-ascii 10)
  }
)

;; Read-only
(define-read-only (get-current-fee-bps)
  (var-get current-fee-bps)
)

(define-read-only (get-fee-tier (tier-id uint))
  (map-get? fee-tiers tier-id)
)

(define-read-only (calculate-bridge-fee (amount uint) (direction (string-ascii 10)))
  (let (
    (base-fee (/ (* amount (var-get current-fee-bps)) FEE-DENOMINATOR))
    (adjusted-fee (/ (* base-fee (var-get congestion-multiplier)) u100))
    (final-fee (if (< adjusted-fee MIN-FEE) MIN-FEE adjusted-fee))
  )
    (ok { amount: amount, fee: final-fee, fee-bps: (var-get current-fee-bps), net-amount: (- amount final-fee) })
  )
)

(define-read-only (get-total-fees-collected)
  (var-get total-fees-collected)
)

(define-read-only (get-congestion-multiplier)
  (var-get congestion-multiplier)
)

;; Public functions
(define-public (set-fee-bps (new-fee-bps uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= new-fee-bps MAX-FEE-BPS) err-invalid-fee)
    (var-set current-fee-bps new-fee-bps)
    (ok new-fee-bps)
  )
)

(define-public (set-congestion-multiplier (multiplier uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (and (>= multiplier u50) (<= multiplier u300)) err-invalid-fee)
    (var-set congestion-multiplier multiplier)
    (ok multiplier)
  )
)

(define-public (set-fee-tier (tier-id uint) (min-amount uint) (max-amount uint) (fee-bps uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= fee-bps MAX-FEE-BPS) err-invalid-fee)
    (map-set fee-tiers tier-id { min-amount: min-amount, max-amount: max-amount, fee-bps: fee-bps })
    (ok tier-id)
  )
)

(define-public (record-fee-collection (amount uint) (fee uint) (direction (string-ascii 10)))
  (let ((count (var-get calculation-count)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set fee-history count {
      amount: amount, fee: fee,
      fee-bps: (var-get current-fee-bps),
      block-height: stacks-block-height,
      direction: direction
    })
    (var-set total-fees-collected (+ (var-get total-fees-collected) fee))
    (var-set calculation-count (+ count u1))
    (ok { recorded: true, total-fees: (var-get total-fees-collected) })
  )
)

(define-public (set-fee-collector (collector principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set fee-collector collector)
    (ok collector)
  )
)
