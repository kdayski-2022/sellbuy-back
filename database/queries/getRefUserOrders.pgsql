-- SELECT * FROM "Users" WHERE ref_user_id = 72

select * from "Orders" where "from" = ANY(ARRAY[
  '0xa97adcff99016486bc4c654fe633980a0e63d91b',
  '0x089d00eaae2279c7bd326874765f5be1fc835560',
  '0xb4fa8d8e7b7dbabec5b299dc8f426f91fc0eb856',
  '0xdc2183446eca892ef1cd5439d48f3547c97f2418',
  '0xb04536dab8823e20288f825e162bb7ddea089ecf',
  '0x0019f1d091e82ac74054398c3266d45c4cadcdbb',
  '0xb74914ed26f1e07b7518b253e2e58c74e51c1432',
  '0xa30b9c9f087e07316881f26dd0e233707ecc1397',
  '0xac6a6d25159548605c9d1c1cf4273fa8697d1cfe'
])