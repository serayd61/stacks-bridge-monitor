;; sBTC Reserve Auditor Contract
;; On-chain proof of reserves for sBTC backing
;; Verifies that sBTC supply is fully backed by BTC

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u1000))
(define-constant err-not-authorized (err u1001))
(define-constant err-not-found (err u1002))
(define-constant err-undercollateralized (err u1003))
(define-constant err-invalid-proof (err u1004))

(define-constant REQUIRED-COLLATERAL-BPS u10000) ;; 100% backed
(define-constant AUDIT-FREQUENCY u144)            ;; ~daily audits

(define-data-var total-sbtc-supply uint u0)
(define-data-var total-btc-reserve uint u0)
(define-data-var last-audit-block uint u0)
(define-data-var audit-count uint u0)
(define-data-var auditor-count uint u0)
(define-data-var system-healthy bool true)

(define-map authorized-auditors principal bool)

;; Audit records
(define-map audits uint
  {
    auditor: principal,
    sbtc-supply-at-audit: uint,
    btc-reserve-at-audit: uint,
    collateral-ratio-bps: uint,
    block-height: uint,
    passed: bool,
    notes: (optional (string-ascii 200))
  }
)

;; Reserve proofs (BTC address -> amount)
(define-map reserve-proofs (string-ascii 62)
  {
    btc-address: (string-ascii 62),
    amount-sats: uint,
    last-verified: uint,
    verifier: principal,
    active: bool
  }
)

(define-data-var proof-count uint u0)
(define-map proof-index uint (string-ascii 62))

;; Read-only
(define-read-only (get-collateral-ratio)
  (if (> (var-get total-sbtc-supply) u0)
    (/ (* (var-get total-btc-reserve) u10000) (var-get total-sbtc-supply))
    u10000
  )
)

(define-read-only (is-fully-backed)
  (>= (get-collateral-ratio) REQUIRED-COLLATERAL-BPS)
)

(define-read-only (get-audit (audit-id uint))
  (map-get? audits audit-id)
)

(define-read-only (get-reserve-proof (btc-address (string-ascii 62)))
  (map-get? reserve-proofs btc-address)
)

(define-read-only (get-reserve-status)
  {
    sbtc-supply: (var-get total-sbtc-supply),
    btc-reserve: (var-get total-btc-reserve),
    collateral-ratio-bps: (get-collateral-ratio),
    is-healthy: (var-get system-healthy),
    last-audit: (var-get last-audit-block),
    total-audits: (var-get audit-count)
  }
)

(define-read-only (is-auditor (a principal))
  (default-to false (map-get? authorized-auditors a))
)

;; Public functions
(define-public (add-auditor (auditor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-auditors auditor true)
    (var-set auditor-count (+ (var-get auditor-count) u1))
    (ok auditor)
  )
)

(define-public (submit-reserve-proof
    (btc-address (string-ascii 62))
    (amount-sats uint))
  (let ((proof-id (var-get proof-count)))
    (asserts! (is-auditor tx-sender) err-not-authorized)
    (asserts! (> amount-sats u0) err-invalid-proof)

    (map-set reserve-proofs btc-address {
      btc-address: btc-address,
      amount-sats: amount-sats,
      last-verified: stacks-block-height,
      verifier: tx-sender,
      active: true
    })

    (map-set proof-index proof-id btc-address)
    (var-set proof-count (+ proof-id u1))

    ;; Update total reserve
    (var-set total-btc-reserve (+ (var-get total-btc-reserve) amount-sats))

    (ok { btc-address: btc-address, amount-sats: amount-sats, proof-id: proof-id })
  )
)

(define-public (update-sbtc-supply (new-supply uint))
  (begin
    (asserts! (is-auditor tx-sender) err-not-authorized)
    (var-set total-sbtc-supply new-supply)
    (ok new-supply)
  )
)

(define-public (perform-audit (notes (optional (string-ascii 200))))
  (let (
    (audit-id (var-get audit-count))
    (supply (var-get total-sbtc-supply))
    (reserve (var-get total-btc-reserve))
    (ratio (get-collateral-ratio))
    (passed (>= ratio REQUIRED-COLLATERAL-BPS))
  )
    (asserts! (is-auditor tx-sender) err-not-authorized)

    (map-set audits audit-id {
      auditor: tx-sender,
      sbtc-supply-at-audit: supply,
      btc-reserve-at-audit: reserve,
      collateral-ratio-bps: ratio,
      block-height: stacks-block-height,
      passed: passed,
      notes: notes
    })

    (var-set last-audit-block stacks-block-height)
    (var-set audit-count (+ audit-id u1))
    (var-set system-healthy passed)

    (if passed
      (ok { audit-id: audit-id, passed: true, ratio: ratio })
      (err err-undercollateralized)
    )
  )
)

(define-public (deactivate-proof (btc-address (string-ascii 62)))
  (match (map-get? reserve-proofs btc-address)
    proof
    (begin
      (asserts! (is-auditor tx-sender) err-not-authorized)
      (var-set total-btc-reserve (- (var-get total-btc-reserve) (get amount-sats proof)))
      (map-set reserve-proofs btc-address (merge proof { active: false, amount-sats: u0 }))
      (ok btc-address)
    )
    err-not-found
  )
)
