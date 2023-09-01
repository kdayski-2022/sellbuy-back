-- SELECT * FROM "Users" WHERE address = '0xcccd0e2d04ddd767920e7817a24f6627eee15802';

-- SELECT * FROM "AirdropParticipants" WHERE address = '0xcccd0e2d04ddd767920e7817a24f6627eee15802' ORDER BY id DESC;

-- SELECT * FROM "AirdropParticipants" WHERE address = '0x1d28410fb37973b7661aadd9ba8bf02e0ccb97c1' ORDER BY id DESC;

-- -- SELECT * FROM "AirdropParticipants" ORDER BY serial_number DESC;

SELECT serial_number, deal_made, link_shared, "createdAt" FROM "AirdropParticipants" WHERE serial_number <= 100 and deal_made = true order by serial_number;


-- SELECT * FROM "Airdrops";

-- SELECT * FROM "Users" WHERE id = 182;
-- SELECT * FROM "Users" WHERE ref_user_id = 182;
-- SELECT "userAddress", "createdAt" FROM "Logs" WHERE "action" = 'addReferral' AND "requestParams" LIKE '{"ref_code":"a4d761%' ORDER BY id DESC LIMIT 1000;
