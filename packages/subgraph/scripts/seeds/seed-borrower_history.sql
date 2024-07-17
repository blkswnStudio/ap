INSERT INTO sgd1.borrower_history (block$, id, pool, borrower, timestamp, block, type, values, claim_in_usd, result_in_usd)
VALUES
(1, '\x1234567890abcdef1', '\xabcdef1234567890', '\xfeedface12345678', 1000000, 100, 'Type1', ARRAY['\x0123', '\x4567']::bytea[], 100.0, 150.0),
(2, '\x1234567890abcdef2', '\xabcdef1234567891', '\xfeedface12345679', 1001000, 101, 'Type2', ARRAY['\x89ab', '\xcded']::bytea[], 200.0, 250.0),
(3, '\x1234567890abcdef3', '\xabcdef1234567892', '\xfeedface12345680', 1002000, 102, 'Type3', ARRAY['\xfeed', '\xbabe']::bytea[], 300.0, 350.0),
(4, '\x1234567890abcdef4', '\xabcdef1234567893', '\xfeedface12345681', 1003000, 103, 'Type4', ARRAY['\xdead', '\xbeef']::bytea[], 400.0, 450.0);
