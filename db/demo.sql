-- Optional sample records. Run ./start.sh --demo once to load into an EMPTY table.
INSERT INTO requests (requested_date,room,requested_by,description,priority,status) VALUES
('2026-10-22','E1 · East wing','Alex Morgan','Air conditioning is not cooling the room. Please inspect the thermostat and unit.','high','open'),
('2026-10-22','A2 · Main building','Jamie Chen','Ceiling light flickers near the entrance.','medium','in_progress'),
('2026-10-21','E3 · East wing','Taylor Brooks','Window latch is loose and does not close securely.','high','in_progress'),
('2026-10-21','B12 · Library','Sam Rivera','Door hinge squeaks when opening the study room.','low','open'),
('2026-10-20','C4 · North hall','Jordan Lee','Faucet in the kitchenette has a slow drip.','medium','open'),
('2026-10-19','A8 · Main building','Casey Park','Replace the worn weather strip at the entrance.','low','completed');
