;; yield-distributor.clar
;; Yield Distribution Contract for Bridge Vault Depositors
;; Collects fees from bridge operations and distributes to depositors

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-AMOUNT (err u101))
(define-constant ERR-NO-YIELD (err u102))
(define-constant ERR-ALREADY-CLAIMED (err u103))
(define-constant ERR-NOT-DEPOSITOR (err u104))
(define-constant ERR-COOLDOWN-ACTIVE (err u105))

;; Distribution ratios (basis points, 10000 = 100%)
(define-constant DEPOSITOR-SHARE u7000)  ;; 70% to depositors
(define-constant TREASURY-SHARE u2000)   ;; 20% to treasury
(define-constant LP-SHARE u1000)         ;; 10% to LP providers

;; Claim cooldown (blocks) ~24 hours
(define-constant CLAIM-COOLDOWN u144)

;; Data Variables
(define-data-var total-yield-pool uint u0)
(define-data-var total-distributed uint u0)
(define-data-var total-deposits uint u0)
(define-data-var current-epoch uint u0)
(define-data-var treasury-address principal CONTRACT-OWNER)
(define-data-var lp-pool-address principal CONTRACT-OWNER)
(define-data-var min-deposit-for-yield uint u1000000) ;; 1 STX minimum

;; Data Maps
(define-map depositors principal {
  amount: uint,
  deposit-block: uint,
  last-claim-block: uint,
  total-earned: uint,
  share-points: uint
})

(define-map epoch-yields uint {
  total-fees: uint,
  total-deposits: uint,
  yield-per-share: uint,
  distributed: bool
})

(define-map user-epoch-claims { user: principal, epoch: uint } bool)

(define-map admins principal bool)

;; Initialize admin
(map-set admins CONTRACT-OWNER true)

;; ============================================
;; ADMIN FUNCTIONS
;; ============================================

(define-public (add-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) ERR-NOT-AUTHORIZED)
    (ok (map-set admins new-admin true))))

(define-public (remove-admin (admin principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-delete admins admin))))

(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-admin tx-sender) ERR-NOT-AUTHORIZED)
    (ok (var-set treasury-address new-treasury))))

(define-public (set-lp-pool (new-lp principal))
  (begin
    (asserts! (is-admin tx-sender) ERR-NOT-AUTHORIZED)
    (ok (var-set lp-pool-address new-lp))))

(define-public (set-min-deposit (amount uint))
  (begin
    (asserts! (is-admin tx-sender) ERR-NOT-AUTHORIZED)
    (ok (var-set min-deposit-for-yield amount))))

;; ============================================
;; DEPOSIT FUNCTIONS
;; ============================================

(define-public (deposit (amount uint))
  (let (
    (sender tx-sender)
    (current-deposit (default-to { amount: u0, deposit-block: u0, last-claim-block: u0, total-earned: u0, share-points: u0 } 
                                 (map-get? depositors sender)))
    (new-amount (+ (get amount current-deposit) amount))
    (share-points (calculate-share-points new-amount))
  )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (stx-transfer? amount sender (as-contract tx-sender)))
    
    (map-set depositors sender {
      amount: new-amount,
      deposit-block: (if (is-eq (get amount current-deposit) u0) block-height (get deposit-block current-deposit)),
      last-claim-block: (get last-claim-block current-deposit),
      total-earned: (get total-earned current-deposit),
      share-points: share-points
    })
    
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (ok { deposited: amount, total: new-amount, shares: share-points })))

(define-public (withdraw (amount uint))
  (let (
    (sender tx-sender)
    (depositor (unwrap! (map-get? depositors sender) ERR-NOT-DEPOSITOR))
    (current-amount (get amount depositor))
  )
    (asserts! (<= amount current-amount) ERR-INVALID-AMOUNT)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    (try! (as-contract (stx-transfer? amount tx-sender sender)))
    
    (let ((new-amount (- current-amount amount)))
      (if (is-eq new-amount u0)
        (map-delete depositors sender)
        (map-set depositors sender {
          amount: new-amount,
          deposit-block: (get deposit-block depositor),
          last-claim-block: (get last-claim-block depositor),
          total-earned: (get total-earned depositor),
          share-points: (calculate-share-points new-amount)
        }))
      
      (var-set total-deposits (- (var-get total-deposits) amount))
      (ok { withdrawn: amount, remaining: new-amount }))))

;; ============================================
;; YIELD COLLECTION (Called by Bridge Contracts)
;; ============================================

(define-public (collect-bridge-fee (amount uint))
  (let (
    (depositor-amount (/ (* amount DEPOSITOR-SHARE) u10000))
    (treasury-amount (/ (* amount TREASURY-SHARE) u10000))
    (lp-amount (/ (* amount LP-SHARE) u10000))
  )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    ;; Add to yield pool for depositors
    (var-set total-yield-pool (+ (var-get total-yield-pool) depositor-amount))
    
    ;; Transfer treasury share
    (if (> treasury-amount u0)
      (try! (as-contract (stx-transfer? treasury-amount tx-sender (var-get treasury-address))))
      true)
    
    ;; Transfer LP share
    (if (> lp-amount u0)
      (try! (as-contract (stx-transfer? lp-amount tx-sender (var-get lp-pool-address))))
      true)
    
    (ok { 
      total: amount, 
      to-depositors: depositor-amount, 
      to-treasury: treasury-amount, 
      to-lp: lp-amount 
    })))

;; Direct yield injection (for staking rewards, etc.)
(define-public (inject-yield (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set total-yield-pool (+ (var-get total-yield-pool) amount))
    (ok { injected: amount, total-pool: (var-get total-yield-pool) })))

;; ============================================
;; YIELD CLAIMING
;; ============================================

(define-public (claim-yield)
  (let (
    (sender tx-sender)
    (depositor (unwrap! (map-get? depositors sender) ERR-NOT-DEPOSITOR))
    (last-claim (get last-claim-block depositor))
    (claimable (calculate-claimable-yield sender))
  )
    ;; Check cooldown
    (asserts! (or (is-eq last-claim u0) 
                  (>= (- block-height last-claim) CLAIM-COOLDOWN)) 
              ERR-COOLDOWN-ACTIVE)
    
    ;; Check minimum deposit
    (asserts! (>= (get amount depositor) (var-get min-deposit-for-yield)) ERR-INVALID-AMOUNT)
    
    ;; Check claimable amount
    (asserts! (> claimable u0) ERR-NO-YIELD)
    
    ;; Transfer yield
    (try! (as-contract (stx-transfer? claimable tx-sender sender)))
    
    ;; Update state
    (map-set depositors sender {
      amount: (get amount depositor),
      deposit-block: (get deposit-block depositor),
      last-claim-block: block-height,
      total-earned: (+ (get total-earned depositor) claimable),
      share-points: (get share-points depositor)
    })
    
    (var-set total-yield-pool (- (var-get total-yield-pool) claimable))
    (var-set total-distributed (+ (var-get total-distributed) claimable))
    
    (ok { claimed: claimable, total-earned: (+ (get total-earned depositor) claimable) })))

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (get-depositor-info (depositor principal))
  (map-get? depositors depositor))

(define-read-only (get-pool-stats)
  {
    total-yield-pool: (var-get total-yield-pool),
    total-distributed: (var-get total-distributed),
    total-deposits: (var-get total-deposits),
    current-epoch: (var-get current-epoch),
    depositor-share-bps: DEPOSITOR-SHARE,
    treasury-share-bps: TREASURY-SHARE,
    lp-share-bps: LP-SHARE
  })

(define-read-only (calculate-claimable-yield (depositor principal))
  (let (
    (info (default-to { amount: u0, deposit-block: u0, last-claim-block: u0, total-earned: u0, share-points: u0 } 
                      (map-get? depositors depositor)))
    (user-shares (get share-points info))
    (total-shares (calculate-total-shares))
    (pool (var-get total-yield-pool))
  )
    (if (or (is-eq user-shares u0) (is-eq total-shares u0) (is-eq pool u0))
      u0
      (/ (* pool user-shares) total-shares))))

(define-read-only (calculate-apy)
  (let (
    (pool (var-get total-yield-pool))
    (deposits (var-get total-deposits))
  )
    (if (is-eq deposits u0)
      u0
      ;; APY in basis points (annualized estimate)
      ;; Assumes ~52560 blocks per year
      (/ (* pool u52560 u10000) (* deposits u144)))))

(define-read-only (get-next-claim-block (depositor principal))
  (let (
    (info (map-get? depositors depositor))
  )
    (match info
      depositor-info (+ (get last-claim-block depositor-info) CLAIM-COOLDOWN)
      u0)))

(define-read-only (is-admin (account principal))
  (default-to false (map-get? admins account)))

;; ============================================
;; PRIVATE FUNCTIONS
;; ============================================

(define-private (calculate-share-points (amount uint))
  ;; Share points based on deposit amount
  ;; Could add time-weighted bonus later
  amount)

(define-private (calculate-total-shares)
  ;; This is simplified - in production would track this incrementally
  (var-get total-deposits))
