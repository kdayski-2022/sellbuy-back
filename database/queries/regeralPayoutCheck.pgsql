SELECT * FROM "Users" WHERE id = 105;

SELECT * FROM "Users" WHERE ref_user_id = 105;

SELECT *
FROM "ReferralPayouts"
WHERE address IN (
    SELECT "address"
    FROM "Users"
    WHERE "ref_user_id" = 105
);

SELECT id, "from", recieve, direction
FROM "Orders"
WHERE "from" IN (
    SELECT "address"
    FROM "Users"
    WHERE "ref_user_id" = 105
);

SELECT "userAddress", "requestParams", status, error, "createdAt" FROM "Logs" WHERE "action" = 'addReferral' AND "requestParams" LIKE '{"ref_code":"e805cf%' ORDER BY id DESC LIMIT 1000;