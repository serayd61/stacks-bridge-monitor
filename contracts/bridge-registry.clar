;; ============================================================================
;; Bridge Registry - Cross-Chain Bridge Registration & Management
;; ============================================================================
;; Manages bridge operations: peg-in (lock BTC -> mint tokens) and
;; peg-out (burn tokens -> release BTC). Tracks all bridge transactions.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u2001))
(define-constant ERR-BRIDGE-NOT-FOUND (err u2002))
(define-constant ERR-BRIDGE-ALREADY-EXISTS (err u2003))
(define-constant ERR-INVALID-STATUS (err u2004))
(define-constant ERR-BRIDGE-PAUSED (err u2005))
(define-constant ERR-INVALID-AMOUNT (err u2006))
(define-constant ERR-TX-ALREADY-PROCESSED (err u2007))
(define-constant ERR-INVALID-CHAIN (err u2008))

;; Bridge Transaction Statuses
(define-constant STATUS-PENDING u0)
(define-constant STATUS-CONFIRMED u1)
(define-constant STATUS-COMPLETED u2)
(define-constant STATUS-FAILED u3)
(define-constant STATUS-REFUNDED u4)

;; Supported Chains
(define-constant CHAIN-BITCOIN u1)
(define-constant CHAIN-ETHEREUM u2)
(define-constant CHAIN-STACKS u3)

;; Data Variables
(define-data-var bridge-nonce uint u0)
(define-data-var total-peg-ins uint u0)
(define-data-var total-peg-outs uint u0)
(define-data-var total-volume uint u0)
(define-data-var bridge-paused bool false)
(define-data-var min-bridge-amount uint u100000) ;; 0.1 token with 6 decimals
(define-data-var max-bridge-amount uint u100000000000) ;; 100k tokens

;; Bridge Operators
(define-map bridge-operators principal bool)

;; Bridge Transactions
(define-map bridge-transactions
  uint
  {
    sender: principal,
    recipient: (buff 128),
    amount: uint,
    fee: uint,
    source-chain: uint,
    dest-chain: uint,
    status: uint,
    btc-txid: (optional (buff 32)),
    created-at: uint,
    updated-at: uint
  }
)

;; Track processed Bitcoin TXIDs to prevent double-processing
(define-map processed-btc-txids (buff 32) bool)

;; User bridge history (user -> list of tx nonces)
(define-map user-bridge-count principal uint)

;; Daily volume tracking
(define-map daily-volume uint uint)

;; Initialize
(map-set bridge-operators CONTRACT-OWNER true)

;; ============================================================================
;; Peg-In: Lock BTC on Bitcoin -> Mint tokens on Stacks
;; ============================================================================

(define-public (initiate-peg-in
    (amount uint)
    (btc-txid (buff 32))
    (recipient principal)
  )
  (let
    (
      (nonce (var-get bridge-nonce))
      (fee (calculate-fee amount))
      (net-amount (- amount fee))
    )
    (asserts! (is-bridge-operator tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get bridge-paused)) ERR-BRIDGE-PAUSED)
    (asserts! (>= amount (var-get min-bridge-amount)) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (var-get max-bridge-amount)) ERR-INVALID-AMOUNT)
    (asserts! (is-none (map-get? processed-btc-txids btc-txid)) ERR-TX-ALREADY-PROCESSED)

    ;; Record the transaction
    (map-set bridge-transactions nonce {
      sender: tx-sender,
      recipient: (unwrap-panic (to-consensus-buff? recipient)),
      amount: amount,
      fee: fee,
      source-chain: CHAIN-BITCOIN,
      dest-chain: CHAIN-STACKS,
      status: STATUS-PENDING,
      btc-txid: (some btc-txid),
      created-at: block-height,
      updated-at: block-height
    })

    ;; Mark BTC TXID as processed
    (map-set processed-btc-txids btc-txid true)

    ;; Update counters
    (var-set bridge-nonce (+ nonce u1))
    (var-set total-peg-ins (+ (var-get total-peg-ins) u1))
    (var-set total-volume (+ (var-get total-volume) amount))
    (map-set user-bridge-count recipient
      (+ (default-to u0 (map-get? user-bridge-count recipient)) u1))

    (print {
      event: "peg-in-initiated",
      nonce: nonce,
      amount: amount,
      fee: fee,
      btc-txid: btc-txid,
      recipient: recipient
    })

    (ok nonce)
  )
)

;; ============================================================================
;; Peg-Out: Burn tokens on Stacks -> Release BTC on Bitcoin
;; ============================================================================

(define-public (initiate-peg-out
    (amount uint)
    (btc-recipient (buff 128))
  )
  (let
    (
      (nonce (var-get bridge-nonce))
      (fee (calculate-fee amount))
    )
    (asserts! (not (var-get bridge-paused)) ERR-BRIDGE-PAUSED)
    (asserts! (>= amount (var-get min-bridge-amount)) ERR-INVALID-AMOUNT)
    (asserts! (<= amount (var-get max-bridge-amount)) ERR-INVALID-AMOUNT)

    ;; Record the transaction
    (map-set bridge-transactions nonce {
      sender: tx-sender,
      recipient: btc-recipient,
      amount: amount,
      fee: fee,
      source-chain: CHAIN-STACKS,
      dest-chain: CHAIN-BITCOIN,
      status: STATUS-PENDING,
      btc-txid: none,
      created-at: block-height,
      updated-at: block-height
    })

    ;; Update counters
    (var-set bridge-nonce (+ nonce u1))
    (var-set total-peg-outs (+ (var-get total-peg-outs) u1))
    (var-set total-volume (+ (var-get total-volume) amount))
    (map-set user-bridge-count tx-sender
      (+ (default-to u0 (map-get? user-bridge-count tx-sender)) u1))

    (print {
      event: "peg-out-initiated",
      nonce: nonce,
      amount: amount,
      fee: fee,
      sender: tx-sender,
      btc-recipient: btc-recipient
    })

    (ok nonce)
  )
)

;; ============================================================================
;; Transaction Status Updates
;; ============================================================================

(define-public (confirm-transaction (nonce uint))
  (let
    ((tx (unwrap! (map-get? bridge-transactions nonce) ERR-BRIDGE-NOT-FOUND)))
    (asserts! (is-bridge-operator tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status tx) STATUS-PENDING) ERR-INVALID-STATUS)
    (ok (map-set bridge-transactions nonce
      (merge tx { status: STATUS-CONFIRMED, updated-at: block-height })))
  )
)

(define-public (complete-transaction (nonce uint))
  (let
    ((tx (unwrap! (map-get? bridge-transactions nonce) ERR-BRIDGE-NOT-FOUND)))
    (asserts! (is-bridge-operator tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status tx) STATUS-CONFIRMED) ERR-INVALID-STATUS)
    (ok (map-set bridge-transactions nonce
      (merge tx { status: STATUS-COMPLETED, updated-at: block-height })))
  )
)

(define-public (fail-transaction (nonce uint))
  (let
    ((tx (unwrap! (map-get? bridge-transactions nonce) ERR-BRIDGE-NOT-FOUND)))
    (asserts! (is-bridge-operator tx-sender) ERR-NOT-AUTHORIZED)
    (ok (map-set bridge-transactions nonce
      (merge tx { status: STATUS-FAILED, updated-at: block-height })))
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-bridge-operator (operator principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set bridge-operators operator enabled))
  )
)

(define-public (toggle-bridge-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set bridge-paused (not (var-get bridge-paused))))
  )
)

(define-public (set-min-bridge-amount (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (ok (var-set min-bridge-amount amount))
  )
)

(define-public (set-max-bridge-amount (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (ok (var-set max-bridge-amount amount))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-transaction (nonce uint))
  (map-get? bridge-transactions nonce)
)

(define-read-only (get-bridge-stats)
  {
    total-peg-ins: (var-get total-peg-ins),
    total-peg-outs: (var-get total-peg-outs),
    total-volume: (var-get total-volume),
    bridge-nonce: (var-get bridge-nonce),
    is-paused: (var-get bridge-paused)
  }
)

(define-read-only (get-user-bridge-count (user principal))
  (default-to u0 (map-get? user-bridge-count user))
)

(define-read-only (is-bridge-operator (account principal))
  (default-to false (map-get? bridge-operators account))
)

(define-read-only (is-btc-txid-processed (txid (buff 32)))
  (default-to false (map-get? processed-btc-txids txid))
)

(define-read-only (calculate-fee (amount uint))
  (/ (* amount u25) u10000) ;; 0.25% fee
)

(define-read-only (is-paused)
  (var-get bridge-paused)
)
