
CREATE TABLE public.mock_cards (
  card_id text PRIMARY KEY,
  customer_id text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  last4 text NOT NULL,
  expiry text NOT NULL,
  brand text NOT NULL DEFAULT 'VISA',
  alias text,
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  daily_limit numeric NOT NULL DEFAULT 5000,
  pan text NOT NULL,
  cvv text NOT NULL,
  pin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mock_cards TO service_role;
ALTER TABLE public.mock_cards ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mock_card_txns (
  id text PRIMARY KEY,
  card_id text NOT NULL REFERENCES public.mock_cards(card_id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  merchant text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mock_card_txns TO service_role;
ALTER TABLE public.mock_card_txns ENABLE ROW LEVEL SECURITY;

CREATE INDEX mock_cards_customer_id_idx ON public.mock_cards(customer_id);
CREATE INDEX mock_card_txns_card_id_idx ON public.mock_card_txns(card_id);

-- Deterministic demo seed
INSERT INTO public.mock_cards (card_id, customer_id, type, status, last4, expiry, brand, alias, balance, currency, daily_limit, pan, cvv, pin) VALUES
  ('card_demo_daily',  'cus_demo', 'virtual',  'active', '4829', '08/29', 'VISA', 'Daily Spend', 1842.60, 'USD', 5000,  '4829 3819 4432 4829', '321', '4821'),
  ('card_demo_wallet', 'cus_demo', 'physical', 'active', '9130', '11/28', 'VISA', 'Wallet Card',  620.40, 'USD', 10000, '4829 3819 4432 9130', '774', '9013'),
  ('card_demo_trip',   'cus_demo', 'travel',   'active', '2246', '03/30', 'VISA', 'Trip Card',    980.00, 'USD', 7500,  '4829 3819 4432 2246', '556', '2244');

INSERT INTO public.mock_card_txns (id, card_id, amount, currency, merchant, category, status, timestamp) VALUES
  ('txn_demo_daily_1',  'card_demo_daily',  -24.50,  'USD', 'Starbucks',   'Food & Drink', 'cleared',  now() - interval '1 hour'),
  ('txn_demo_daily_2',  'card_demo_daily',  -128.90, 'USD', 'Apple Store', 'Shopping',     'settled',  now() - interval '1 day'),
  ('txn_demo_wallet_1', 'card_demo_wallet', -42.00,  'USD', 'Uber',        'Transport',    'cleared',  now() - interval '2 hours'),
  ('txn_demo_trip_1',   'card_demo_trip',   -310.00, 'USD', 'Delta',       'Travel',       'settled',  now() - interval '3 days');
