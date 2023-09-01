SELECT amount, price, instrument_name, direction, "from", recieve, status, start_index_price, end_index_price, chain_id FROM "Orders"
WHERE execute_date > '2023-08-10'
AND execute_date < '2023-08-12' ORDER BY amount DESC;


SELECT "action", "requestParams", status, error FROM "Logs" ORDER BY id DESC LIMIT 1000;