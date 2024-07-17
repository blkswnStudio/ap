INSERT INTO sgd1.swap_event (block$, id, borrower, timestamp, token, direction, size, total_price_in_stable, swap_fee)
VALUES
(1, 'Swap1', 'Borrower1', 1000000, '\x1234567890abcdef', 'Long', 1000.0, 5000.0, 100.0),
(2, 'Swap2', 'Borrower2', 1001000, '\xabcdef1234567890', 'Short', 2000.0, 5500.0, 150.0),
(3, 'Swap3', 'Borrower3', 1002000, '\xfeedface12345678', 'Long', 3000.0, 6000.0, 200.0),
(4, 'Swap4', 'Borrower4', 1003000, '\xdeadbeef12345678', 'Short', 4000.0, 6500.0, 250.0);
