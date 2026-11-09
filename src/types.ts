export interface Expense {
  id: string;
  amount_cents: number;
  category: string;
  note: string;
  date: string;
  created_at: string;
}

export interface Draft {
  amount_cents: number;
  category: string;
  note: string;
  date: string;
}

export interface Config {
  base_url: string;
  model: string;
  glass: boolean;
}

export interface AppState {
  expenses: Expense[];
  config: Config;
  has_key: boolean;
}
