/**
 * Derived Nat lemmas that real Lean core has but the base library deliberately omits (learners
 * prove them; the content's lemma bank adds them). Tests load these with `engine.extend` so that
 * corpora such as `lean-verify/Game/Smoke.lean` can be checked.
 */
export const NAT_LEMMAS = String.raw`
theorem Nat.zero_add (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]

theorem Nat.succ_add (n m : Nat) : Nat.succ n + m = Nat.succ (n + m) := by
  induction m with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, ih]; rfl

theorem Nat.add_comm (n m : Nat) : n + m = m + n := by
  induction m with
  | zero => rw [Nat.zero_add]; rfl
  | succ k ih => rw [Nat.add_succ, ih, Nat.succ_add]

theorem Nat.add_assoc (n m k : Nat) : n + m + k = n + (m + k) := by
  induction k with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, Nat.add_succ, Nat.add_succ, ih]

theorem Nat.add_left_comm (n m k : Nat) : n + (m + k) = m + (n + k) := by
  rw [← Nat.add_assoc, ← Nat.add_assoc, Nat.add_comm n m]

theorem Nat.zero_mul (n : Nat) : 0 * n = 0 := by
  induction n with
  | zero => rfl
  | succ k ih => rw [Nat.mul_succ, ih]

theorem Nat.succ_mul (n m : Nat) : Nat.succ n * m = n * m + m := by
  induction m with
  | zero => rfl
  | succ k ih => rw [Nat.mul_succ, Nat.mul_succ, ih, Nat.add_succ, Nat.add_succ, Nat.add_assoc, Nat.add_comm k n, ← Nat.add_assoc]

theorem Nat.mul_one (n : Nat) : n * 1 = n := Nat.zero_add n

theorem Nat.one_mul (n : Nat) : 1 * n = n := by
  rw [Nat.succ_mul, Nat.zero_mul, Nat.zero_add]

theorem Nat.mul_comm (n m : Nat) : n * m = m * n := by
  induction m with
  | zero => rw [Nat.zero_mul]; rfl
  | succ k ih => rw [Nat.mul_succ, Nat.succ_mul, ih]

theorem Nat.left_distrib (n m k : Nat) : n * (m + k) = n * m + n * k := by
  induction k with
  | zero => rfl
  | succ k ih => rw [Nat.add_succ, Nat.mul_succ, Nat.mul_succ, ih, Nat.add_assoc]

theorem Nat.mul_add (n m k : Nat) : n * (m + k) = n * m + n * k := Nat.left_distrib n m k

theorem Nat.mul_assoc (n m k : Nat) : n * m * k = n * (m * k) := by
  induction k with
  | zero => rfl
  | succ k ih => rw [Nat.mul_succ, Nat.mul_succ, ih, Nat.mul_add]

theorem Nat.two_mul (n : Nat) : 2 * n = n + n := by
  rw [Nat.succ_mul, Nat.one_mul]
`;
