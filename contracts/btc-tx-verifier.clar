;; BTC Transaction Verifier Contract
;; Verifies and records Bitcoin transactions for sBTC bridge
;; Tracks confirmation status and double-spend protection

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u300))
(define-constant err-not-authorized (err u301))
(define-constant err-not-found (err u302))
(define-constant err-already-verified (err u303))
(define-constant err-insufficient-confirmations (err u304))
(define-constant err-double-spend (err u305))
(define-constant err-invalid-txid (err u306))

(define-constant REQUIRED-CONFIRMATIONS u6)
(define-constant TXID-LENGTH u64)

(define-data-var verifier-count uint u0)
(define-data-var verified-tx-count uint u0)
(define-data-var rejected-tx-count uint u0)

(define-map authorized-verifiers principal bool)

;; BTC transaction registry
(define-map btc-transactions (string-ascii 64)
  {
    txid: (string-ascii 64),
    amount-sats: uint,
    confirmations: uint,
    block-hash: (string-ascii 64),
    btc-block-height: uint,
    submitted-at: uint,
    verifier: principal,
    status: uint,  ;; 0=pending, 1=verified, 2=rejected
    stacks-recipient: (optional principal),
    processed: bool
  }
)

;; Double-spend protection - track used UTXOs
(define-map used-utxos (string-ascii 128) bool)

;; Verification history
(define-map verification-history uint
  {
    txid: (string-ascii 64),
    action: (string-ascii 20),
    verifier: principal,
    block-height: uint
  }
)

(define-data-var history-count uint u0)

;; Read-only
(define-read-only (get-btc-tx (txid (string-ascii 64)))
  (map-get? btc-transactions txid)
)

(define-read-only (is-txid-used (txid (string-ascii 64)))
  (is-some (map-get? btc-transactions txid))
)

(define-read-only (is-utxo-used (utxo-key (string-ascii 128)))
  (default-to false (map-get? used-utxos utxo-key))
)

(define-read-only (is-verifier (v principal))
  (default-to false (map-get? authorized-verifiers v))
)

(define-read-only (get-verified-count)
  (var-get verified-tx-count)
)

;; Public functions
(define-public (add-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-verifiers verifier true)
    (var-set verifier-count (+ (var-get verifier-count) u1))
    (ok verifier)
  )
)

(define-public (submit-btc-tx
    (txid (string-ascii 64))
    (amount-sats uint)
    (confirmations uint)
    (block-hash (string-ascii 64))
    (btc-block-height uint)
    (stacks-recipient (optional principal)))
  (begin
    (asserts! (is-verifier tx-sender) err-not-authorized)
    (asserts! (is-none (map-get? btc-transactions txid)) err-already-verified)
    (asserts! (> amount-sats u0) err-not-found)

    (map-set btc-transactions txid {
      txid: txid,
      amount-sats: amount-sats,
      confirmations: confirmations,
      block-hash: block-hash,
      btc-block-height: btc-block-height,
      submitted-at: stacks-block-height,
      verifier: tx-sender,
      status: (if (>= confirmations REQUIRED-CONFIRMATIONS) u1 u0),
      stacks-recipient: stacks-recipient,
      processed: false
    })

    (let ((hist-id (var-get history-count)))
      (map-set verification-history hist-id {
        txid: txid, action: "submitted",
        verifier: tx-sender, block-height: stacks-block-height
      })
      (var-set history-count (+ hist-id u1))
    )

    (if (>= confirmations REQUIRED-CONFIRMATIONS)
      (begin
        (var-set verified-tx-count (+ (var-get verified-tx-count) u1))
        (ok { txid: txid, status: "verified", confirmations: confirmations })
      )
      (ok { txid: txid, status: "pending", confirmations: confirmations })
    )
  )
)

(define-public (update-confirmations (txid (string-ascii 64)) (new-confirmations uint))
  (match (map-get? btc-transactions txid)
    tx-data
    (begin
      (asserts! (is-verifier tx-sender) err-not-authorized)
      (map-set btc-transactions txid (merge tx-data {
        confirmations: new-confirmations,
        status: (if (>= new-confirmations REQUIRED-CONFIRMATIONS) u1 u0)
      }))
      (if (and (>= new-confirmations REQUIRED-CONFIRMATIONS) (is-eq (get status tx-data) u0))
        (var-set verified-tx-count (+ (var-get verified-tx-count) u1))
        false
      )
      (ok { txid: txid, confirmations: new-confirmations })
    )
    err-not-found
  )
)

(define-public (mark-processed (txid (string-ascii 64)))
  (match (map-get? btc-transactions txid)
    tx-data
    (begin
      (asserts! (is-verifier tx-sender) err-not-authorized)
      (asserts! (is-eq (get status tx-data) u1) err-insufficient-confirmations)
      (map-set btc-transactions txid (merge tx-data { processed: true }))
      (ok { txid: txid, processed: true })
    )
    err-not-found
  )
)

(define-public (reject-tx (txid (string-ascii 64)) (reason (string-ascii 100)))
  (match (map-get? btc-transactions txid)
    tx-data
    (begin
      (asserts! (is-verifier tx-sender) err-not-authorized)
      (map-set btc-transactions txid (merge tx-data { status: u2 }))
      (var-set rejected-tx-count (+ (var-get rejected-tx-count) u1))
      (ok { txid: txid, rejected: true })
    )
    err-not-found
  )
)

(define-public (mark-utxo-used (utxo-key (string-ascii 128)))
  (begin
    (asserts! (is-verifier tx-sender) err-not-authorized)
    (asserts! (not (is-utxo-used utxo-key)) err-double-spend)
    (map-set used-utxos utxo-key true)
    (ok utxo-key)
  )
)
