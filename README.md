# Mend

A maintenance request app with a Common Lisp backend, an HTML/CSS/JavaScript frontend, and a local MariaDB database from XAMPP. Supports creating, listing, editing, and deleting requests, plus search and filters.

## Run

Requires macOS, CLISP (`brew install clisp`), and XAMPP.

1. Start **MySQL** in XAMPP Manager.
2. From this project folder, run:

   ```sh
   ./start.sh
   ```

3. Open **http://localhost:4242**. Keep the terminal open; press Ctrl+C to stop.

Apache is not needed for the app. To load sample requests, start with `./start.sh --demo` instead; samples are added only if the table is empty.

## How it works

The browser sends requests to the Lisp server, which reads and writes XAMPP's MariaDB database and returns the results.

| Location | Purpose |
| --- | --- |
| `public/` | Frontend: page, styles, and browser interactions |
| `src/` | Backend: HTTP server, validation, and SQL operations |
| `db/schema.sql` | Table definition, applied automatically at startup |
| `db/demo.sql` | Optional sample records |
| `start.sh`, `start.lisp` | Start the Lisp server |
| `tests/integration.py` | End-to-end checks using a separate temporary database |

The database is named **mend** and its table is **requests**. Both are created automatically if missing. Records persist after the app stops. The live database belongs to XAMPP, outside this project; on this Mac its files are in `/Applications/XAMPP/xamppfiles/var/mysql/`.

Default connection: XAMPP's local socket, user `root`, no password. See `.env.example` for environment variables if your setup differs; export them in your shell. The app does not automatically load `.env` files.

## Test

With XAMPP MySQL running:

```sh
python3 tests/integration.py
```

## Submit

From the project folder, after committing your changes:

```sh
git archive --format=zip --prefix=mend/ --output=../mend-submission.zip HEAD
```

Submit **mend-submission.zip**. It contains the committed frontend, backend, SQL, startup scripts, tests, and this README. Git history, local credentials, temporary files, and the live database are excluded. The recipient starts their own XAMPP MySQL and runs the app to recreate the database; `--demo` loads sample records.

This version uses Common Lisp rather than the PHP named in the assignment. Confirm that your instructor accepts the language change. The optional drop-table action is omitted.
