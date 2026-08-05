import sqlite3
import os

DB_PATH = 'data_dump/documents.db'

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check if columns exist
cursor.execute("PRAGMA table_info(Meetings)")
columns = [col[1] for col in cursor.fetchall()]

new_columns = [
    ("MeetingType", "TEXT"),
    ("OnlineMeetingUrl", "TEXT"),
    ("ProgramFilePaths", "TEXT"),
    ("InvitationFilePaths", "TEXT")
]

for col_name, col_type in new_columns:
    if col_name not in columns:
        print(f"Adding column {col_name} to Meetings...")
        cursor.execute(f"ALTER TABLE Meetings ADD COLUMN {col_name} {col_type}")

conn.commit()
conn.close()
print("Migration completed.")
