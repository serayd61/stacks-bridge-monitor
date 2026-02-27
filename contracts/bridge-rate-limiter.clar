;; Bridge Rate Limiter Contract
;; Protects sBTC bridge from large withdrawals and potential exploits
;; Implements per-user and global rate limits

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u400))
(define-constant err-rate-limit-exceeded (err u401))
(define-constant err-not-authorized (err u402))
(define-constant err-invalid-limit (err u403))
(define-constant err-blacklisted (err u404))

;; Default limits
(define-constant DEFAULT-USER-DAILY-LIMIT u1000000000)   ;; 10 BTC in sats
(define-constant DEFAULT-GLOBAL-DAILY-LIMIT u100000000000) ;; 1000 BTC in sats
(define-constant RESET-PERIOD u144)  ;; ~1 day in blocks

(define-data-var global-daily-limit uint DEFAULT-GLOBAL-DAILY-LIMIT)
(define-data-var global-used-today uint u0)
(define-data-var last-global-reset uint u0)
(define-data-var limiter-active bool true)

(define-map user-limits principal uint)
(define-map user-usage
  { user: principal, period: uint }
  uint
)
(define-map blacklisted-users principal bool)
(define-map whitelisted-users principal bool)

;; Read-only
(define-read-only (get-user-limit (user principal))
  (default-to DEFAULT-USER-DAILY-LIMIT (map-get? user-limits user))
)

(define-read-only (get-current-period)
  (/ stacks-block-height RESET-PERIOD)
)

(define-read-only (get-user-usage-current-period (user principal))
  (default-to u0 (map-get? user-usage { user: user, period: (get-current-period) }))
)

(define-read-only (get-global-remaining)
  (let ((reset-needed (> (- stacks-block-height (var-get last-global-reset)) RESET-PERIOD)))
    (if reset-needed
      (var-get global-daily-limit)
      (- (var-get global-daily-limit) (var-get global-used-today))
    )
  )
)

(define-read-only (can-bridge (user principal) (amount uint))
  (let (
    (user-used (get-user-usage-current-period user))
    (user-limit (get-user-limit user))
    (is-whitelisted (default-to false (map-get? whitelisted-users user)))
    (is-blacklisted (default-to false (map-get? blacklisted-users user)))
  )
    (and
      (not is-blacklisted)
      (or is-whitelisted (<= (+ user-used amount) user-limit))
      (<= amount (get-global-remaining))
    )
  )
)

(define-read-only (is-blacklisted-user (user principal))
  (default-to false (map-get? blacklisted-users user))
)

;; Public functions
(define-public (set-user-limit (user principal) (limit uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> limit u0) err-invalid-limit)
    (map-set user-limits user limit)
    (ok { user: user, limit: limit })
  )
)

(define-public (set-global-limit (limit uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set global-daily-limit limit)
    (ok limit)
  )
)

(define-public (blacklist-user (user principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set blacklisted-users user true)
    (ok user)
  )
)

(define-public (remove-blacklist (user principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set blacklisted-users user false)
    (ok user)
  )
)

(define-public (whitelist-user (user principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set whitelisted-users user true)
    (ok user)
  )
)

(define-public (record-bridge-usage (user principal) (amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (var-get limiter-active) err-not-authorized)
    (asserts! (not (is-blacklisted-user user)) err-blacklisted)

    ;; Reset global if needed
    (if (> (- stacks-block-height (var-get last-global-reset)) RESET-PERIOD)
      (begin
        (var-set global-used-today u0)
        (var-set last-global-reset stacks-block-height)
      )
      false
    )

    (asserts! (can-bridge user amount) err-rate-limit-exceeded)

    ;; Update usage
    (let ((period (get-current-period)))
      (map-set user-usage
        { user: user, period: period }
        (+ (get-user-usage-current-period user) amount)
      )
    )
    (var-set global-used-today (+ (var-get global-used-today) amount))

    (ok { user: user, amount: amount, remaining: (- (get-user-limit user) (get-user-usage-current-period user)) })
  )
)

(define-public (toggle-limiter (active bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set limiter-active active)
    (ok active)
  )
)
