import argparse
import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List

from dotenv import load_dotenv


TABLES = ("teams", "stage_progress", "submissions", "audit_logs", "dynamic_config")
JSON_COLUMNS = {
    "stage_progress": ("hints_used", "metadata"),
    "submissions": ("payload",),
    "audit_logs": ("details",),
    "dynamic_config": ("value",),
}
BOOLEAN_COLUMNS = {
    "teams": ("is_active",),
    "submissions": ("passed",),
}
BATCH_SIZE = 500


def _decode_json_columns(table: str, record: Dict[str, Any]) -> Dict[str, Any]:
    for column in JSON_COLUMNS.get(table, ()):
        value = record.get(column)
        if isinstance(value, str):
            try:
                record[column] = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in {table}.{column}") from exc
    for column in BOOLEAN_COLUMNS.get(table, ()):
        if column in record and record[column] is not None:
            record[column] = bool(record[column])
    return record


def _read_records(database_path: Path) -> Dict[str, List[Dict[str, Any]]]:
    if not database_path.is_file():
        raise FileNotFoundError(f"SQLite database not found: {database_path}")

    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    try:
        existing = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ?",
                ("table", "sqlite_%"),
            )
        }
        records = {}
        for table in TABLES:
            if table not in existing:
                records[table] = []
                continue
            rows = connection.execute(f'SELECT * FROM "{table}"').fetchall()
            records[table] = [_decode_json_columns(table, dict(row)) for row in rows]
        return records
    finally:
        connection.close()


def _batches(records: List[Dict[str, Any]]) -> Iterable[List[Dict[str, Any]]]:
    for start in range(0, len(records), BATCH_SIZE):
        yield records[start:start + BATCH_SIZE]


def main() -> None:
    parser = argparse.ArgumentParser(description="Import legacy SQLite records into Supabase without deleting target data.")
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=Path(__file__).parent / "data" / "heist_unified.db",
        help="Path to the source SQLite database",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate and report row counts without connecting to Supabase")
    args = parser.parse_args()

    records = _read_records(args.sqlite)
    counts = {table: len(rows) for table, rows in records.items()}
    print(f"Source: {args.sqlite}")
    for table, count in counts.items():
        print(f"{table}: {count} rows")
    if args.dry_run:
        print("Dry run complete; no Supabase changes made.")
        return

    load_dotenv(Path(__file__).parent / ".env")
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env or the environment.")

    from supabase import create_client

    client = create_client(url, key)
    for table in TABLES:
        for batch in _batches(records[table]):
            client.table(table).upsert(batch).execute()
    print("Import complete. Existing Supabase rows were upserted; no rows were deleted.")


if __name__ == "__main__":
    main()