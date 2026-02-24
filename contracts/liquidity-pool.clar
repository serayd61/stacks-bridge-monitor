;; ============================================================================
;; Liquidity Pool - Automated Market Maker (AMM)
;; ============================================================================
;; Simple constant-product AMM (x*y=k) for BRIDGE/STX trading pair.
;; Liquidity providers earn fees from swaps.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u6001))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u6002))
(define-constant ERR-SLIPPAGE-TOO-HIGH (err u6003))
(define-constant ERR-INVALID-AMOUNT (err u6004))
(define-constant ERR-POOL-EMPTY (err u6005))
(define-constant ERR-ZERO-LIQUIDITY (err u6006))
(define-constant ERR-POOL-PAUSED (err u6007))
(define-constant ERR-DEADLINE-PASSED (err u6008))
(define-constant ERR-NO-LP-TOKENS (err u6009))

;; Fee: 0.3% (30 bps)
(define-constant SWAP-FEE-BPS u30)
(define-constant BPS-DENOMINATOR u10000)

;; LP Token
(define-fungible-token bridge-lp-token)

;; Pool State
(define-data-var reserve-stx uint u0)
(define-data-var reserve-bridge uint u0)
(define-data-var k-last uint u0) ;; last k value
(define-data-var pool-paused bool false)
(define-data-var total-swap-volume uint u0)
(define-data-var total-swaps uint u0)
(define-data-var total-fees-earned uint u0)

;; LP positions
(define-map lp-positions
  principal
  {
    stx-deposited: uint,
    bridge-deposited: uint,
    lp-tokens: uint,
    first-deposit-block: uint
  }
)

;; ============================================================================
;; Add Liquidity
;; ============================================================================

(define-public (add-liquidity
    (stx-amount uint)
    (bridge-amount uint)
    (min-lp-tokens uint)
  )
  (let
    (
      (current-stx (var-get reserve-stx))
      (current-bridge (var-get reserve-bridge))
      (lp-supply (ft-get-supply bridge-lp-token))
    )
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    (asserts! (> stx-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> bridge-amount u0) ERR-INVALID-AMOUNT)

    (let
      (
        (lp-tokens-to-mint
          (if (is-eq lp-supply u0)
            ;; First deposit: LP tokens = sqrt(stx * bridge)
            (sqrti (* stx-amount bridge-amount))
            ;; Subsequent: proportional to existing pool
            (min
              (/ (* stx-amount lp-supply) current-stx)
              (/ (* bridge-amount lp-supply) current-bridge)
            )
          )
        )
      )
      (asserts! (>= lp-tokens-to-mint min-lp-tokens) ERR-SLIPPAGE-TOO-HIGH)
      (asserts! (> lp-tokens-to-mint u0) ERR-ZERO-LIQUIDITY)

      ;; Mint LP tokens
      (try! (ft-mint? bridge-lp-token lp-tokens-to-mint tx-sender))

      ;; Update reserves
      (var-set reserve-stx (+ current-stx stx-amount))
      (var-set reserve-bridge (+ current-bridge bridge-amount))
      (var-set k-last (* (var-get reserve-stx) (var-get reserve-bridge)))

      ;; Track LP position
      (map-set lp-positions tx-sender {
        stx-deposited: (+ (default-to u0 (get stx-deposited (map-get? lp-positions tx-sender))) stx-amount),
        bridge-deposited: (+ (default-to u0 (get bridge-deposited (map-get? lp-positions tx-sender))) bridge-amount),
        lp-tokens: (+ (default-to u0 (get lp-tokens (map-get? lp-positions tx-sender))) lp-tokens-to-mint),
        first-deposit-block: (default-to block-height (get first-deposit-block (map-get? lp-positions tx-sender)))
      })

      (print {
        event: "liquidity-added",
        provider: tx-sender,
        stx: stx-amount,
        bridge: bridge-amount,
        lp-tokens: lp-tokens-to-mint
      })

      (ok { lp-tokens: lp-tokens-to-mint })
    )
  )
)

;; ============================================================================
;; Remove Liquidity
;; ============================================================================

(define-public (remove-liquidity
    (lp-token-amount uint)
    (min-stx uint)
    (min-bridge uint)
  )
  (let
    (
      (lp-supply (ft-get-supply bridge-lp-token))
      (current-stx (var-get reserve-stx))
      (current-bridge (var-get reserve-bridge))
      (stx-amount (/ (* lp-token-amount current-stx) lp-supply))
      (bridge-amount (/ (* lp-token-amount current-bridge) lp-supply))
    )
    (asserts! (> lp-token-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= stx-amount min-stx) ERR-SLIPPAGE-TOO-HIGH)
    (asserts! (>= bridge-amount min-bridge) ERR-SLIPPAGE-TOO-HIGH)

    ;; Burn LP tokens
    (try! (ft-burn? bridge-lp-token lp-token-amount tx-sender))

    ;; Update reserves
    (var-set reserve-stx (- current-stx stx-amount))
    (var-set reserve-bridge (- current-bridge bridge-amount))
    (var-set k-last (* (var-get reserve-stx) (var-get reserve-bridge)))

    ;; Update LP position
    (match (map-get? lp-positions tx-sender)
      position
        (map-set lp-positions tx-sender
          (merge position {
            lp-tokens: (- (get lp-tokens position) lp-token-amount)
          }))
      true
    )

    (print {
      event: "liquidity-removed",
      provider: tx-sender,
      stx: stx-amount,
      bridge: bridge-amount,
      lp-tokens-burned: lp-token-amount
    })

    (ok { stx: stx-amount, bridge: bridge-amount })
  )
)

;; ============================================================================
;; Swap Functions
;; ============================================================================

(define-public (swap-stx-for-bridge (stx-in uint) (min-bridge-out uint))
  (let
    (
      (current-stx (var-get reserve-stx))
      (current-bridge (var-get reserve-bridge))
      (stx-with-fee (- stx-in (/ (* stx-in SWAP-FEE-BPS) BPS-DENOMINATOR)))
      (bridge-out (get-amount-out stx-with-fee current-stx current-bridge))
    )
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    (asserts! (> stx-in u0) ERR-INVALID-AMOUNT)
    (asserts! (>= bridge-out min-bridge-out) ERR-SLIPPAGE-TOO-HIGH)
    (asserts! (< bridge-out current-bridge) ERR-INSUFFICIENT-LIQUIDITY)

    ;; Update reserves
    (var-set reserve-stx (+ current-stx stx-in))
    (var-set reserve-bridge (- current-bridge bridge-out))

    ;; Update stats
    (var-set total-swap-volume (+ (var-get total-swap-volume) stx-in))
    (var-set total-swaps (+ (var-get total-swaps) u1))
    (var-set total-fees-earned (+ (var-get total-fees-earned)
      (/ (* stx-in SWAP-FEE-BPS) BPS-DENOMINATOR)))

    (print {
      event: "swap",
      direction: "stx-to-bridge",
      stx-in: stx-in,
      bridge-out: bridge-out,
      trader: tx-sender
    })

    (ok bridge-out)
  )
)

(define-public (swap-bridge-for-stx (bridge-in uint) (min-stx-out uint))
  (let
    (
      (current-stx (var-get reserve-stx))
      (current-bridge (var-get reserve-bridge))
      (bridge-with-fee (- bridge-in (/ (* bridge-in SWAP-FEE-BPS) BPS-DENOMINATOR)))
      (stx-out (get-amount-out bridge-with-fee current-bridge current-stx))
    )
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    (asserts! (> bridge-in u0) ERR-INVALID-AMOUNT)
    (asserts! (>= stx-out min-stx-out) ERR-SLIPPAGE-TOO-HIGH)
    (asserts! (< stx-out current-stx) ERR-INSUFFICIENT-LIQUIDITY)

    ;; Update reserves
    (var-set reserve-bridge (+ current-bridge bridge-in))
    (var-set reserve-stx (- current-stx stx-out))

    ;; Update stats
    (var-set total-swap-volume (+ (var-get total-swap-volume) bridge-in))
    (var-set total-swaps (+ (var-get total-swaps) u1))
    (var-set total-fees-earned (+ (var-get total-fees-earned)
      (/ (* bridge-in SWAP-FEE-BPS) BPS-DENOMINATOR)))

    (print {
      event: "swap",
      direction: "bridge-to-stx",
      bridge-in: bridge-in,
      stx-out: stx-out,
      trader: tx-sender
    })

    (ok stx-out)
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-amount-out (amount-in uint) (reserve-in uint) (reserve-out uint))
  ;; x * y = k formula
  (let
    (
      (numerator (* amount-in reserve-out))
      (denominator (+ reserve-in amount-in))
    )
    (/ numerator denominator)
  )
)

(define-read-only (get-pool-info)
  {
    reserve-stx: (var-get reserve-stx),
    reserve-bridge: (var-get reserve-bridge),
    k: (var-get k-last),
    lp-supply: (ft-get-supply bridge-lp-token),
    total-volume: (var-get total-swap-volume),
    total-swaps: (var-get total-swaps),
    total-fees: (var-get total-fees-earned),
    is-paused: (var-get pool-paused)
  }
)

(define-read-only (get-price-stx-per-bridge)
  (let
    (
      (stx-reserve (var-get reserve-stx))
      (bridge-reserve (var-get reserve-bridge))
    )
    (if (> bridge-reserve u0)
      (/ (* stx-reserve u1000000) bridge-reserve)
      u0
    )
  )
)

(define-read-only (get-price-bridge-per-stx)
  (let
    (
      (stx-reserve (var-get reserve-stx))
      (bridge-reserve (var-get reserve-bridge))
    )
    (if (> stx-reserve u0)
      (/ (* bridge-reserve u1000000) stx-reserve)
      u0
    )
  )
)

(define-read-only (get-lp-position (provider principal))
  (map-get? lp-positions provider)
)

(define-read-only (get-lp-balance (account principal))
  (ft-get-balance bridge-lp-token account)
)

(define-read-only (quote-swap-stx-for-bridge (stx-in uint))
  (let
    (
      (stx-with-fee (- stx-in (/ (* stx-in SWAP-FEE-BPS) BPS-DENOMINATOR)))
    )
    (get-amount-out stx-with-fee (var-get reserve-stx) (var-get reserve-bridge))
  )
)

(define-read-only (quote-swap-bridge-for-stx (bridge-in uint))
  (let
    (
      (bridge-with-fee (- bridge-in (/ (* bridge-in SWAP-FEE-BPS) BPS-DENOMINATOR)))
    )
    (get-amount-out bridge-with-fee (var-get reserve-bridge) (var-get reserve-stx))
  )
)

;; ============================================================================
;; Math Helpers
;; ============================================================================

(define-read-only (sqrti (n uint))
  (if (<= n u1)
    n
    (let
      (
        (x (/ (+ n u1) u2))
        (x1 (/ (+ x (/ n x)) u2))
        (x2 (/ (+ x1 (/ n x1)) u2))
        (x3 (/ (+ x2 (/ n x2)) u2))
        (x4 (/ (+ x3 (/ n x3)) u2))
      )
      (min x3 x4)
    )
  )
)

(define-read-only (min (a uint) (b uint))
  (if (<= a b) a b)
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (toggle-pool-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set pool-paused (not (var-get pool-paused))))
  )
)
