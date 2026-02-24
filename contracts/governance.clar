;; ============================================================================
;; Governance DAO - Decentralized Protocol Governance
;; ============================================================================
;; On-chain governance for the Bridge protocol. Token holders can create
;; proposals, vote, and execute approved changes to protocol parameters.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u4001))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u4002))
(define-constant ERR-ALREADY-VOTED (err u4003))
(define-constant ERR-VOTING-ENDED (err u4004))
(define-constant ERR-VOTING-NOT-ENDED (err u4005))
(define-constant ERR-PROPOSAL-NOT-ACTIVE (err u4006))
(define-constant ERR-INSUFFICIENT-TOKENS (err u4007))
(define-constant ERR-QUORUM-NOT-MET (err u4008))
(define-constant ERR-ALREADY-EXECUTED (err u4009))
(define-constant ERR-EXECUTION-DELAY-NOT-MET (err u4010))
(define-constant ERR-PROPOSAL-EXPIRED (err u4011))
(define-constant ERR-INVALID-PARAMS (err u4012))

;; Proposal Statuses
(define-constant PROPOSAL-ACTIVE u0)
(define-constant PROPOSAL-PASSED u1)
(define-constant PROPOSAL-FAILED u2)
(define-constant PROPOSAL-EXECUTED u3)
(define-constant PROPOSAL-CANCELLED u4)

;; Governance Parameters
(define-data-var proposal-count uint u0)
(define-data-var voting-period uint u1008) ;; ~7 days in blocks
(define-data-var execution-delay uint u144) ;; ~1 day delay after passing
(define-data-var execution-window uint u432) ;; ~3 days to execute
(define-data-var proposal-threshold uint u1000000000) ;; 1000 tokens to create proposal
(define-data-var quorum-percentage uint u10) ;; 10% of total supply must vote
(define-data-var governance-paused bool false)

;; Proposal Storage
(define-map proposals
  uint
  {
    proposer: principal,
    title: (string-ascii 100),
    description: (string-utf8 500),
    proposal-type: (string-ascii 50),
    start-block: uint,
    end-block: uint,
    votes-for: uint,
    votes-against: uint,
    status: uint,
    executed: bool,
    execution-block: uint
  }
)

;; Vote tracking
(define-map votes
  { proposal-id: uint, voter: principal }
  { amount: uint, support: bool }
)

;; Delegated voting power
(define-map delegations principal principal)

;; Delegate vote power tracking
(define-map delegate-power principal uint)

;; ============================================================================
;; Proposal Creation
;; ============================================================================

(define-public (create-proposal
    (title (string-ascii 100))
    (description (string-utf8 500))
    (proposal-type (string-ascii 50))
  )
  (let
    (
      (proposal-id (var-get proposal-count))
      (start block-height)
      (end (+ block-height (var-get voting-period)))
    )
    (asserts! (not (var-get governance-paused)) ERR-NOT-AUTHORIZED)

    ;; Create proposal
    (map-set proposals proposal-id {
      proposer: tx-sender,
      title: title,
      description: description,
      proposal-type: proposal-type,
      start-block: start,
      end-block: end,
      votes-for: u0,
      votes-against: u0,
      status: PROPOSAL-ACTIVE,
      executed: false,
      execution-block: u0
    })

    (var-set proposal-count (+ proposal-id u1))

    (print {
      event: "proposal-created",
      id: proposal-id,
      proposer: tx-sender,
      title: title,
      type: proposal-type,
      start: start,
      end: end
    })

    (ok proposal-id)
  )
)

;; ============================================================================
;; Voting
;; ============================================================================

(define-public (vote (proposal-id uint) (support bool) (amount uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
      (existing-vote (map-get? votes { proposal-id: proposal-id, voter: tx-sender }))
    )
    (asserts! (is-eq (get status proposal) PROPOSAL-ACTIVE) ERR-PROPOSAL-NOT-ACTIVE)
    (asserts! (<= block-height (get end-block proposal)) ERR-VOTING-ENDED)
    (asserts! (is-none existing-vote) ERR-ALREADY-VOTED)
    (asserts! (> amount u0) ERR-INSUFFICIENT-TOKENS)

    ;; Record vote
    (map-set votes
      { proposal-id: proposal-id, voter: tx-sender }
      { amount: amount, support: support }
    )

    ;; Update vote counts
    (if support
      (map-set proposals proposal-id
        (merge proposal { votes-for: (+ (get votes-for proposal) amount) }))
      (map-set proposals proposal-id
        (merge proposal { votes-against: (+ (get votes-against proposal) amount) }))
    )

    (print {
      event: "vote-cast",
      proposal-id: proposal-id,
      voter: tx-sender,
      support: support,
      amount: amount
    })

    (ok true)
  )
)

;; ============================================================================
;; Proposal Finalization
;; ============================================================================

(define-public (finalize-proposal (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
      (total-votes (+ (get votes-for proposal) (get votes-against proposal)))
    )
    (asserts! (is-eq (get status proposal) PROPOSAL-ACTIVE) ERR-PROPOSAL-NOT-ACTIVE)
    (asserts! (> block-height (get end-block proposal)) ERR-VOTING-NOT-ENDED)

    (if (and
          (> (get votes-for proposal) (get votes-against proposal))
          (>= total-votes (var-get proposal-threshold)))
      ;; Proposal passed
      (begin
        (map-set proposals proposal-id
          (merge proposal { status: PROPOSAL-PASSED }))
        (print { event: "proposal-passed", id: proposal-id })
        (ok PROPOSAL-PASSED)
      )
      ;; Proposal failed
      (begin
        (map-set proposals proposal-id
          (merge proposal { status: PROPOSAL-FAILED }))
        (print { event: "proposal-failed", id: proposal-id })
        (ok PROPOSAL-FAILED)
      )
    )
  )
)

;; ============================================================================
;; Proposal Execution
;; ============================================================================

(define-public (execute-proposal (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
    )
    (asserts! (is-eq (get status proposal) PROPOSAL-PASSED) ERR-PROPOSAL-NOT-ACTIVE)
    (asserts! (not (get executed proposal)) ERR-ALREADY-EXECUTED)
    (asserts! (>= block-height (+ (get end-block proposal) (var-get execution-delay)))
              ERR-EXECUTION-DELAY-NOT-MET)
    (asserts! (<= block-height (+ (get end-block proposal) (var-get execution-delay) (var-get execution-window)))
              ERR-PROPOSAL-EXPIRED)

    (map-set proposals proposal-id
      (merge proposal {
        status: PROPOSAL-EXECUTED,
        executed: true,
        execution-block: block-height
      }))

    (print {
      event: "proposal-executed",
      id: proposal-id,
      executor: tx-sender,
      block: block-height
    })

    (ok true)
  )
)

;; ============================================================================
;; Delegation
;; ============================================================================

(define-public (delegate-to (delegate principal))
  (begin
    (asserts! (not (is-eq delegate tx-sender)) ERR-INVALID-PARAMS)
    (ok (map-set delegations tx-sender delegate))
  )
)

(define-public (revoke-delegation)
  (begin
    (map-delete delegations tx-sender)
    (ok true)
  )
)

;; ============================================================================
;; Cancel Proposal
;; ============================================================================

(define-public (cancel-proposal (proposal-id uint))
  (let
    ((proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND)))
    (asserts! (or
      (is-eq tx-sender (get proposer proposal))
      (is-eq tx-sender CONTRACT-OWNER))
      ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status proposal) PROPOSAL-ACTIVE) ERR-PROPOSAL-NOT-ACTIVE)
    (ok (map-set proposals proposal-id
      (merge proposal { status: PROPOSAL-CANCELLED })))
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-voting-period (blocks uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> blocks u0) ERR-INVALID-PARAMS)
    (ok (var-set voting-period blocks))
  )
)

(define-public (set-quorum-percentage (percentage uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (and (> percentage u0) (<= percentage u100)) ERR-INVALID-PARAMS)
    (ok (var-set quorum-percentage percentage))
  )
)

(define-public (set-proposal-threshold (threshold uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set proposal-threshold threshold))
  )
)

(define-public (toggle-governance-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set governance-paused (not (var-get governance-paused))))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id)
)

(define-read-only (get-vote (proposal-id uint) (voter principal))
  (map-get? votes { proposal-id: proposal-id, voter: voter })
)

(define-read-only (get-delegate (delegator principal))
  (map-get? delegations delegator)
)

(define-read-only (get-governance-stats)
  {
    proposal-count: (var-get proposal-count),
    voting-period: (var-get voting-period),
    execution-delay: (var-get execution-delay),
    quorum-percentage: (var-get quorum-percentage),
    proposal-threshold: (var-get proposal-threshold),
    is-paused: (var-get governance-paused)
  }
)

(define-read-only (get-proposal-count)
  (var-get proposal-count)
)
