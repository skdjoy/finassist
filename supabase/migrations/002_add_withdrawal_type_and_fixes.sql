-- 1. Add withdrawal type to CHECK constraint
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('expense', 'income', 'transfer', 'top_up', 'withdrawal'));

-- 2. Fix City Bank deposits: category "transfer" -> "income"
UPDATE transactions
SET category = 'income'
WHERE source = 'citybank_deposit' AND type = 'income' AND category = 'transfer';

-- 3. Reclassify ATM withdrawals from "transfer" to "withdrawal"
UPDATE transactions
SET type = 'withdrawal', category = 'withdrawal'
WHERE source = 'scb_card' AND type = 'transfer' AND description LIKE 'Withdrawal%';
