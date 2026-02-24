;; ============================================================================
;; Oracle - Price Feed & Data Oracle
;; ============================================================================
;; Decentralized price oracle for BTC/STX/BRIDGE prices.
;; Multiple authorized reporters submit prices, median is used.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u7001))
(define-constant ERR-STALE-PRICE (err u7002))
(define-constant ERR-INVALID-PRICE (err u7003))
(define-constant ERR-FEED-NOT-FOUND (err u7004))
(define-constant ERR-REPORTER-EXISTS (err u7005))
(define-constant ERR-NOT-REPORTER (err u7006))
(define-constant ERR-TOO-FEW-REPORTERS (err u7007))
(define-constant ERR-DEVIATION-TOO-HIGH (err u7008))
(define-constant ERR-ORACLE-PAUSED (err u7009))

;; Staleness threshold (blocks)
(define-constant MAX-STALENESS u72) ;; ~12 hours

;; Maximum price deviation (30%)
(define-constant MAX-DEVIATION-BPS u3000)
(define-constant BPS-DENOMINATOR u10000)

;; Price Feed IDs
(define-constant FEED-BTC-USD u1)
(define-constant FEED-STX-USD u2)
(define-constant FEED-BRIDGE-USD u3)
(define-constant FEED-BTC-STX u4)
(define-constant FEED-BRIDGE-STX u5)

;; Data Variables
(define-data-var oracle-paused bool false)
(define-data-var min-reporters uint u1)
(define-data-var reporter-count uint u0)

;; Price Feeds
(define-map price-feeds
  uint ;; feed-id
  {
    price: uint,
    decimals: uint,
    last-updated: uint,
    reporter: principal,
    description: (string-ascii 50)
  }
)

;; Historical Prices (feed-id, block) -> price
(define-map price-history
  { feed-id: uint, block: uint }
  uint
)

;; Authorized Reporters
(define-map reporters principal bool)

;; Reporter submissions for aggregation
(define-map reporter-submissions
  { feed-id: uint, reporter: principal }
  { price: uint, block: uint }
)

;; TWAP (Time-Weighted Average Price)
(define-map twap-accumulators
  uint ;; feed-id
  {
    cumulative-price: uint,
    last-block: uint,
    last-price: uint
  }
)

;; Initialize owner as reporter
(map-set reporters CONTRACT-OWNER true)

;; Initialize price feeds metadata
(map-set price-feeds FEED-BTC-USD { price: u0, decimals: u8, last-updated: u0, reporter: CONTRACT-OWNER, description: "BTC/USD" })
(map-set price-feeds FEED-STX-USD { price: u0, decimals: u8, last-updated: u0, reporter: CONTRACT-OWNER, description: "STX/USD" })
(map-set price-feeds FEED-BRIDGE-USD { price: u0, decimals: u8, last-updated: u0, reporter: CONTRACT-OWNER, description: "BRIDGE/USD" })
(map-set price-feeds FEED-BTC-STX { price: u0, decimals: u8, last-updated: u0, reporter: CONTRACT-OWNER, description: "BTC/STX" })
(map-set price-feeds FEED-BRIDGE-STX { price: u0, decimals: u8, last-updated: u0, reporter: CONTRACT-OWNER, description: "BRIDGE/STX" })

;; ============================================================================
;; Price Submission
;; ============================================================================

(define-public (submit-price (feed-id uint) (price uint))
  (let
    (
      (feed (unwrap! (map-get? price-feeds feed-id) ERR-FEED-NOT-FOUND))
      (current-price (get price feed))
    )
    (asserts! (not (var-get oracle-paused)) ERR-ORACLE-PAUSED)
    (asserts! (is-reporter tx-sender) ERR-NOT-REPORTER)
    (asserts! (> price u0) ERR-INVALID-PRICE)

    ;; Check deviation if we have an existing price
    (if (> current-price u0)
      (asserts! (check-deviation current-price price) ERR-DEVIATION-TOO-HIGH)
      true
    )

    ;; Update TWAP accumulator
    (update-twap feed-id price)

    ;; Store submission
    (map-set reporter-submissions
      { feed-id: feed-id, reporter: tx-sender }
      { price: price, block: block-height })

    ;; Update feed
    (map-set price-feeds feed-id
      (merge feed {
        price: price,
        last-updated: block-height,
        reporter: tx-sender
      }))

    ;; Store in history
    (map-set price-history
      { feed-id: feed-id, block: block-height }
      price)

    (print {
      event: "price-submitted",
      feed-id: feed-id,
      price: price,
      reporter: tx-sender,
      block: block-height
    })

    (ok true)
  )
)

;; ============================================================================
;; TWAP
;; ============================================================================

(define-private (update-twap (feed-id uint) (new-price uint))
  (let
    (
      (acc (default-to
        { cumulative-price: u0, last-block: block-height, last-price: u0 }
        (map-get? twap-accumulators feed-id)))
      (time-elapsed (- block-height (get last-block acc)))
      (price-contribution (* (get last-price acc) time-elapsed))
    )
    (map-set twap-accumulators feed-id {
      cumulative-price: (+ (get cumulative-price acc) price-contribution),
      last-block: block-height,
      last-price: new-price
    })
    true
  )
)

;; ============================================================================
;; Reporter Management
;; ============================================================================

(define-public (add-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (is-reporter reporter)) ERR-REPORTER-EXISTS)
    (map-set reporters reporter true)
    (var-set reporter-count (+ (var-get reporter-count) u1))
    (ok true)
  )
)

(define-public (remove-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-reporter reporter) ERR-NOT-REPORTER)
    (map-set reporters reporter false)
    (var-set reporter-count (- (var-get reporter-count) u1))
    (ok true)
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-price (feed-id uint))
  (match (map-get? price-feeds feed-id)
    feed
      (begin
        (asserts! (<= (- block-height (get last-updated feed)) MAX-STALENESS) ERR-STALE-PRICE)
        (ok (get price feed))
      )
    ERR-FEED-NOT-FOUND
  )
)

(define-read-only (get-price-unsafe (feed-id uint))
  (match (map-get? price-feeds feed-id)
    feed (ok (get price feed))
    ERR-FEED-NOT-FOUND
  )
)

(define-read-only (get-feed-info (feed-id uint))
  (map-get? price-feeds feed-id)
)

(define-read-only (get-historical-price (feed-id uint) (at-block uint))
  (map-get? price-history { feed-id: feed-id, block: at-block })
)

(define-read-only (get-twap (feed-id uint) (period-blocks uint))
  (match (map-get? twap-accumulators feed-id)
    acc
      (let
        (
          (time-elapsed (- block-height (get last-block acc)))
          (current-contribution (* (get last-price acc) time-elapsed))
          (total-cumulative (+ (get cumulative-price acc) current-contribution))
        )
        (if (> period-blocks u0)
          (ok (/ total-cumulative period-blocks))
          (ok u0)
        )
      )
    ERR-FEED-NOT-FOUND
  )
)

(define-read-only (is-reporter (account principal))
  (default-to false (map-get? reporters account))
)

(define-read-only (is-price-fresh (feed-id uint))
  (match (map-get? price-feeds feed-id)
    feed (<= (- block-height (get last-updated feed)) MAX-STALENESS)
    false
  )
)

(define-read-only (check-deviation (old-price uint) (new-price uint))
  (let
    (
      (diff (if (> new-price old-price)
              (- new-price old-price)
              (- old-price new-price)))
      (deviation-bps (/ (* diff BPS-DENOMINATOR) old-price))
    )
    (<= deviation-bps MAX-DEVIATION-BPS)
  )
)

(define-read-only (get-oracle-stats)
  {
    reporter-count: (var-get reporter-count),
    min-reporters: (var-get min-reporters),
    is-paused: (var-get oracle-paused),
    max-staleness: MAX-STALENESS,
    max-deviation-bps: MAX-DEVIATION-BPS
  }
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-min-reporters (count uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> count u0) ERR-INVALID-PRICE)
    (ok (var-set min-reporters count))
  )
)

(define-public (toggle-oracle-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set oracle-paused (not (var-get oracle-paused))))
  )
)
