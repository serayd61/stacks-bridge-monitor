;; ============================================================================
;; Token Vesting - Linear & Cliff Vesting Schedules
;; ============================================================================
;; Manages token vesting schedules for team members, advisors, investors,
;; and ecosystem partners. Supports linear vesting with cliff periods,
;; revocable and irrevocable grants, and milestone-based releases.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u15001))
(define-constant ERR-INVALID-AMOUNT (err u15002))
(define-constant ERR-SCHEDULE-NOT-FOUND (err u15003))
(define-constant ERR-NOTHING-TO-CLAIM (err u15004))
(define-constant ERR-SCHEDULE-REVOKED (err u15005))
(define-constant ERR-NOT-REVOCABLE (err u15006))
(define-constant ERR-CLIFF-NOT-REACHED (err u15007))
(define-constant ERR-INVALID-SCHEDULE (err u15008))
(define-constant ERR-ALREADY-EXISTS (err u15009))
(define-constant ERR-MILESTONE-NOT-FOUND (err u15010))
(define-constant ERR-MILESTONE-NOT-APPROVED (err u15011))
(define-constant ERR-VESTING-PAUSED (err u15012))

;; Schedule Types
(define-constant SCHEDULE-LINEAR u0)
(define-constant SCHEDULE-CLIFF-LINEAR u1)
(define-constant SCHEDULE-MILESTONE u2)

;; Beneficiary Categories
(define-constant CATEGORY-TEAM u0)
(define-constant CATEGORY-ADVISOR u1)
(define-constant CATEGORY-INVESTOR u2)
(define-constant CATEGORY-ECOSYSTEM u3)
(define-constant CATEGORY-COMMUNITY u4)

;; Data Variables
(define-data-var schedule-count uint u0)
(define-data-var total-allocated uint u0)
(define-data-var total-claimed uint u0)
(define-data-var total-revoked uint u0)
(define-data-var milestone-count uint u0)
(define-data-var vesting-paused bool false)

;; Vesting schedules
(define-map vesting-schedules
  uint ;; schedule-id
  {
    beneficiary: principal,
    total-amount: uint,
    claimed-amount: uint,
    start-block: uint,
    cliff-blocks: uint,       ;; blocks before any tokens vest
    duration-blocks: uint,    ;; total vesting duration in blocks
    schedule-type: uint,
    category: uint,
    is-revocable: bool,
    is-revoked: bool,
    revoked-at: uint,
    created-at: uint
  }
)

;; Beneficiary to schedule mapping
(define-map beneficiary-schedules
  principal
  (list 10 uint) ;; up to 10 vesting schedules per beneficiary
)

;; Milestones for milestone-based vesting
(define-map milestones
  uint ;; milestone-id
  {
    schedule-id: uint,
    description: (string-ascii 100),
    amount: uint,
    is-approved: bool,
    approved-by: (optional principal),
    approved-at: uint
  }
)

;; Schedule milestones list
(define-map schedule-milestones
  uint ;; schedule-id
  (list 10 uint) ;; milestone ids
)

;; Category allocations tracking
(define-map category-allocations
  uint ;; category
  {
    name: (string-ascii 20),
    total-allocated: uint,
    total-claimed: uint,
    max-allocation: uint,
    beneficiary-count: uint
  }
)

;; Vesting admins (can create schedules)
(define-map vesting-admins principal bool)

;; Initialize categories
(map-set category-allocations CATEGORY-TEAM
  { name: "Team", total-allocated: u0, total-claimed: u0, max-allocation: u200000000000000, beneficiary-count: u0 })
(map-set category-allocations CATEGORY-ADVISOR
  { name: "Advisors", total-allocated: u0, total-claimed: u0, max-allocation: u50000000000000, beneficiary-count: u0 })
(map-set category-allocations CATEGORY-INVESTOR
  { name: "Investors", total-allocated: u0, total-claimed: u0, max-allocation: u150000000000000, beneficiary-count: u0 })
(map-set category-allocations CATEGORY-ECOSYSTEM
  { name: "Ecosystem", total-allocated: u0, total-claimed: u0, max-allocation: u300000000000000, beneficiary-count: u0 })
(map-set category-allocations CATEGORY-COMMUNITY
  { name: "Community", total-allocated: u0, total-claimed: u0, max-allocation: u300000000000000, beneficiary-count: u0 })

;; Set owner as admin
(map-set vesting-admins CONTRACT-OWNER true)

;; ============================================================================
;; Schedule Creation
;; ============================================================================

(define-public (create-vesting-schedule
    (beneficiary principal)
    (total-amount uint)
    (cliff-blocks uint)
    (duration-blocks uint)
    (schedule-type uint)
    (category uint)
    (is-revocable bool)
  )
  (let
    (
      (schedule-id (var-get schedule-count))
      (cat-alloc (unwrap! (map-get? category-allocations category) ERR-INVALID-SCHEDULE))
    )
    (asserts! (or (is-eq tx-sender CONTRACT-OWNER)
                  (default-to false (map-get? vesting-admins tx-sender)))
              ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get vesting-paused)) ERR-VESTING-PAUSED)
    (asserts! (> total-amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> duration-blocks u0) ERR-INVALID-SCHEDULE)
    (asserts! (<= cliff-blocks duration-blocks) ERR-INVALID-SCHEDULE)
    (asserts! (<= schedule-type u2) ERR-INVALID-SCHEDULE)
    (asserts! (<= category u4) ERR-INVALID-SCHEDULE)
    (asserts! (<= (+ (get total-allocated cat-alloc) total-amount) (get max-allocation cat-alloc))
              ERR-INVALID-AMOUNT)

    ;; Create schedule
    (map-set vesting-schedules schedule-id {
      beneficiary: beneficiary,
      total-amount: total-amount,
      claimed-amount: u0,
      start-block: block-height,
      cliff-blocks: cliff-blocks,
      duration-blocks: duration-blocks,
      schedule-type: schedule-type,
      category: category,
      is-revocable: is-revocable,
      is-revoked: false,
      revoked-at: u0,
      created-at: block-height
    })

    ;; Update beneficiary schedules list
    (let
      (
        (existing-schedules (default-to (list) (map-get? beneficiary-schedules beneficiary)))
      )
      (map-set beneficiary-schedules beneficiary
        (unwrap! (as-max-len? (append existing-schedules schedule-id) u10) ERR-INVALID-SCHEDULE))
    )

    ;; Update category
    (map-set category-allocations category
      (merge cat-alloc {
        total-allocated: (+ (get total-allocated cat-alloc) total-amount),
        beneficiary-count: (+ (get beneficiary-count cat-alloc) u1)
      }))

    ;; Update globals
    (var-set schedule-count (+ schedule-id u1))
    (var-set total-allocated (+ (var-get total-allocated) total-amount))

    (print {
      event: "vesting-created",
      schedule-id: schedule-id,
      beneficiary: beneficiary,
      total-amount: total-amount,
      cliff: cliff-blocks,
      duration: duration-blocks,
      type: schedule-type,
      category: category
    })

    (ok schedule-id)
  )
)

;; ============================================================================
;; Milestone Management
;; ============================================================================

(define-public (add-milestone (schedule-id uint) (description (string-ascii 100)) (amount uint))
  (let
    (
      (schedule (unwrap! (map-get? vesting-schedules schedule-id) ERR-SCHEDULE-NOT-FOUND))
      (milestone-id (var-get milestone-count))
    )
    (asserts! (or (is-eq tx-sender CONTRACT-OWNER)
                  (default-to false (map-get? vesting-admins tx-sender)))
              ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get schedule-type schedule) SCHEDULE-MILESTONE) ERR-INVALID-SCHEDULE)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    (map-set milestones milestone-id {
      schedule-id: schedule-id,
      description: description,
      amount: amount,
      is-approved: false,
      approved-by: none,
      approved-at: u0
    })

    ;; Update schedule milestones list
    (let
      (
        (existing (default-to (list) (map-get? schedule-milestones schedule-id)))
      )
      (map-set schedule-milestones schedule-id
        (unwrap! (as-max-len? (append existing milestone-id) u10) ERR-INVALID-SCHEDULE))
    )

    (var-set milestone-count (+ milestone-id u1))

    (print {
      event: "milestone-added",
      milestone-id: milestone-id,
      schedule-id: schedule-id,
      description: description,
      amount: amount
    })

    (ok milestone-id)
  )
)

(define-public (approve-milestone (milestone-id uint))
  (let
    (
      (milestone (unwrap! (map-get? milestones milestone-id) ERR-MILESTONE-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (get is-approved milestone)) ERR-MILESTONE-NOT-APPROVED)

    (map-set milestones milestone-id
      (merge milestone {
        is-approved: true,
        approved-by: (some tx-sender),
        approved-at: block-height
      }))

    (print {
      event: "milestone-approved",
      milestone-id: milestone-id,
      schedule-id: (get schedule-id milestone),
      approver: tx-sender
    })

    (ok true)
  )
)

;; ============================================================================
;; Token Claims
;; ============================================================================

(define-public (claim-vested-tokens (schedule-id uint))
  (let
    (
      (schedule (unwrap! (map-get? vesting-schedules schedule-id) ERR-SCHEDULE-NOT-FOUND))
      (vested (get-vested-amount schedule-id))
      (claimable (- vested (get claimed-amount schedule)))
    )
    (asserts! (is-eq (get beneficiary schedule) tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (get is-revoked schedule)) ERR-SCHEDULE-REVOKED)
    (asserts! (not (var-get vesting-paused)) ERR-VESTING-PAUSED)
    (asserts! (>= block-height (+ (get start-block schedule) (get cliff-blocks schedule)))
              ERR-CLIFF-NOT-REACHED)
    (asserts! (> claimable u0) ERR-NOTHING-TO-CLAIM)

    ;; Update schedule
    (map-set vesting-schedules schedule-id
      (merge schedule {
        claimed-amount: (+ (get claimed-amount schedule) claimable)
      }))

    ;; Update category
    (match (map-get? category-allocations (get category schedule))
      cat-alloc
        (map-set category-allocations (get category schedule)
          (merge cat-alloc {
            total-claimed: (+ (get total-claimed cat-alloc) claimable)
          }))
      true
    )

    (var-set total-claimed (+ (var-get total-claimed) claimable))

    (print {
      event: "tokens-claimed",
      schedule-id: schedule-id,
      beneficiary: tx-sender,
      amount: claimable,
      total-claimed: (+ (get claimed-amount schedule) claimable),
      remaining: (- (get total-amount schedule) (+ (get claimed-amount schedule) claimable))
    })

    (ok claimable)
  )
)

;; ============================================================================
;; Revocation
;; ============================================================================

(define-public (revoke-schedule (schedule-id uint))
  (let
    (
      (schedule (unwrap! (map-get? vesting-schedules schedule-id) ERR-SCHEDULE-NOT-FOUND))
      (vested (get-vested-amount schedule-id))
      (unvested (- (get total-amount schedule) vested))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (get is-revocable schedule) ERR-NOT-REVOCABLE)
    (asserts! (not (get is-revoked schedule)) ERR-SCHEDULE-REVOKED)

    (map-set vesting-schedules schedule-id
      (merge schedule {
        is-revoked: true,
        revoked-at: block-height,
        total-amount: vested ;; reduce to only vested amount
      }))

    (var-set total-revoked (+ (var-get total-revoked) unvested))

    (print {
      event: "schedule-revoked",
      schedule-id: schedule-id,
      beneficiary: (get beneficiary schedule),
      vested-amount: vested,
      returned-amount: unvested
    })

    (ok unvested)
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-vesting-admin (admin principal) (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (map-set vesting-admins admin enabled))
  )
)

(define-public (toggle-vesting-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set vesting-paused (not (var-get vesting-paused))))
  )
)

(define-public (update-category-max (category uint) (new-max uint))
  (let
    (
      (cat-alloc (unwrap! (map-get? category-allocations category) ERR-INVALID-SCHEDULE))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (>= new-max (get total-allocated cat-alloc)) ERR-INVALID-AMOUNT)
    (ok (map-set category-allocations category
      (merge cat-alloc { max-allocation: new-max })))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-vested-amount (schedule-id uint))
  (match (map-get? vesting-schedules schedule-id)
    schedule
      (let
        (
          (elapsed (if (> block-height (get start-block schedule))
            (- block-height (get start-block schedule))
            u0))
        )
        ;; Check cliff
        (if (< elapsed (get cliff-blocks schedule))
          u0
          ;; Check if fully vested
          (if (>= elapsed (get duration-blocks schedule))
            (get total-amount schedule)
            ;; Linear vesting calculation
            (/ (* (get total-amount schedule) elapsed) (get duration-blocks schedule))
          )
        )
      )
    u0
  )
)

(define-read-only (get-claimable-amount (schedule-id uint))
  (match (map-get? vesting-schedules schedule-id)
    schedule
      (let ((vested (get-vested-amount schedule-id)))
        (if (> vested (get claimed-amount schedule))
          (- vested (get claimed-amount schedule))
          u0))
    u0
  )
)

(define-read-only (get-schedule (schedule-id uint))
  (map-get? vesting-schedules schedule-id)
)

(define-read-only (get-beneficiary-schedules (beneficiary principal))
  (default-to (list) (map-get? beneficiary-schedules beneficiary))
)

(define-read-only (get-milestone (milestone-id uint))
  (map-get? milestones milestone-id)
)

(define-read-only (get-category-info (category uint))
  (map-get? category-allocations category)
)

(define-read-only (get-vesting-stats)
  {
    total-schedules: (var-get schedule-count),
    total-allocated: (var-get total-allocated),
    total-claimed: (var-get total-claimed),
    total-revoked: (var-get total-revoked),
    outstanding: (- (var-get total-allocated) (+ (var-get total-claimed) (var-get total-revoked))),
    total-milestones: (var-get milestone-count),
    is-paused: (var-get vesting-paused)
  }
)

(define-read-only (get-vesting-progress (schedule-id uint))
  (match (map-get? vesting-schedules schedule-id)
    schedule
      (let
        (
          (elapsed (if (> block-height (get start-block schedule))
            (- block-height (get start-block schedule))
            u0))
          (progress-bps (if (>= elapsed (get duration-blocks schedule))
            u10000
            (/ (* elapsed u10000) (get duration-blocks schedule))))
        )
        {
          schedule-id: schedule-id,
          progress-bps: progress-bps,
          vested: (get-vested-amount schedule-id),
          claimed: (get claimed-amount schedule),
          remaining: (- (get total-amount schedule) (get-vested-amount schedule-id)),
          blocks-remaining: (if (>= elapsed (get duration-blocks schedule))
            u0
            (- (get duration-blocks schedule) elapsed)),
          is-cliff-passed: (>= elapsed (get cliff-blocks schedule)),
          is-fully-vested: (>= elapsed (get duration-blocks schedule))
        }
      )
    {
      schedule-id: schedule-id,
      progress-bps: u0,
      vested: u0,
      claimed: u0,
      remaining: u0,
      blocks-remaining: u0,
      is-cliff-passed: false,
      is-fully-vested: false
    }
  )
)

(define-read-only (is-vesting-admin (account principal))
  (default-to false (map-get? vesting-admins account))
)
