CREATE SEQUENCE "customer_name_sequence"
  AS BIGINT
  MINVALUE 1
  START WITH 1;

SELECT setval(
  'customer_name_sequence',
  COALESCE(
    (
      SELECT MAX((substring("customerName" from 9))::bigint)
      FROM "orders"
      WHERE "customerName" ~ '^Cliente [0-9]+$'
    ),
    0
  ) + 1,
  false
);