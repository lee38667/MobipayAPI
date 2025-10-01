type Tx = { transaction_id: string; account: string; amount: number; currency: string; paid_for: number; promax_action: string; promax_response: any; receipt_path: string; status: string };
type Client = { user_id: string; username: string; email?: string; account_reference?: string };

export const store = {
  transactions: new Map<string, Tx>(),
  clients: new Map<string, Client>()
};
