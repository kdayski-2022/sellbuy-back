-- SELECT id, amount, user_payment_tx_hash, "from", settlement_date, payout_eth, payout_usdc, payout_tx, direction, start_index_price, target_index_price, end_index_price, order_executed, payout_currency, instrument_name, "createdAt" FROM "Orders" WHERE direction ISNULL

-- SELECT * FROM "Orders" WHERE id = 293

SELECT * FROM "Orders" WHERE execute_date < '2023-07-16' AND (amount ISNULL OR price ISNULL OR instrument_name ISNULL OR execute_date ISNULL OR "from" ISNULL OR payment_complete ISNULL OR order_complete ISNULL OR recieve ISNULL OR status ISNULL OR "createdAt" ISNULL OR "updatedAt" ISNULL OR target_index_price ISNULL OR end_index_price ISNULL OR start_index_price ISNULL OR settlement_date ISNULL OR payout_eth ISNULL OR payout_usdc ISNULL OR payout_tx ISNULL OR direction ISNULL OR autopay ISNULL OR smart_contract ISNULL OR order_executed ISNULL OR payout_currency ISNULL OR commission ISNULL OR chain_id ISNULL or order_hedged ISNULL) ORDER BY execute_date DESC

-- UPDATE "Orders" set direction = 'sell', order_executed = false, payout_currency = 'ETH', payout_usdc = 1665.285402 WHERE id = 6

-- C - sell
-- P - buy