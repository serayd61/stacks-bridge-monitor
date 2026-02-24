;; ============================================================================
;; Multi-Sig Treasury - Multi-Signature Fund Management
;; ============================================================================
;; Securely manages protocol treasury funds with multi-signature approval.
;; Requires M-of-N signers to approve transactions.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u8001))
(define-constant ERR-NOT-SIGNER (err u8002))
(define-constant ERR-ALREADY-SIGNED (err u8003))
(define-constant ERR-TX-NOT-FOUND (err u8004))
(define-constant ERR-TX-ALREADY-EXECUTED (err u8005))
(define-constant ERR-TX-EXPIRED (err u8006))
(define-constant ERR-THRESHOLD-NOT-MET (err u8007))
(define-constant ERR-INVALID-THRESHOLD (err u8008))
(define-constant ERR-SIGNER-EXISTS (err u8009))
(define-constant ERR-TOO-FEW-SIGNERS (err u8010))
(define-constant ERR-TX-CANCELLED (err u8011))
(define-constant ERR-INVALID-AMOUNT (err u8012))

;; Transaction expiry (~7 days in blocks)
(define-constant TX-EXPIRY u1008)

;; Data Variables
(define-data-var tx-nonce uint u0)
(define-data-var required-signatures uint u2) ;; M signatures required
(define-data-var signer-count uint u1) ;; N total signers
(define-data-var total-disbursed uint u0)
(define-data-var treasury-balance uint u0)

;; Signers
(define-map signers principal bool)

;; Treasury Transactions
(define-map treasury-txs
  uint
  {
    proposer: principal,
    recipient: principal,
    amount: uint,
    memo: (string-ascii 200),
    signatures: uint,
    executed: bool,
    cancelled: bool,
    created-at: uint,
    executed-at: uint
  }
)

;; Signature tracking
(define-map tx-signatures
  { tx-id: uint, signer: principal }
  bool
)

;; Spending limits per epoch (~1 day)
(define-map epoch-spending uint uint)
(define-data-var daily-spending-limit uint u100000000000) ;; 100k tokens

;; Initialize
(map-set signers CONTRACT-OWNER true)

;; ============================================================================
;; Deposit
;; ============================================================================

(define-public (deposit (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (var-set treasury-balance (+ (var-get treasury-balance) amount))
    (print {
      event: "deposit",
      depositor: tx-sender,
      amount: amount,
      new-balance: (var-get treasury-balance)
    })
    (ok true)
  )
)

;; ============================================================================
;; Propose Transaction
;; ============================================================================

(define-public (propose-transaction
    (recipient principal)
    (amount uint)
    (memo (string-ascii 200))
  )
  (let
    (
      (nonce (var-get tx-nonce))
    )
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (var-get treasury-balance)) ERR-INVALID-AMOUNT)

    ;; Create transaction
    (map-set treasury-txs nonce {
      proposer: tx-sender,
      recipient: recipient,
      amount: amount,
      memo: memo,
      signatures: u1,
      executed: false,
      cancelled: false,
      created-at: block-height,
      executed-at: u0
    })

    ;; Auto-sign by proposer
    (map-set tx-signatures { tx-id: nonce, signer: tx-sender } true)

    (var-set tx-nonce (+ nonce u1))

    (print {
      event: "tx-proposed",
      tx-id: nonce,
      proposer: tx-sender,
      recipient: recipient,
      amount: amount,
      memo: memo
    })

    (ok nonce)
  )
)

;; ============================================================================
;; Sign Transaction
;; ============================================================================

(define-public (sign-transaction (tx-id uint))
  (let
    (
      (tx (unwrap! (map-get? treasury-txs tx-id) ERR-TX-NOT-FOUND))
    )
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (not (get executed tx)) ERR-TX-ALREADY-EXECUTED)
    (asserts! (not (get cancelled tx)) ERR-TX-CANCELLED)
    (asserts! (<= block-height (+ (get created-at tx) TX-EXPIRY)) ERR-TX-EXPIRED)
    (asserts! (is-none (map-get? tx-signatures { tx-id: tx-id, signer: tx-sender }))
              ERR-ALREADY-SIGNED)

    ;; Add signature
    (map-set tx-signatures { tx-id: tx-id, signer: tx-sender } true)

    ;; Update signature count
    (map-set treasury-txs tx-id
      (merge tx { signatures: (+ (get signatures tx) u1) }))

    (print {
      event: "tx-signed",
      tx-id: tx-id,
      signer: tx-sender,
      total-signatures: (+ (get signatures tx) u1)
    })

    (ok (+ (get signatures tx) u1))
  )
)

;; ============================================================================
;; Execute Transaction
;; ============================================================================

(define-public (execute-transaction (tx-id uint))
  (let
    (
      (tx (unwrap! (map-get? treasury-txs tx-id) ERR-TX-NOT-FOUND))
      (current-epoch (/ block-height u144))
      (epoch-spent (default-to u0 (map-get? epoch-spending current-epoch)))
    )
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (not (get executed tx)) ERR-TX-ALREADY-EXECUTED)
    (asserts! (not (get cancelled tx)) ERR-TX-CANCELLED)
    (asserts! (<= block-height (+ (get created-at tx) TX-EXPIRY)) ERR-TX-EXPIRED)
    (asserts! (>= (get signatures tx) (var-get required-signatures)) ERR-THRESHOLD-NOT-MET)

    ;; Check daily spending limit
    (asserts! (<= (+ epoch-spent (get amount tx)) (var-get daily-spending-limit))
              ERR-INVALID-AMOUNT)

    ;; Mark as executed
    (map-set treasury-txs tx-id
      (merge tx { executed: true, executed-at: block-height }))

    ;; Update tracking
    (var-set total-disbursed (+ (var-get total-disbursed) (get amount tx)))
    (var-set treasury-balance (- (var-get treasury-balance) (get amount tx)))
    (map-set epoch-spending current-epoch (+ epoch-spent (get amount tx)))

    (print {
      event: "tx-executed",
      tx-id: tx-id,
      executor: tx-sender,
      recipient: (get recipient tx),
      amount: (get amount tx)
    })

    (ok true)
  )
)

;; ============================================================================
;; Cancel Transaction
;; ============================================================================

(define-public (cancel-transaction (tx-id uint))
  (let
    ((tx (unwrap! (map-get? treasury-txs tx-id) ERR-TX-NOT-FOUND)))
    (asserts! (or
      (is-eq tx-sender (get proposer tx))
      (is-eq tx-sender CONTRACT-OWNER))
      ERR-NOT-AUTHORIZED)
    (asserts! (not (get executed tx)) ERR-TX-ALREADY-EXECUTED)
    (ok (map-set treasury-txs tx-id (merge tx { cancelled: true })))
  )
)

;; ============================================================================
;; Signer Management
;; ============================================================================

(define-public (add-signer (new-signer principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (is-signer new-signer)) ERR-SIGNER-EXISTS)
    (map-set signers new-signer true)
    (var-set signer-count (+ (var-get signer-count) u1))
    (ok true)
  )
)

(define-public (remove-signer (signer principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-signer signer) ERR-NOT-SIGNER)
    (asserts! (> (var-get signer-count) (var-get required-signatures)) ERR-TOO-FEW-SIGNERS)
    (map-set signers signer false)
    (var-set signer-count (- (var-get signer-count) u1))
    (ok true)
  )
)

(define-public (set-required-signatures (threshold uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> threshold u0) ERR-INVALID-THRESHOLD)
    (asserts! (<= threshold (var-get signer-count)) ERR-INVALID-THRESHOLD)
    (ok (var-set required-signatures threshold))
  )
)

(define-public (set-daily-spending-limit (limit uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set daily-spending-limit limit))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-transaction (tx-id uint))
  (map-get? treasury-txs tx-id)
)

(define-read-only (has-signed (tx-id uint) (signer principal))
  (default-to false (map-get? tx-signatures { tx-id: tx-id, signer: signer }))
)

(define-read-only (is-signer (account principal))
  (default-to false (map-get? signers account))
)

(define-read-only (get-treasury-stats)
  {
    balance: (var-get treasury-balance),
    total-disbursed: (var-get total-disbursed),
    tx-count: (var-get tx-nonce),
    signer-count: (var-get signer-count),
    required-signatures: (var-get required-signatures),
    daily-limit: (var-get daily-spending-limit)
  }
)

(define-read-only (get-epoch-spent (epoch uint))
  (default-to u0 (map-get? epoch-spending epoch))
)

(define-read-only (get-remaining-daily-budget)
  (let
    (
      (current-epoch (/ block-height u144))
      (spent (default-to u0 (map-get? epoch-spending current-epoch)))
    )
    (- (var-get daily-spending-limit) spent)
  )
)
