SELECT * FROM "Users" WHERE address = '0x2c23cc1f263c72779bf2c548086d34013db092cd' ORDER BY id DESC;

SELECT id, "from", status, user_payment_tx_hash, "createdAt" FROM "Orders" WHERE ("from" = '0x9d1a5bb503b360d7b268cb4cdba5a6d589fe0e4c' OR "from" = '0xa3b9308cdfa23ef7e42750f6f666dfdefb254735' OR "from" = '0x2c23cc1f263c72779bf2c548086d34013db092cd' OR "from" = '0x862f62c949401a4b3fa1164fa914e36b5aaba3b9' OR "from" = '0xd2681ee13bbb8ef122ad9ff28fc9bd5fedfd70c5' OR "from" = '0x0943d7ddda4ac5b880452fea3531f802613bec7b' OR "from" = '0x6996041815387292033a6307402fa321d33b3a5b' OR "from" = '0xa606cdeecf59faa676855579b25e0224aa64e3f0' OR "from" = '0x7ae3c44780c99f2581f90a1c1eb02dab44cd745e' OR "from" = '0x5ab3ea64339e031f0a027b8383041501ecc85aed' OR "from" = '0xac6a6d25159548605c9d1c1cf4273fa8697d1cfe' OR "from" = '0xa30b9c9f087e07316881f26dd0e233707ecc1397' OR "from" = '0x0019f1d091e82ac74054398c3266d45c4cadcdbb' OR "from" = '0xb04536dab8823e20288f825e162bb7ddea089ecf' OR "from" = '0xb74914ed26f1e07b7518b253e2e58c74e51c1432' OR "from" = '0xdc2183446eca892ef1cd5439d48f3547c97f2418' OR "from" = '0xb4fa8d8e7b7dbabec5b299dc8f426f91fc0eb856' OR "from" = '0x089d00eaae2279c7bd326874765f5be1fc835560' OR "from" = '0xa97adcff99016486bc4c654fe633980a0e63d91b') ORDER BY "from";

INSERT INTO "ReferralPayouts"(address, order_id, tx_hash, paid, "createdAt", "updatedAt")
VALUES ('0xb74914ed26f1e07b7518b253e2e58c74e51c1432', '361', '0x20f34616378d0d95b3c012e587ff67038097d2595d2989c2410a0feba5c941e4', false, '2023-06-07', '2023-06-07');

SELECT * FROM "ReferralPayouts" WHERE address = '0xb74914ed26f1e07b7518b253e2e58c74e51c1432' ORDER BY id DESC;


SELECT * FROM "Users" WHERE id = 105;
SELECT * FROM "Users" WHERE ref_user_id = 105;

SELECT "userAddress", MAX("sessionToken") AS "sessionToken"
FROM "UserSessions"
WHERE "sessionToken" IN (
    SELECT "sessionToken"
    FROM "Utms"
    WHERE "ref" = '3c58f0' AND "userAddress" != 'undefined'
    ORDER BY id DESC
)
GROUP BY "userAddress";