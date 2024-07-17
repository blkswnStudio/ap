INSERT INTO sgd1.token_candle_singleton (block_range, id, token, timestamp, open, high, low, close, volume, candle_size)
VALUES
('[1,2]', 'Candle1', '\x1234567890abcdef', 1000000, 100.0, 110.0, 90.0, 105.0, 1000.0, 1),
('[2,3]', 'Candle2', '\xabcdef1234567890', 1001000, 105.0, 115.0, 95.0, 110.0, 1500.0, 1),
('[3,4]', 'Candle3', '\xfeedface12345678', 1002000, 110.0, 120.0, 100.0, 115.0, 2000.0, 1),
('[4,5]', 'Candle4', '\xdeadbeef12345678', 1003000, 115.0, 125.0, 105.0, 120.0, 2500.0, 1);
