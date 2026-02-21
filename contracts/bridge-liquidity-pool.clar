;; Bridge Liquidity Pool Contract
;; Provides instant liquidity for sBTC bridge users
;; LPs earn fees from bridge operations

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u800))
(define-constant err-not-authorized (err u801))
(define-constant err-insufficient-liquidity (err u802))
(define-constant err-invalid-amount (err u803))
(define-constant err-pool-paused (err u804))
(define-constant err-not-found (err u805))
(define-constant err-min-lp-amount (err u806))

(define-constant MIN-LP-AMOUNT u1000000)    ;; Min 0.01 BTC equivalent
(define-constant FEE-BPS u10)               ;; 0.1% LP fee
(define-constant FEE-DENOMINATOR u10000)

(define-data-var pool-paused bool false)
(define-data-var total-liquidity uint u0)
(define-data-var total-lp-tokens uint u0)
(define-data-var fee-pool uint u0)
(define-data-var lp-count uint u0)
(define-data-var operation-count uint u0)

;; LP positions
(define-map lp-positions principal
  {
    lp-tokens: uint,
    deposited-at: uint,
    fees-earned: uint,
    last-fee-claim: uint
  }
)

;; Liquidity operations log
(define-map operations uint
  {
    op-type: (string-ascii 20),
    user: principal,
    amount: uint,
    fee: uint,
    block-height: uint
  }
)

;; Read-only
(define-read-only (get-lp-position (lp principal))
  (map-get? lp-positions lp)
)

(define-read-only (get-pool-stats)
  {
    total-liquidity: (var-get total-liquidity),
    total-lp-tokens: (var-get total-lp-tokens),
    fee-pool: (var-get fee-pool),
    lp-count: (var-get lp-count),
    paused: (var-get pool-paused)
  }
)

(define-read-only (calculate-lp-tokens (amount uint))
  (let ((total-liq (var-get total-liquidity))
        (total-lp (var-get total-lp-tokens)))
    (if (is-eq total-liq u0)
      amount
      (/ (* amount total-lp) total-liq)
    )
  )
)

(define-read-only (calculate-withdrawal-amount (lp-tokens uint))
  (let ((total-lp (var-get total-lp-tokens)))
    (if (> total-lp u0)
      (/ (* lp-tokens (var-get total-liquidity)) total-lp)
      u0
    )
  )
)

(define-read-only (calculate-bridge-fee (amount uint))
  (/ (* amount FEE-BPS) FEE-DENOMINATOR)
)

;; Public functions
(define-public (add-liquidity (amount uint))
  (let (
    (lp-tokens (calculate-lp-tokens amount))
    (op-id (var-get operation-count))
  )
    (asserts! (not (var-get pool-paused)) err-pool-paused)
    (asserts! (>= amount MIN-LP-AMOUNT) err-min-lp-amount)

    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    (match (map-get? lp-positions tx-sender)
      pos
      (map-set lp-positions tx-sender (merge pos {
        lp-tokens: (+ (get lp-tokens pos) lp-tokens)
      }))
      (begin
        (map-set lp-positions tx-sender {
          lp-tokens: lp-tokens,
          deposited-at: stacks-block-height,
          fees-earned: u0,
          last-fee-claim: stacks-block-height
        })
        (var-set lp-count (+ (var-get lp-count) u1))
      )
    )

    (var-set total-liquidity (+ (var-get total-liquidity) amount))
    (var-set total-lp-tokens (+ (var-get total-lp-tokens) lp-tokens))

    (map-set operations op-id {
      op-type: "add-liquidity", user: tx-sender,
      amount: amount, fee: u0, block-height: stacks-block-height
    })
    (var-set operation-count (+ op-id u1))

    (ok { lp-tokens: lp-tokens, amount: amount })
  )
)

(define-public (remove-liquidity (lp-tokens uint))
  (match (map-get? lp-positions tx-sender)
    pos
    (let (
      (withdrawal-amount (calculate-withdrawal-amount lp-tokens))
      (op-id (var-get operation-count))
    )
      (asserts! (>= (get lp-tokens pos) lp-tokens) err-insufficient-liquidity)
      (asserts! (<= withdrawal-amount (var-get total-liquidity)) err-insufficient-liquidity)

      (try! (as-contract (stx-transfer? withdrawal-amount tx-sender tx-sender)))

      (map-set lp-positions tx-sender (merge pos {
        lp-tokens: (- (get lp-tokens pos) lp-tokens)
      }))

      (var-set total-liquidity (- (var-get total-liquidity) withdrawal-amount))
      (var-set total-lp-tokens (- (var-get total-lp-tokens) lp-tokens))

      (map-set operations op-id {
        op-type: "remove-liquidity", user: tx-sender,
        amount: withdrawal-amount, fee: u0, block-height: stacks-block-height
      })
      (var-set operation-count (+ op-id u1))

      (ok { withdrawn: withdrawal-amount, lp-tokens-burned: lp-tokens })
    )
    err-not-found
  )
)

(define-public (use-liquidity (amount uint) (borrower principal))
  (let ((fee (calculate-bridge-fee amount)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= amount (var-get total-liquidity)) err-insufficient-liquidity)

    (try! (as-contract (stx-transfer? amount tx-sender borrower)))

    (var-set total-liquidity (- (var-get total-liquidity) amount))
    (var-set fee-pool (+ (var-get fee-pool) fee))

    (ok { borrowed: amount, fee: fee })
  )
)

(define-public (repay-liquidity (amount uint))
  (let ((fee (calculate-bridge-fee amount)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set total-liquidity (+ (var-get total-liquidity) amount))
    (ok { repaid: amount })
  )
)

(define-public (toggle-pool (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set pool-paused paused)
    (ok paused)
  )
)
