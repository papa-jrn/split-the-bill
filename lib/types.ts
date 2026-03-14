export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles?: Profile;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  email: string;
  invited_by: string;
  created_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: Profile;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount_cents: number;
  paid_by: string;
  created_by: string;
  expense_date: string;
  created_at: string;
  profiles?: Profile;
  expense_splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount_cents: number;
  profiles?: Profile;
}

export interface GroupWithDetails extends Group {
  group_members: GroupMember[];
  expenses: Expense[];
}

export interface Balance {
  userId: string;
  displayName: string;
  balance: number; // positive = owed money, negative = owes money
}

export interface Settlement {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

// Utility function to format cents as currency
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// Utility function to parse currency string to cents
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}
