;; ============================================================================
;; Timelock Controller - Time-Delayed Execution & Emergency Controls
;; ============================================================================
;; Enforces time delays on critical protocol operations and provides
;; emergency pause functionality for the entire bridge ecosystem.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u10001))
(define-constant ERR-OP-NOT-FOUND (err u10002))
(define-constant ERR-OP-ALREADY-EXISTS (err u10003))
(define-constant ERR-OP-NOT-READY (err u10004))
(define-constant ERR-OP-EXPIRED (err u10005))
(define-constant ERR-OP-ALREADY-EXECUTED (err u10006))
(define-constant ERR-OP-CANCELLED (err u10007))
(define-constant ERR-INVALID-DELAY (err u10008))
(define-constant ERR-NOT-GUARDIAN (err u10009))
(define-constant ERR-EMERGENCY-ACTIVE (err u10010))
(define-constant ERR-NO-EMERGENCY (err u10011))

;; Operation Statuses
(define-constant OP-PENDING u0)
(define-constant OP-READY u1)
(define-constant OP-EXECUTED u2)
(define-constant OP-CANCELLED u3)

;; Delay parameters (in blocks, ~10 min/block)
(define-constant MIN-DELAY u144) ;; ~1 day minimum
(define-constant MAX-DELAY u4320) ;; ~30 days maximum
(define-constant GRACE-PERIOD u432) ;; ~3 days to execute after ready

;; Data Variables
(define-data-var op-nonce uint u0)
(define-data-var default-delay uint u288) ;; ~2 days default
(define-data-var emergency-active bool false)
(define-data-var emergency-activated-at uint u0)
(define-data-var emergency-cooldown uint u4320) ;; ~30 days before can re-activate
(define-data-var last-emergency-end uint u0)
(define-data-var total-operations uint u0)
(define-data-var total-executed uint u0)

;; Guardians (can trigger emergency)
(define-map guardians principal bool)

;; Proposers (can queue operations)
(define-map proposers principal bool)

;; Executors (can execute ready operations)
(define-map executors principal bool)

;; Timelocked Operations
(define-map operations
  uint
  {
    proposer: principal,
    target-contract: principal,
    operation-type: (string-ascii 50),
    description: (string-ascii 200),
    data-hash: (buff 32),
    delay: uint,
    queued-at: uint,
    ready-at: uint,
    expires-at: uint,
    status: uint,
    executed-at: uint,
    executed-by: (optional principal)
  }
)

;; Emergency Logs
(define-map emergency-log
  uint
  {
    activated-by: principal,
    reason: (string-ascii 200),
    activated-at: uint,
    deactivated-at: uint
  }
)
(define-data-var emergency-log-count uint u0)

;; Initialize roles
(map-set guardians CONTRACT-OWNER true)
(map-set proposers CONTRACT-OWNER true)
(map-set executors CONTRACT-OWNER true)

;; ============================================================================
;; Queue Operation
;; ============================================================================

(define-public (queue-operation
    (target-contract principal)
    (operation-type (string-ascii 50))
    (description (string-ascii 200))
    (data-hash (buff 32))
    (delay uint)
  )
  (let
    (
      (nonce (var-get op-nonce))
      (actual-delay (if (< delay (var-get default-delay))
                      (var-get default-delay)
                      delay))
      (ready-at (+ block-height actual-delay))
      (expires-at (+ ready-at GRACE-PERIOD))
    )
    (asserts! (is-proposer tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get emergency-active)) ERR-EMERGENCY-ACTIVE)
    (asserts! (>= actual-delay MIN-DELAY) ERR-INVALID-DELAY)
    (asserts! (<= actual-delay MAX-DELAY) ERR-INVALID-DELAY)

    (map-set operations nonce {
      proposer: tx-sender,
      target-contract: target-contract,
      operation-type: operation-type,
      description: description,
      data-hash: data-hash,
      delay: actual-delay,
      queued-at: block-height,
      ready-at: ready-at,
      expires-at: expires-at,
      status: OP-PENDING,
      executed-at: u0,
      executed-by: none
    })

    (var-set op-nonce (+ nonce u1))
    (var-set total-operations (+ (var-get total-operations) u1))

    (print {
      event: "operation-queued",
      op-id: nonce,
      proposer: tx-sender,
      target: target-contract,
      type: operation-type,
      ready-at: ready-at,
      expires-at: expires-at
    })

    (ok nonce)
  )
)

;; ============================================================================
;; Execute Operation
;; ============================================================================

(define-public (execute-operation (op-id uint))
  (let
    (
      (op (unwrap! (map-get? operations op-id) ERR-OP-NOT-FOUND))
    )
    (asserts! (is-executor tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get emergency-active)) ERR-EMERGENCY-ACTIVE)
    (asserts! (is-eq (get status op) OP-PENDING) ERR-OP-ALREADY-EXECUTED)
    (asserts! (>= block-height (get ready-at op)) ERR-OP-NOT-READY)
    (asserts! (<= block-height (get expires-at op)) ERR-OP-EXPIRED)

    (map-set operations op-id
      (merge op {
        status: OP-EXECUTED,
        executed-at: block-height,
        executed-by: (some tx-sender)
      }))

    (var-set total-executed (+ (var-get total-executed) u1))

    (print {
      event: "operation-executed",
      op-id: op-id,
      executor: tx-sender,
      target: (get target-contract op),
      type: (get operation-type op),
      block: block-height
    })

    (ok true)
  )
)

;; ============================================================================
;; Cancel Operation
;; ============================================================================

(define-public (cancel-operation (op-id uint))
  (let
    ((op (unwrap! (map-get? operations op-id) ERR-OP-NOT-FOUND)))
    (asserts! (or
      (is-eq tx-sender (get proposer op))
      (is-guardian tx-sender)
      (is-eq tx-sender CONTRACT-OWNER))
      ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status op) OP-PENDING) ERR-OP-ALREADY-EXECUTED)

    (map-set operations op-id (merge op { status: OP-CANCELLED }))

    (print { event: "operation-cancelled", op-id: op-id, cancelled-by: tx-sender })
    (ok true)
  )
)

;; ============================================================================
;; Emergency Controls
;; ============================================================================

(define-public (activate-emergency (reason (string-ascii 200)))
  (let
    ((log-id (var-get emergency-log-count)))
    (asserts! (is-guardian tx-sender) ERR-NOT-GUARDIAN)
    (asserts! (not (var-get emergency-active)) ERR-EMERGENCY-ACTIVE)
    ;; Check cooldown since last emergency
    (asserts! (>= block-height (+ (var-get last-emergency-end) (var-get emergency-cooldown)))
              ERR-EMERGENCY-ACTIVE)

    (var-set emergency-active true)
    (var-set emergency-activated-at block-height)

    (map-set emergency-log log-id {
      activated-by: tx-sender,
      reason: reason,
      activated-at: block-height,
      deactivated-at: u0
    })
    (var-set emergency-log-count (+ log-id u1))

    (print {
      event: "emergency-activated",
      guardian: tx-sender,
      reason: reason,
      block: block-height
    })

    (ok true)
  )
)

(define-public (deactivate-emergency)
  (let
    ((log-id (- (var-get emergency-log-count) u1)))
    (asserts! (or (is-guardian tx-sender) (is-eq tx-sender CONTRACT-OWNER)) ERR-NOT-AUTHORIZED)
    (asserts! (var-get emergency-active) ERR-NO-EMERGENCY)

    (var-set emergency-active false)
    (var-set last-emergency-end block-height)

    ;; Update log
    (match (map-get? emergency-log log-id)
      log-entry
        (map-set emergency-log log-id
          (merge log-entry { deactivated-at: block-height }))
      true
    )

    (print {
      event: "emergency-deactivated",
      deactivated-by: tx-sender,
      duration-blocks: (- block-height (var-get emergency-activated-at))
    })

    (ok true)
  )
)

;; ============================================================================
;; Role Management
;; ============================================================================

(define-public (set-guardian (account principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set guardians account enabled))
  )
)

(define-public (set-proposer (account principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set proposers account enabled))
  )
)

(define-public (set-executor (account principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set executors account enabled))
  )
)

(define-public (set-default-delay (delay uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (>= delay MIN-DELAY) ERR-INVALID-DELAY)
    (asserts! (<= delay MAX-DELAY) ERR-INVALID-DELAY)
    (ok (var-set default-delay delay))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-operation (op-id uint))
  (map-get? operations op-id)
)

(define-read-only (is-operation-ready (op-id uint))
  (match (map-get? operations op-id)
    op (and
      (is-eq (get status op) OP-PENDING)
      (>= block-height (get ready-at op))
      (<= block-height (get expires-at op)))
    false
  )
)

(define-read-only (get-operation-status (op-id uint))
  (match (map-get? operations op-id)
    op
      (if (is-eq (get status op) OP-EXECUTED) "executed"
        (if (is-eq (get status op) OP-CANCELLED) "cancelled"
          (if (> block-height (get expires-at op)) "expired"
            (if (>= block-height (get ready-at op)) "ready"
              "pending"))))
    "not-found"
  )
)

(define-read-only (is-guardian (account principal))
  (default-to false (map-get? guardians account))
)

(define-read-only (is-proposer (account principal))
  (default-to false (map-get? proposers account))
)

(define-read-only (is-executor (account principal))
  (default-to false (map-get? executors account))
)

(define-read-only (is-emergency)
  (var-get emergency-active)
)

(define-read-only (get-timelock-stats)
  {
    total-operations: (var-get total-operations),
    total-executed: (var-get total-executed),
    default-delay: (var-get default-delay),
    emergency-active: (var-get emergency-active),
    emergency-activated-at: (var-get emergency-activated-at),
    current-nonce: (var-get op-nonce)
  }
)

(define-read-only (get-emergency-log-entry (log-id uint))
  (map-get? emergency-log log-id)
)

(define-read-only (get-time-until-ready (op-id uint))
  (match (map-get? operations op-id)
    op
      (if (>= block-height (get ready-at op))
        u0
        (- (get ready-at op) block-height))
    u0
  )
)
