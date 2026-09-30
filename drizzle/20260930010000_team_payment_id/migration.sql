ALTER TABLE teams ADD COLUMN payment_id VARCHAR(255);

UPDATE teams AS team
SET payment_id = payment.razorpay_payment_id
FROM payments AS payment
WHERE payment.team_id = team.id
  AND payment.status = 'paid'
  AND payment.razorpay_payment_id IS NOT NULL;

ALTER TABLE teams
  ADD CONSTRAINT teams_payment_id_unique UNIQUE (payment_id);

UPDATE teams SET payment_status = 'unpaid' WHERE payment_status IS NULL;
ALTER TABLE teams ALTER COLUMN payment_status SET DEFAULT 'unpaid';
ALTER TABLE teams ALTER COLUMN payment_status SET NOT NULL;

DROP TABLE payments;
DROP TYPE payment_txn_status_enum;