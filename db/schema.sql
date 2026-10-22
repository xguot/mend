-- Applied automatically on startup. Existing records are preserved.
CREATE TABLE IF NOT EXISTS requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requested_date DATE NOT NULL,
  room VARCHAR(40) NOT NULL,
  requested_by VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'completed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status_priority (status, priority),
  INDEX idx_requested_date (requested_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
