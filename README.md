# Mend

An Acme-inspired maintenance request workspace built with **Common Lisp (CLISP)** and **XAMPP’s MariaDB**. The interface uses plain HTML, CSS, and JavaScript, with no frontend build step or external assets. All database operations, validation, and HTTP routing run in Lisp. No PHP is used.

## Run on your Mac

1. Open XAMPP Manager and start **MySQL**. Apache is not required: the Lisp program serves the app itself.
2. In Terminal:

   ```sh
   cd /Users/xguo/Research/mend
   ./start.sh
   ```

3. Open **http://localhost:4242**.

CLISP is already installed on this computer. On another Mac, install it with `brew install clisp`.

On startup, Mend creates the dedicated `mend` database and `requests` table if needed. Existing records are preserved. Database changes persist between server restarts. Stop the server with **Ctrl+C**.

To add the six optional demonstration records:

```sh
./start.sh --demo
```

This loads samples only when the requests table is empty. Stop any existing Mend server before running this command. Normal startup never adds samples.

## Use the app

- **New request** opens the form for the requested date, room/location, requester, description, priority, and status.
- **Edit** loads an existing request. **Save changes** updates that record.
- **Delete** opens a confirmation before removing the record.
- Search by request ID, room, requester, description, or date. Press `/` to focus search.
- Filter with the status commands and priority selector. Sort by creation order or priority. **Reset** clears all filters; **Refresh** reloads the database records.
- **Clear form** empties editable details while keeping the identity of the record being edited.

The application reports connection failures, field validation errors, and successful changes. Dialogs support keyboard focus and Escape. The layout adapts to small screens; the request table scrolls horizontally when necessary.

## Interface

The dashboard follows [Acme’s tag/body design](https://9fans.github.io/plan9port/man/man1/acme.html): pale cyan command bars, a pale yellow document area, compact monospaced text, square borders, and text actions. A single request pane replaces dashboard cards and navigation panels. Status totals appear on one line; descriptions display in full. Dialogs use the same palette and command layout.

Palette values follow the [Plan 9 Acme source](https://github.com/9fans/plan9port/blob/master/src/cmd/acme/acme.c): `#ffffea` body, `#eaffff` tag, `#eeee9e` body selection, and `#9eeeee` tag selection. The table scrolls horizontally on narrow screens and can be focused with the keyboard.

## Database settings

Defaults match a standard macOS XAMPP installation: user `root`, no password, and the Unix socket at `/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock`.

If your XAMPP account has a password, enter it without placing it in shell history:

```sh
read -s MEND_DB_PASSWORD
export MEND_DB_PASSWORD
./start.sh
```

Optional environment variables:

| Variable | Default |
| --- | --- |
| `MEND_PORT` | `4242` |
| `MEND_DB_NAME` | `mend` |
| `MEND_DB_USER` | `root` |
| `MEND_DB_PASSWORD` | empty |
| `MEND_MYSQL` | `/Applications/XAMPP/xamppfiles/bin/mysql` |
| `MEND_DB_SOCKET` | `/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock` |

For example, `MEND_PORT=4343 ./start.sh` uses another port. `.env.example` documents the settings; `.env` files are not automatically executed.

To inspect records in phpMyAdmin, open XAMPP’s phpMyAdmin and select **mend → requests**. The SQL schema is in [`db/schema.sql`](db/schema.sql). You may import it manually after creating/selecting a database, but this is unnecessary for normal startup. Dropping the table is optional in the assignment and intentionally has no button in the app.

## Implementation

| File | Responsibility |
| --- | --- |
| `start.sh`, `start.lisp` | Configure runtime, load sources, start the server |
| `src/core.lisp` | UTF-8 encoding, form parsing, JSON serialization, configuration |
| `src/database.lisp` | Table creation, field validation, SQL insert/select/update/delete |
| `src/http.lisp` | Local HTTP server routing, request limits, response headers, CSRF checks |
| `src/main.lisp` | Startup, optional sample data, connection loop |
| `db/schema.sql` | Requests table and indexes |
| `db/demo.sql` | Optional sample requests |
| `public/` | Responsive UI and database-backed browser interactions |
| `tests/integration.py` | End-to-end HTTP and MariaDB verification |

The database adapter invokes XAMPP’s `mysql` executable directly, without a shell or third-party Lisp libraries. UTF-8 text is passed as hexadecimal SQL literals, and IDs are validated as positive integers. Query results use hex-encoded text columns so tabs and newlines round-trip correctly. Temporary SQL/output files live in a private `.runtime/` directory and are removed after each query. Credentials are passed through the process environment, never command-line arguments.

This is a local, single-user coursework app. It binds to `127.0.0.1`, validates Host and Origin, protects mutations with a random CSRF token, and renders user input as text. It has a small sequential HTTP server and opens a MySQL client process per query. Internet hosting or multi-user deployment would require authentication and a production HTTP server/database driver.

## Verify

With XAMPP MySQL running:

```sh
python3 tests/integration.py
```

The test starts its own Lisp server on an available port, creates a uniquely named `mend_test_…` database, verifies CRUD, restart persistence, Unicode/SQL-like data handling, validation, and request protections, then removes only its own test database. Your `mend` records are untouched.

## Troubleshooting

- **Database connection failed:** start MySQL in XAMPP, then check the socket/user/password settings above.
- **Address already in use:** another Mend server may be running. Use its page, stop that server, or choose another `MEND_PORT`.
- **Refresh the page and try again:** restarting the server rotates its CSRF token; refresh the browser to obtain the new token.
- **Cannot find `clisp`:** ensure `/opt/homebrew/bin` is on `PATH`, or install CLISP.

## Assignment coverage

| Requirement | Implementation |
| --- | --- |
| Create a table | Automatic, idempotent startup using `schema.sql` |
| Insert data | New request form → Lisp `save-request` → SQL `INSERT` |
| Display existing requests | Lisp `request-rows` → JSON → request board |
| Update a request | Edit form → Lisp `save-request` with ID → SQL `UPDATE` |
| Delete a request | Confirmation dialog → Lisp `delete-request` → SQL `DELETE` |
| Drop table (optional) | Not exposed; can be done manually in phpMyAdmin |
