SELECT
  "from" AS address,
  SUM(("recieve" / "commission") * (1 - "commission")) AS total_earnings,
  COUNT(*) AS total_transactions
FROM
  "Orders"
GROUP BY
  "from"
ORDER BY
  total_earnings DESC
LIMIT 15;
