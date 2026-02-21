;; Crosschain Message Verifier Contract
;; Verifies and relays messages between Bitcoin and Stacks layers
;; Used for bridge communication and state synchronization

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u700))
(define-constant err-not-authorized (err u701))
(define-constant err-not-found (err u702))
(define-constant err-already-processed (err u703))
(define-constant err-invalid-signature (err u704))
(define-constant err-message-expired (err u705))

(define-constant MESSAGE-EXPIRY-BLOCKS u1008) ;; ~7 days
(define-constant MIN-RELAYER-STAKE u100000000) ;; 100 STX stake

(define-data-var message-count uint u0)
(define-data-var relayer-count uint u0)
(define-data-var processed-count uint u0)

(define-map authorized-relayers principal
  { stake: uint, messages-relayed: uint, active: bool }
)

;; Messages
(define-map messages uint
  {
    message-hash: (string-ascii 64),
    source-chain: (string-ascii 20),
    target-chain: (string-ascii 20),
    sender: (string-ascii 62),
    recipient: principal,
    payload: (string-ascii 500),
    nonce: uint,
    submitted-at: uint,
    expires-at: uint,
    relayer: principal,
    processed: bool,
    status: uint  ;; 0=pending, 1=processed, 2=failed
  }
)

;; Nonce tracking (prevent replay)
(define-map used-nonces (string-ascii 64) bool)

;; Read-only
(define-read-only (get-message (message-id uint))
  (map-get? messages message-id)
)

(define-read-only (is-nonce-used (nonce-key (string-ascii 64)))
  (default-to false (map-get? used-nonces nonce-key))
)

(define-read-only (get-relayer (relayer principal))
  (map-get? authorized-relayers relayer)
)

(define-read-only (get-stats)
  {
    total-messages: (var-get message-count),
    processed: (var-get processed-count),
    relayers: (var-get relayer-count)
  }
)

;; Public functions
(define-public (register-relayer)
  (begin
    (asserts! (>= (stx-get-balance tx-sender) MIN-RELAYER-STAKE) err-not-authorized)
    (try! (stx-transfer? MIN-RELAYER-STAKE tx-sender (as-contract tx-sender)))
    (map-set authorized-relayers tx-sender {
      stake: MIN-RELAYER-STAKE,
      messages-relayed: u0,
      active: true
    })
    (var-set relayer-count (+ (var-get relayer-count) u1))
    (ok { relayer: tx-sender, stake: MIN-RELAYER-STAKE })
  )
)

(define-public (deregister-relayer)
  (match (map-get? authorized-relayers tx-sender)
    relayer
    (begin
      (try! (as-contract (stx-transfer? (get stake relayer) tx-sender tx-sender)))
      (map-set authorized-relayers tx-sender (merge relayer { active: false, stake: u0 }))
      (ok { unstaked: (get stake relayer) })
    )
    err-not-found
  )
)

(define-public (submit-message
    (message-hash (string-ascii 64))
    (source-chain (string-ascii 20))
    (target-chain (string-ascii 20))
    (sender (string-ascii 62))
    (recipient principal)
    (payload (string-ascii 500))
    (nonce uint))
  (let (
    (message-id (var-get message-count))
    (nonce-key message-hash)
  )
    (asserts!
      (match (map-get? authorized-relayers tx-sender)
        r (get active r)
        false)
      err-not-authorized)
    (asserts! (not (is-nonce-used nonce-key)) err-already-processed)

    (map-set messages message-id {
      message-hash: message-hash,
      source-chain: source-chain,
      target-chain: target-chain,
      sender: sender,
      recipient: recipient,
      payload: payload,
      nonce: nonce,
      submitted-at: stacks-block-height,
      expires-at: (+ stacks-block-height MESSAGE-EXPIRY-BLOCKS),
      relayer: tx-sender,
      processed: false,
      status: u0
    })

    (map-set used-nonces nonce-key true)
    (var-set message-count (+ message-id u1))

    (ok { message-id: message-id, hash: message-hash })
  )
)

(define-public (process-message (message-id uint))
  (match (map-get? messages message-id)
    msg
    (begin
      (asserts! (is-eq tx-sender contract-owner) err-owner-only)
      (asserts! (not (get processed msg)) err-already-processed)
      (asserts! (<= stacks-block-height (get expires-at msg)) err-message-expired)

      (map-set messages message-id (merge msg { processed: true, status: u1 }))

      (match (map-get? authorized-relayers (get relayer msg))
        relayer
        (map-set authorized-relayers (get relayer msg)
          (merge relayer { messages-relayed: (+ (get messages-relayed relayer) u1) }))
        false
      )

      (var-set processed-count (+ (var-get processed-count) u1))
      (ok { message-id: message-id, processed: true })
    )
    err-not-found
  )
)

(define-public (fail-message (message-id uint) (reason (string-ascii 100)))
  (match (map-get? messages message-id)
    msg
    (begin
      (asserts! (is-eq tx-sender contract-owner) err-owner-only)
      (asserts! (not (get processed msg)) err-already-processed)
      (map-set messages message-id (merge msg { status: u2 }))
      (ok { message-id: message-id, failed: true })
    )
    err-not-found
  )
)
