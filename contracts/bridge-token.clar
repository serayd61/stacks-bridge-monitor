;; ============================================================================
;; Bridge Token - SIP-010 Fungible Token
;; ============================================================================
;; The core fungible token for the Stacks Bridge ecosystem.
;; Implements SIP-010 standard with minting/burning for bridge operations.
;; ============================================================================

;; SIP-010 Trait
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u1001))
(define-constant ERR-NOT-ENOUGH-BALANCE (err u1002))
(define-constant ERR-INVALID-AMOUNT (err u1003))
(define-constant ERR-MINTING-PAUSED (err u1004))
(define-constant ERR-BURNING-PAUSED (err u1005))
(define-constant ERR-MAX-SUPPLY-REACHED (err u1006))

;; Token Definition
(define-fungible-token bridge-token u1000000000000000) ;; 1 Billion max supply (with 6 decimals)

;; Data Variables
(define-data-var token-name (string-ascii 32) "Bridge Token")
(define-data-var token-symbol (string-ascii 10) "BRIDGE")
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://stacks-bridge-monitor.vercel.app/token-metadata.json"))
(define-data-var token-decimals uint u6)
(define-data-var minting-paused bool false)
(define-data-var burning-paused bool false)
(define-data-var total-minted uint u0)
(define-data-var total-burned uint u0)

;; Authorization Maps
(define-map authorized-minters principal bool)
(define-map authorized-burners principal bool)

;; Initialize contract owner as minter and burner
(map-set authorized-minters CONTRACT-OWNER true)
(map-set authorized-burners CONTRACT-OWNER true)

;; ============================================================================
;; SIP-010 Standard Functions
;; ============================================================================

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (match memo
      memo-value (print memo-value)
      true
    )
    (ft-transfer? bridge-token amount sender recipient)
  )
)

(define-read-only (get-name)
  (ok (var-get token-name))
)

(define-read-only (get-symbol)
  (ok (var-get token-symbol))
)

(define-read-only (get-decimals)
  (ok (var-get token-decimals))
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance bridge-token account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply bridge-token))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; ============================================================================
;; Minting Functions (for bridge peg-in)
;; ============================================================================

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-authorized-minter tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get minting-paused)) ERR-MINTING-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= (+ (ft-get-supply bridge-token) amount) u1000000000000000) ERR-MAX-SUPPLY-REACHED)
    (var-set total-minted (+ (var-get total-minted) amount))
    (ft-mint? bridge-token amount recipient)
  )
)

;; ============================================================================
;; Burning Functions (for bridge peg-out)
;; ============================================================================

(define-public (burn (amount uint) (sender principal))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-authorized-burner tx-sender)) ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get burning-paused)) ERR-BURNING-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (var-set total-burned (+ (var-get total-burned) amount))
    (ft-burn? bridge-token amount sender)
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-minter (minter principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set authorized-minters minter enabled))
  )
)

(define-public (set-burner (burner principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set authorized-burners burner enabled))
  )
)

(define-public (toggle-minting-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set minting-paused (not (var-get minting-paused))))
  )
)

(define-public (toggle-burning-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set burning-paused (not (var-get burning-paused))))
  )
)

(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set token-uri new-uri))
  )
)

;; ============================================================================
;; Read-Only Helpers
;; ============================================================================

(define-read-only (is-authorized-minter (account principal))
  (default-to false (map-get? authorized-minters account))
)

(define-read-only (is-authorized-burner (account principal))
  (default-to false (map-get? authorized-burners account))
)

(define-read-only (get-total-minted)
  (var-get total-minted)
)

(define-read-only (get-total-burned)
  (var-get total-burned)
)

(define-read-only (is-minting-paused)
  (var-get minting-paused)
)

(define-read-only (is-burning-paused)
  (var-get burning-paused)
)
