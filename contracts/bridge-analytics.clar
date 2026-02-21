;; Bridge Analytics Contract
;; Aggregates and stores bridge usage statistics
;; Provides on-chain analytics for sBTC bridge operations

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u900))
(define-constant err-not-authorized (err u901))
(define-constant err-not-found (err u902))

(define-data-var analytics-count uint u0)
(define-data-var daily-record-count uint u0)
(define-data-var monthly-record-count uint u0)

(define-map authorized-reporters principal bool)

;; Daily bridge stats
(define-map daily-stats uint
  {
    date-block: uint,
    peg-in-count: uint,
    peg-out-count: uint,
    peg-in-volume-sats: uint,
    peg-out-volume-sats: uint,
    unique-users: uint,
    avg-tx-size-sats: uint,
    fees-collected-sats: uint,
    failed-count: uint,
    avg-confirmation-time: uint
  }
)

;; User stats
(define-map user-bridge-stats principal
  {
    total-peg-in: uint,
    total-peg-out: uint,
    total-volume-sats: uint,
    first-bridge: uint,
    last-bridge: uint,
    failed-count: uint
  }
)

;; Weekly aggregates
(define-map weekly-stats uint
  {
    week-start-block: uint,
    total-volume: uint,
    total-transactions: uint,
    new-users: uint,
    avg-daily-volume: uint
  }
)

(define-data-var weekly-count uint u0)

;; Cumulative totals
(define-data-var all-time-peg-in-volume uint u0)
(define-data-var all-time-peg-out-volume uint u0)
(define-data-var all-time-tx-count uint u0)
(define-data-var all-time-fees uint u0)
(define-data-var all-time-users uint u0)

;; Read-only
(define-read-only (get-daily-stats (day-id uint))
  (map-get? daily-stats day-id)
)

(define-read-only (get-user-stats (user principal))
  (map-get? user-bridge-stats user)
)

(define-read-only (get-weekly-stats (week-id uint))
  (map-get? weekly-stats week-id)
)

(define-read-only (get-all-time-stats)
  {
    total-peg-in-volume: (var-get all-time-peg-in-volume),
    total-peg-out-volume: (var-get all-time-peg-out-volume),
    total-transactions: (var-get all-time-tx-count),
    total-fees: (var-get all-time-fees),
    total-users: (var-get all-time-users)
  }
)

(define-read-only (is-reporter (r principal))
  (default-to false (map-get? authorized-reporters r))
)

;; Public functions
(define-public (add-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-reporters reporter true)
    (ok reporter)
  )
)

(define-public (record-daily-stats
    (peg-in-count uint)
    (peg-out-count uint)
    (peg-in-volume uint)
    (peg-out-volume uint)
    (unique-users uint)
    (fees-collected uint)
    (failed-count uint)
    (avg-confirmation-time uint))
  (let ((day-id (var-get daily-record-count)))
    (asserts! (is-reporter tx-sender) err-not-authorized)

    (map-set daily-stats day-id {
      date-block: stacks-block-height,
      peg-in-count: peg-in-count,
      peg-out-count: peg-out-count,
      peg-in-volume-sats: peg-in-volume,
      peg-out-volume-sats: peg-out-volume,
      unique-users: unique-users,
      avg-tx-size-sats: (if (> (+ peg-in-count peg-out-count) u0)
        (/ (+ peg-in-volume peg-out-volume) (+ peg-in-count peg-out-count))
        u0),
      fees-collected-sats: fees-collected,
      failed-count: failed-count,
      avg-confirmation-time: avg-confirmation-time
    })

    (var-set all-time-peg-in-volume (+ (var-get all-time-peg-in-volume) peg-in-volume))
    (var-set all-time-peg-out-volume (+ (var-get all-time-peg-out-volume) peg-out-volume))
    (var-set all-time-tx-count (+ (var-get all-time-tx-count) (+ peg-in-count peg-out-count)))
    (var-set all-time-fees (+ (var-get all-time-fees) fees-collected))
    (var-set daily-record-count (+ day-id u1))

    (ok { day-id: day-id, volume: (+ peg-in-volume peg-out-volume) })
  )
)

(define-public (update-user-stats
    (user principal)
    (peg-in-amount uint)
    (peg-out-amount uint)
    (is-new-user bool))
  (begin
    (asserts! (is-reporter tx-sender) err-not-authorized)

    (match (map-get? user-bridge-stats user)
      existing
      (map-set user-bridge-stats user (merge existing {
        total-peg-in: (+ (get total-peg-in existing) peg-in-amount),
        total-peg-out: (+ (get total-peg-out existing) peg-out-amount),
        total-volume-sats: (+ (get total-volume-sats existing) peg-in-amount peg-out-amount),
        last-bridge: stacks-block-height
      }))
      (begin
        (map-set user-bridge-stats user {
          total-peg-in: peg-in-amount,
          total-peg-out: peg-out-amount,
          total-volume-sats: (+ peg-in-amount peg-out-amount),
          first-bridge: stacks-block-height,
          last-bridge: stacks-block-height,
          failed-count: u0
        })
        (if is-new-user
          (var-set all-time-users (+ (var-get all-time-users) u1))
          false
        )
      )
    )
    (ok { user: user, updated: true })
  )
)

(define-public (record-weekly-summary
    (total-volume uint)
    (total-transactions uint)
    (new-users uint))
  (let ((week-id (var-get weekly-count)))
    (asserts! (is-reporter tx-sender) err-not-authorized)
    (map-set weekly-stats week-id {
      week-start-block: stacks-block-height,
      total-volume: total-volume,
      total-transactions: total-transactions,
      new-users: new-users,
      avg-daily-volume: (/ total-volume u7)
    })
    (var-set weekly-count (+ week-id u1))
    (ok week-id)
  )
)
