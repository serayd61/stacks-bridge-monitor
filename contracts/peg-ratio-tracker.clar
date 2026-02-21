;; Peg Ratio Tracker Contract
;; Monitors sBTC/BTC peg ratio and detects de-pegging events
;; Alerts when ratio deviates beyond acceptable thresholds

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u500))
(define-constant err-not-authorized (err u501))
(define-constant err-invalid-ratio (err u502))
(define-constant err-not-found (err u503))

;; Perfect peg = 1,000,000 (1.0 with 6 decimal precision)
(define-constant PERFECT-PEG u1000000)
;; Alert if deviation > 1% (10000 basis points = 1%)
(define-constant DEPEG-THRESHOLD-BPS u100)

(define-data-var current-ratio uint PERFECT-PEG)
(define-data-var last-update uint u0)
(define-data-var depeg-count uint u0)
(define-data-var snapshot-count uint u0)
(define-data-var tracker-active bool true)

(define-map authorized-updaters principal bool)

;; Ratio snapshots
(define-map ratio-snapshots uint
  {
    ratio: uint,
    sbtc-supply: uint,
    btc-reserve: uint,
    deviation-bps: uint,
    block-height: uint,
    updater: principal,
    is-depegged: bool
  }
)

;; Depeg events
(define-map depeg-events uint
  {
    ratio-at-depeg: uint,
    deviation-bps: uint,
    block-height: uint,
    resolved: bool,
    resolved-at: (optional uint),
    max-deviation: uint
  }
)

;; Read-only
(define-read-only (get-current-ratio)
  (var-get current-ratio)
)

(define-read-only (get-snapshot (snapshot-id uint))
  (map-get? ratio-snapshots snapshot-id)
)

(define-read-only (get-depeg-event (event-id uint))
  (map-get? depeg-events event-id)
)

(define-read-only (calculate-deviation-bps (ratio uint))
  (if (>= ratio PERFECT-PEG)
    (/ (* (- ratio PERFECT-PEG) u10000) PERFECT-PEG)
    (/ (* (- PERFECT-PEG ratio) u10000) PERFECT-PEG)
  )
)

(define-read-only (is-depegged (ratio uint))
  (> (calculate-deviation-bps ratio) DEPEG-THRESHOLD-BPS)
)

(define-read-only (get-peg-health)
  {
    ratio: (var-get current-ratio),
    deviation-bps: (calculate-deviation-bps (var-get current-ratio)),
    is-depegged: (is-depegged (var-get current-ratio)),
    depeg-events: (var-get depeg-count),
    last-update: (var-get last-update)
  }
)

;; Public functions
(define-public (add-updater (updater principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-updaters updater true)
    (ok updater)
  )
)

(define-public (update-ratio (new-ratio uint) (sbtc-supply uint) (btc-reserve uint))
  (let (
    (snapshot-id (var-get snapshot-count))
    (deviation (calculate-deviation-bps new-ratio))
    (depegged (> deviation DEPEG-THRESHOLD-BPS))
  )
    (asserts! (default-to false (map-get? authorized-updaters tx-sender)) err-not-authorized)
    (asserts! (> new-ratio u0) err-invalid-ratio)

    (map-set ratio-snapshots snapshot-id {
      ratio: new-ratio,
      sbtc-supply: sbtc-supply,
      btc-reserve: btc-reserve,
      deviation-bps: deviation,
      block-height: stacks-block-height,
      updater: tx-sender,
      is-depegged: depegged
    })

    (var-set current-ratio new-ratio)
    (var-set last-update stacks-block-height)
    (var-set snapshot-count (+ snapshot-id u1))

    ;; Record depeg event if threshold exceeded
    (if depegged
      (let ((event-id (var-get depeg-count)))
        (map-set depeg-events event-id {
          ratio-at-depeg: new-ratio,
          deviation-bps: deviation,
          block-height: stacks-block-height,
          resolved: false,
          resolved-at: none,
          max-deviation: deviation
        })
        (var-set depeg-count (+ event-id u1))
        (ok { ratio: new-ratio, deviation-bps: deviation, depeg-detected: true, event-id: event-id })
      )
      (ok { ratio: new-ratio, deviation-bps: deviation, depeg-detected: false, event-id: u0 })
    )
  )
)

(define-public (resolve-depeg-event (event-id uint))
  (match (map-get? depeg-events event-id)
    event
    (begin
      (asserts! (default-to false (map-get? authorized-updaters tx-sender)) err-not-authorized)
      (map-set depeg-events event-id (merge event {
        resolved: true,
        resolved-at: (some stacks-block-height)
      }))
      (ok { event-id: event-id, resolved: true })
    )
    err-not-found
  )
)
