SELECT
    "from" AS address,
    SUM(
        CASE
            WHEN direction = 'sell' THEN amount * start_index_price
            WHEN direction = 'buy' THEN amount * price
            ELSE 0 -- Handle other cases, if any
        END
    ) AS total_amount
FROM "Orders"
WHERE "createdAt" > '2023-09-01'
GROUP BY "from"
ORDER BY total_amount DESC;