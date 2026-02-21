;; sBTC Vault Contract
;; Secure vault for sBTC deposits with yield generation
;; Tracks deposits, withdrawals and yield distribution

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-not-found (err u102))
(define-constant err-insufficient-balance (err u103))
(define-constant err-vault-paused (err u104))
(define-constant err-invalid-amount (err u105))
(define-constant err-min-deposit (err u106))

(define-constant MIN-DEPOSIT u100000)  ;; 0.001 sBTC (in sats)
(define-constant WITHDRAWAL-DELAY u144) ;; ~1 day

(define-data-var vault-active bool true)
(define-data-var total-deposits uint u0)
(define-data-var total-withdrawals uint u0)
(define-data-var depositor-count uint u0)
(define-data-var yield-pool uint u0)
(define-data-var apy-bps uint u500)  ;; 5% default

(define-map vault-positions principal
  {
    deposited: uint,
    deposit-block: uint,
    last-yield-claim: uint,
    total-yield-earned: uint,
    pending-withdrawal: uint,
    withdrawal-requested-at: (optional uint)
  }
)

(define-map deposit-history uint
  {
    depositor: principal,
    amount: uint,
    block-height: uint,
    tx-type: (string-ascii 10)
  }
)

(define-data-var tx-count uint u0)

;; Read-only
(define-read-only (get-position (depositor principal))
  (map-get? vault-positions depositor)
)

(define-read-only (get-vault-stats)
  {
    total-deposits: (var-get total-deposits),
    total-withdrawals: (var-get total-withdrawals),
    depositor-count: (var-get depositor-count),
    yield-pool: (var-get yield-pool),
    apy-bps: (var-get apy-bps),
    vault-active: (var-get vault-active)
  }
)

(define-read-only (calculate-yield (depositor principal))
  (match (map-get? vault-positions depositor)
    pos
    (let (
      (blocks (- stacks-block-height (get last-yield-claim pos)))
      (annual (/ (* (get deposited pos) (var-get apy-bps)) u10000))
      (yield (/ (* annual blocks) u52596))
    )
      (ok yield)
    )
    err-not-found
  )
)

;; Public functions
(define-public (deposit (amount uint))
  (let ((tx-id (var-get tx-count)))
    (asserts! (var-get vault-active) err-vault-paused)
    (asserts! (>= amount MIN-DEPOSIT) err-min-deposit)

    (match (map-get? vault-positions tx-sender)
      pos
      (map-set vault-positions tx-sender (merge pos {
        deposited: (+ (get deposited pos) amount),
      }))
      (begin
        (map-set vault-positions tx-sender {
          deposited: amount,
          deposit-block: stacks-block-height,
          last-yield-claim: stacks-block-height,
          total-yield-earned: u0,
          pending-withdrawal: u0,
          withdrawal-requested-at: none
        })
        (var-set depositor-count (+ (var-get depositor-count) u1))
      )
    )

    (map-set deposit-history tx-id {
      depositor: tx-sender, amount: amount,
      block-height: stacks-block-height, tx-type: "deposit"
    })
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (var-set tx-count (+ tx-id u1))
    (ok { deposited: amount, tx-id: tx-id })
  )
)

(define-public (request-withdrawal (amount uint))
  (match (map-get? vault-positions tx-sender)
    pos
    (begin
      (asserts! (>= (get deposited pos) amount) err-insufficient-balance)
      (asserts! (is-none (get withdrawal-requested-at pos)) err-not-authorized)
      (map-set vault-positions tx-sender (merge pos {
        pending-withdrawal: amount,
        withdrawal-requested-at: (some stacks-block-height)
      }))
      (ok { requested: amount, available-at: (+ stacks-block-height WITHDRAWAL-DELAY) })
    )
    err-not-found
  )
)

(define-public (complete-withdrawal)
  (match (map-get? vault-positions tx-sender)
    pos
    (match (get withdrawal-requested-at pos)
      req-block
      (let ((amount (get pending-withdrawal pos)))
        (asserts! (>= stacks-block-height (+ req-block WITHDRAWAL-DELAY)) err-not-authorized)
        (map-set vault-positions tx-sender (merge pos {
          deposited: (- (get deposited pos) amount),
          pending-withdrawal: u0,
          withdrawal-requested-at: none
        }))
        (var-set total-withdrawals (+ (var-get total-withdrawals) amount))
        (ok { withdrawn: amount })
      )
      err-not-found
    )
    err-not-found
  )
)

(define-public (claim-yield)
  (match (map-get? vault-positions tx-sender)
    pos
    (let ((yield (unwrap! (calculate-yield tx-sender) err-not-found)))
      (asserts! (> yield u0) err-invalid-amount)
      (asserts! (<= yield (var-get yield-pool)) err-insufficient-balance)
      (map-set vault-positions tx-sender (merge pos {
        last-yield-claim: stacks-block-height,
        total-yield-earned: (+ (get total-yield-earned pos) yield)
      }))
      (var-set yield-pool (- (var-get yield-pool) yield))
      (ok { yield: yield })
    )
    err-not-found
  )
)

(define-public (set-apy-bps (new-apy uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set apy-bps new-apy)
    (ok new-apy)
  )
)
