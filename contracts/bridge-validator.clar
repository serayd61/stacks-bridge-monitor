;; ============================================================================
;; Bridge Validator - Decentralized Validator Network
;; ============================================================================
;; Manages the validator network that secures cross-chain bridge operations.
;; Validators stake tokens, validate transactions, and earn rewards.
;; Implements slashing for misbehavior and rotation for security.
;; ============================================================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u14001))
(define-constant ERR-INVALID-AMOUNT (err u14002))
(define-constant ERR-ALREADY-VALIDATOR (err u14003))
(define-constant ERR-NOT-VALIDATOR (err u14004))
(define-constant ERR-INSUFFICIENT-STAKE (err u14005))
(define-constant ERR-VALIDATOR-PAUSED (err u14006))
(define-constant ERR-TX-NOT-FOUND (err u14007))
(define-constant ERR-ALREADY-VALIDATED (err u14008))
(define-constant ERR-CONSENSUS-REACHED (err u14009))
(define-constant ERR-VALIDATOR-JAILED (err u14010))
(define-constant ERR-JAIL-NOT-EXPIRED (err u14011))
(define-constant ERR-MAX-VALIDATORS (err u14012))
(define-constant ERR-SLASH-EVIDENCE-INVALID (err u14013))
(define-constant ERR-COOLDOWN-ACTIVE (err u14014))

;; Validator Statuses
(define-constant STATUS-ACTIVE u0)
(define-constant STATUS-INACTIVE u1)
(define-constant STATUS-JAILED u2)
(define-constant STATUS-EXITING u3)

;; Parameters
(define-constant BPS-DENOMINATOR u10000)
(define-constant MAX-VALIDATORS u50)
(define-constant MIN-CONFIRMATIONS u3) ;; min validators needed for consensus

;; Data Variables
(define-data-var validator-count uint u0)
(define-data-var active-validators uint u0)
(define-data-var min-stake uint u10000000000) ;; 10,000 tokens
(define-data-var total-validator-stake uint u0)
(define-data-var validation-count uint u0)
(define-data-var slash-rate uint u1000) ;; 10% slash penalty
(define-data-var jail-duration uint u4320) ;; ~30 days
(define-data-var exit-cooldown uint u2016) ;; ~14 days
(define-data-var reward-per-validation uint u100000) ;; 0.1 tokens per validation
(define-data-var required-confirmations uint u3)
(define-data-var rotation-interval uint u1008) ;; ~7 days
(define-data-var current-epoch uint u0)
(define-data-var protocol-paused bool false)

;; Validator registry
(define-map validators
  principal
  {
    stake: uint,
    status: uint,
    joined-at: uint,
    last-validation: uint,
    total-validations: uint,
    total-rewards: uint,
    slash-count: uint,
    jail-until: uint,
    exit-requested-at: uint,
    uptime-score: uint,     ;; in bps (10000 = 100%)
    commission-rate: uint   ;; in bps
  }
)

;; Validator index for enumeration
(define-map validator-index uint principal)

;; Transaction validations
(define-map tx-validations
  uint ;; tx-id
  {
    tx-hash: (buff 32),
    source-chain: (string-ascii 16),
    dest-chain: (string-ascii 16),
    amount: uint,
    sender: (buff 32),
    recipient: principal,
    confirmations: uint,
    required: uint,
    is-confirmed: bool,
    submitted-at: uint
  }
)

;; Individual validator votes on transactions
(define-map validation-votes
  { tx-id: uint, validator: principal }
  {
    approved: bool,
    voted-at: uint
  }
)

;; Epoch performance tracking
(define-map epoch-performance
  { epoch: uint, validator: principal }
  {
    validations: uint,
    missed: uint,
    rewards: uint
  }
)

;; Delegator stakes to validators
(define-map delegations
  { delegator: principal, validator: principal }
  {
    amount: uint,
    delegated-at: uint,
    rewards-claimed: uint
  }
)

;; Total delegated per validator
(define-map validator-delegated principal uint)

;; ============================================================================
;; Validator Registration
;; ============================================================================

(define-public (register-validator (stake uint) (commission-rate uint))
  (let
    (
      (idx (var-get validator-count))
    )
    (asserts! (not (var-get protocol-paused)) ERR-VALIDATOR-PAUSED)
    (asserts! (< idx MAX-VALIDATORS) ERR-MAX-VALIDATORS)
    (asserts! (is-none (map-get? validators tx-sender)) ERR-ALREADY-VALIDATOR)
    (asserts! (>= stake (var-get min-stake)) ERR-INSUFFICIENT-STAKE)
    (asserts! (<= commission-rate u3000) ERR-INVALID-AMOUNT) ;; max 30% commission

    (map-set validators tx-sender {
      stake: stake,
      status: STATUS-ACTIVE,
      joined-at: block-height,
      last-validation: u0,
      total-validations: u0,
      total-rewards: u0,
      slash-count: u0,
      jail-until: u0,
      exit-requested-at: u0,
      uptime-score: u10000,
      commission-rate: commission-rate
    })

    (map-set validator-index idx tx-sender)
    (var-set validator-count (+ idx u1))
    (var-set active-validators (+ (var-get active-validators) u1))
    (var-set total-validator-stake (+ (var-get total-validator-stake) stake))

    (print {
      event: "validator-registered",
      validator: tx-sender,
      stake: stake,
      commission: commission-rate,
      index: idx
    })

    (ok idx)
  )
)

(define-public (increase-stake (amount uint))
  (let
    (
      (validator (unwrap! (map-get? validators tx-sender) ERR-NOT-VALIDATOR))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (is-eq (get status validator) STATUS-ACTIVE) ERR-VALIDATOR-JAILED)

    (map-set validators tx-sender
      (merge validator { stake: (+ (get stake validator) amount) }))

    (var-set total-validator-stake (+ (var-get total-validator-stake) amount))

    (print {
      event: "stake-increased",
      validator: tx-sender,
      amount: amount,
      new-total: (+ (get stake validator) amount)
    })

    (ok true)
  )
)

(define-public (request-exit)
  (let
    (
      (validator (unwrap! (map-get? validators tx-sender) ERR-NOT-VALIDATOR))
    )
    (asserts! (is-eq (get status validator) STATUS-ACTIVE) ERR-VALIDATOR-JAILED)

    (map-set validators tx-sender
      (merge validator {
        status: STATUS-EXITING,
        exit-requested-at: block-height
      }))

    (var-set active-validators (- (var-get active-validators) u1))

    (print {
      event: "exit-requested",
      validator: tx-sender,
      cooldown-ends: (+ block-height (var-get exit-cooldown))
    })

    (ok true)
  )
)

(define-public (complete-exit)
  (let
    (
      (validator (unwrap! (map-get? validators tx-sender) ERR-NOT-VALIDATOR))
    )
    (asserts! (is-eq (get status validator) STATUS-EXITING) ERR-NOT-VALIDATOR)
    (asserts! (>= block-height (+ (get exit-requested-at validator) (var-get exit-cooldown)))
              ERR-COOLDOWN-ACTIVE)

    (var-set total-validator-stake (- (var-get total-validator-stake) (get stake validator)))

    (map-set validators tx-sender
      (merge validator { status: STATUS-INACTIVE, stake: u0 }))

    (print {
      event: "validator-exited",
      validator: tx-sender,
      stake-returned: (get stake validator),
      total-validations: (get total-validations validator)
    })

    (ok (get stake validator))
  )
)

;; ============================================================================
;; Transaction Validation
;; ============================================================================

(define-public (submit-transaction
    (tx-hash (buff 32))
    (source-chain (string-ascii 16))
    (dest-chain (string-ascii 16))
    (amount uint)
    (sender-addr (buff 32))
    (recipient principal)
  )
  (let
    (
      (tx-id (var-get validation-count))
      (validator (unwrap! (map-get? validators tx-sender) ERR-NOT-VALIDATOR))
    )
    (asserts! (is-eq (get status validator) STATUS-ACTIVE) ERR-VALIDATOR-JAILED)
    (asserts! (not (var-get protocol-paused)) ERR-VALIDATOR-PAUSED)

    (map-set tx-validations tx-id {
      tx-hash: tx-hash,
      source-chain: source-chain,
      dest-chain: dest-chain,
      amount: amount,
      sender: sender-addr,
      recipient: recipient,
      confirmations: u1,
      required: (var-get required-confirmations),
      is-confirmed: false,
      submitted-at: block-height
    })

    ;; Auto-vote for submitter
    (map-set validation-votes { tx-id: tx-id, validator: tx-sender }
      { approved: true, voted-at: block-height })

    (var-set validation-count (+ tx-id u1))

    ;; Update validator stats
    (map-set validators tx-sender
      (merge validator {
        last-validation: block-height,
        total-validations: (+ (get total-validations validator) u1)
      }))

    (print {
      event: "tx-submitted",
      tx-id: tx-id,
      submitter: tx-sender,
      tx-hash: tx-hash,
      source: source-chain,
      dest: dest-chain,
      amount: amount
    })

    (ok tx-id)
  )
)

(define-public (validate-transaction (tx-id uint) (approve bool))
  (let
    (
      (tx-val (unwrap! (map-get? tx-validations tx-id) ERR-TX-NOT-FOUND))
      (validator (unwrap! (map-get? validators tx-sender) ERR-NOT-VALIDATOR))
      (existing-vote (map-get? validation-votes { tx-id: tx-id, validator: tx-sender }))
    )
    (asserts! (is-eq (get status validator) STATUS-ACTIVE) ERR-VALIDATOR-JAILED)
    (asserts! (not (get is-confirmed tx-val)) ERR-CONSENSUS-REACHED)
    (asserts! (is-none existing-vote) ERR-ALREADY-VALIDATED)

    ;; Record vote
    (map-set validation-votes { tx-id: tx-id, validator: tx-sender }
      { approved: approve, voted-at: block-height })

    ;; Update confirmation count if approved
    (let
      (
        (new-confirmations (if approve
          (+ (get confirmations tx-val) u1)
          (get confirmations tx-val)))
        (is-now-confirmed (>= new-confirmations (get required tx-val)))
      )
      (map-set tx-validations tx-id
        (merge tx-val {
          confirmations: new-confirmations,
          is-confirmed: is-now-confirmed
        }))

      ;; Update validator stats
      (map-set validators tx-sender
        (merge validator {
          last-validation: block-height,
          total-validations: (+ (get total-validations validator) u1),
          total-rewards: (+ (get total-rewards validator) (var-get reward-per-validation))
        }))

      (print {
        event: "tx-validated",
        tx-id: tx-id,
        validator: tx-sender,
        approved: approve,
        confirmations: new-confirmations,
        consensus-reached: is-now-confirmed
      })

      (ok is-now-confirmed)
    )
  )
)

;; ============================================================================
;; Slashing
;; ============================================================================

(define-public (slash-validator (validator-addr principal) (evidence-hash (buff 32)))
  (let
    (
      (validator (unwrap! (map-get? validators validator-addr) ERR-NOT-VALIDATOR))
      (slash-amount (/ (* (get stake validator) (var-get slash-rate)) BPS-DENOMINATOR))
    )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status validator) STATUS-ACTIVE) ERR-VALIDATOR-JAILED)

    (map-set validators validator-addr
      (merge validator {
        stake: (- (get stake validator) slash-amount),
        status: STATUS-JAILED,
        slash-count: (+ (get slash-count validator) u1),
        jail-until: (+ block-height (var-get jail-duration)),
        uptime-score: (/ (* (get uptime-score validator) u9) u10)
      }))

    (var-set total-validator-stake (- (var-get total-validator-stake) slash-amount))
    (var-set active-validators (- (var-get active-validators) u1))

    (print {
      event: "validator-slashed",
      validator: validator-addr,
      slash-amount: slash-amount,
      evidence: evidence-hash,
      jail-until: (+ block-height (var-get jail-duration))
    })

    (ok slash-amount)
  )
)

(define-public (unjail)
  (let
    (
      (validator (unwrap! (map-get? validators tx-sender) ERR-NOT-VALIDATOR))
    )
    (asserts! (is-eq (get status validator) STATUS-JAILED) ERR-NOT-VALIDATOR)
    (asserts! (>= block-height (get jail-until validator)) ERR-JAIL-NOT-EXPIRED)
    (asserts! (>= (get stake validator) (var-get min-stake)) ERR-INSUFFICIENT-STAKE)

    (map-set validators tx-sender
      (merge validator { status: STATUS-ACTIVE }))

    (var-set active-validators (+ (var-get active-validators) u1))

    (print {
      event: "validator-unjailed",
      validator: tx-sender,
      block: block-height
    })

    (ok true)
  )
)

;; ============================================================================
;; Delegation
;; ============================================================================

(define-public (delegate-to-validator (validator-addr principal) (amount uint))
  (let
    (
      (validator (unwrap! (map-get? validators validator-addr) ERR-NOT-VALIDATOR))
      (existing (map-get? delegations { delegator: tx-sender, validator: validator-addr }))
      (current-delegated (default-to u0 (map-get? validator-delegated validator-addr)))
    )
    (asserts! (is-eq (get status validator) STATUS-ACTIVE) ERR-VALIDATOR-JAILED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    (match existing
      prev-del
        (map-set delegations { delegator: tx-sender, validator: validator-addr }
          (merge prev-del { amount: (+ (get amount prev-del) amount) }))
      (map-set delegations { delegator: tx-sender, validator: validator-addr }
        { amount: amount, delegated-at: block-height, rewards-claimed: u0 })
    )

    (map-set validator-delegated validator-addr (+ current-delegated amount))

    (print {
      event: "delegated",
      delegator: tx-sender,
      validator: validator-addr,
      amount: amount
    })

    (ok true)
  )
)

;; ============================================================================
;; Admin Functions
;; ============================================================================

(define-public (set-min-stake (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set min-stake amount))
  )
)

(define-public (set-required-confirmations (count uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (>= count u1) ERR-INVALID-AMOUNT)
    (ok (var-set required-confirmations count))
  )
)

(define-public (set-slash-rate (rate uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= rate u5000) ERR-INVALID-AMOUNT) ;; max 50% slash
    (ok (var-set slash-rate rate))
  )
)

(define-public (set-reward-per-validation (reward uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set reward-per-validation reward))
  )
)

(define-public (toggle-protocol-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ok (var-set protocol-paused (not (var-get protocol-paused))))
  )
)

(define-public (advance-epoch)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set current-epoch (+ (var-get current-epoch) u1))
    (print { event: "epoch-advanced", epoch: (var-get current-epoch) })
    (ok (var-get current-epoch))
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-validator-info (validator principal))
  (map-get? validators validator)
)

(define-read-only (get-tx-validation (tx-id uint))
  (map-get? tx-validations tx-id)
)

(define-read-only (get-validation-vote (tx-id uint) (validator principal))
  (map-get? validation-votes { tx-id: tx-id, validator: validator })
)

(define-read-only (get-delegation (delegator principal) (validator principal))
  (map-get? delegations { delegator: delegator, validator: validator })
)

(define-read-only (get-validator-delegated (validator principal))
  (default-to u0 (map-get? validator-delegated validator))
)

(define-read-only (get-validator-stats)
  {
    total-validators: (var-get validator-count),
    active-validators: (var-get active-validators),
    total-stake: (var-get total-validator-stake),
    min-stake: (var-get min-stake),
    total-validations: (var-get validation-count),
    required-confirmations: (var-get required-confirmations),
    current-epoch: (var-get current-epoch),
    slash-rate: (var-get slash-rate),
    reward-per-validation: (var-get reward-per-validation),
    is-paused: (var-get protocol-paused)
  }
)

(define-read-only (is-tx-confirmed (tx-id uint))
  (match (map-get? tx-validations tx-id)
    tx-val (get is-confirmed tx-val)
    false
  )
)

(define-read-only (get-validator-by-index (index uint))
  (map-get? validator-index index)
)

(define-read-only (get-epoch-stats (epoch uint) (validator principal))
  (map-get? epoch-performance { epoch: epoch, validator: validator })
)
