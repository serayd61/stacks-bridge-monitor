;; Bridge Pause Guardian Contract
;; Emergency pause mechanism for sBTC bridge operations
;; Multi-party authorization required for pause/unpause

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u600))
(define-constant err-not-guardian (err u601))
(define-constant err-already-paused (err u602))
(define-constant err-not-paused (err u603))
(define-constant err-insufficient-votes (err u604))
(define-constant err-already-voted (err u605))
(define-constant err-not-found (err u606))

(define-constant PAUSE-THRESHOLD u2)    ;; 2 guardians required to pause
(define-constant UNPAUSE-THRESHOLD u3)  ;; 3 guardians required to unpause
(define-constant VOTE-EXPIRY u144)      ;; Votes expire after ~1 day

(define-data-var bridge-paused bool false)
(define-data-var pause-count uint u0)
(define-data-var guardian-count uint u0)
(define-data-var pause-vote-count uint u0)
(define-data-var unpause-vote-count uint u0)
(define-data-var last-pause-block uint u0)
(define-data-var pause-action-count uint u0)

(define-map guardians principal bool)

;; Active votes
(define-map pause-votes principal uint)    ;; guardian -> vote-block
(define-map unpause-votes principal uint)

;; Pause history
(define-map pause-history uint
  {
    action: (string-ascii 10),
    block-height: uint,
    initiator: principal,
    reason: (string-ascii 200),
    vote-count: uint
  }
)

;; Read-only
(define-read-only (is-bridge-paused)
  (var-get bridge-paused)
)

(define-read-only (is-guardian (g principal))
  (default-to false (map-get? guardians g))
)

(define-read-only (get-pause-vote-count)
  (var-get pause-vote-count)
)

(define-read-only (get-unpause-vote-count)
  (var-get unpause-vote-count)
)

(define-read-only (has-voted-pause (guardian principal))
  (match (map-get? pause-votes guardian)
    vote-block (<= (- stacks-block-height vote-block) VOTE-EXPIRY)
    false
  )
)

(define-read-only (has-voted-unpause (guardian principal))
  (match (map-get? unpause-votes guardian)
    vote-block (<= (- stacks-block-height vote-block) VOTE-EXPIRY)
    false
  )
)

(define-read-only (get-bridge-status)
  {
    paused: (var-get bridge-paused),
    pause-votes: (var-get pause-vote-count),
    unpause-votes: (var-get unpause-vote-count),
    guardian-count: (var-get guardian-count),
    last-pause-block: (var-get last-pause-block),
    total-pauses: (var-get pause-count)
  }
)

;; Public functions
(define-public (add-guardian (guardian principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set guardians guardian true)
    (var-set guardian-count (+ (var-get guardian-count) u1))
    (ok guardian)
  )
)

(define-public (remove-guardian (guardian principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set guardians guardian false)
    (var-set guardian-count (- (var-get guardian-count) u1))
    (ok guardian)
  )
)

(define-public (vote-to-pause (reason (string-ascii 200)))
  (begin
    (asserts! (is-guardian tx-sender) err-not-guardian)
    (asserts! (not (var-get bridge-paused)) err-already-paused)
    (asserts! (not (has-voted-pause tx-sender)) err-already-voted)

    (map-set pause-votes tx-sender stacks-block-height)
    (var-set pause-vote-count (+ (var-get pause-vote-count) u1))

    ;; Auto-pause if threshold met
    (if (>= (var-get pause-vote-count) PAUSE-THRESHOLD)
      (begin
        (var-set bridge-paused true)
        (var-set last-pause-block stacks-block-height)
        (var-set pause-vote-count u0)
        (let ((action-id (var-get pause-action-count)))
          (map-set pause-history action-id {
            action: "paused",
            block-height: stacks-block-height,
            initiator: tx-sender,
            reason: reason,
            vote-count: PAUSE-THRESHOLD
          })
          (var-set pause-action-count (+ action-id u1))
        )
        (var-set pause-count (+ (var-get pause-count) u1))
        (ok { bridge-paused: true, threshold-met: true })
      )
      (ok { bridge-paused: false, threshold-met: false })
    )
  )
)

(define-public (vote-to-unpause)
  (begin
    (asserts! (is-guardian tx-sender) err-not-guardian)
    (asserts! (var-get bridge-paused) err-not-paused)
    (asserts! (not (has-voted-unpause tx-sender)) err-already-voted)

    (map-set unpause-votes tx-sender stacks-block-height)
    (var-set unpause-vote-count (+ (var-get unpause-vote-count) u1))

    ;; Auto-unpause if threshold met
    (if (>= (var-get unpause-vote-count) UNPAUSE-THRESHOLD)
      (begin
        (var-set bridge-paused false)
        (var-set unpause-vote-count u0)
        (let ((action-id (var-get pause-action-count)))
          (map-set pause-history action-id {
            action: "unpaused",
            block-height: stacks-block-height,
            initiator: tx-sender,
            reason: "threshold-met",
            vote-count: UNPAUSE-THRESHOLD
          })
          (var-set pause-action-count (+ action-id u1))
        )
        (ok { bridge-unpaused: true, threshold-met: true })
      )
      (ok { bridge-unpaused: false, threshold-met: false })
    )
  )
)

(define-public (emergency-unpause (reason (string-ascii 200)))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set bridge-paused false)
    (var-set unpause-vote-count u0)
    (ok { bridge-unpaused: true, emergency: true })
  )
)
