import os
import shutil
import sqlite3
import glob

UPLOAD_DIR = 'ToolCalendar.Api/Uploads'
DB_PATH = 'data_dump/documents.db'

doc_dir = os.path.join(UPLOAD_DIR, 'Documents')
cab_dir = os.path.join(UPLOAD_DIR, 'Cabinet')

os.makedirs(doc_dir, exist_ok=True)
os.makedirs(cab_dir, exist_ok=True)

# 1. Move root files to Documents/
for item in os.listdir(UPLOAD_DIR):
    item_path = os.path.join(UPLOAD_DIR, item)
    if os.path.isfile(item_path) and not item.startswith('.'):
        shutil.move(item_path, os.path.join(doc_dir, item))

# 2. Move Evidence and Comments to Documents/
for folder in ['Evidence', 'Comments']:
    src = os.path.join(UPLOAD_DIR, folder)
    dst = os.path.join(doc_dir, folder)
    if os.path.exists(src):
        shutil.move(src, dst)

# 3. Move questionnaires and notes to Cabinet/
folder_map = {
    'questionnaires': 'Questionnaires',
    'notes': 'Notes'
}
for src_name, dst_name in folder_map.items():
    src = os.path.join(UPLOAD_DIR, src_name)
    dst = os.path.join(cab_dir, dst_name)
    if os.path.exists(src):
        shutil.move(src, dst)

print("Moved files successfully.")

# Update DB
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Update Documents (FilePath)
cursor.execute("""
    UPDATE Documents
    SET FilePath = REPLACE(FilePath, 'Uploads/', 'Uploads/Documents/')
    WHERE FilePath LIKE 'Uploads/%' AND FilePath NOT LIKE 'Uploads/Documents/%'
""")

# Update Documents (EvidencePaths)
# Since EvidencePaths is a JSON array of strings, replacing 'Uploads/Evidence/' with 'Uploads/Documents/Evidence/' works if we just do a string replace on the JSON string.
try:
    cursor.execute("""
        UPDATE Documents
        SET EvidencePaths = REPLACE(EvidencePaths, 'Uploads/Evidence/', 'Uploads/Documents/Evidence/')
        WHERE EvidencePaths LIKE '%Uploads/Evidence/%'
    """)
except sqlite3.OperationalError:
    pass

# Update Comments (AttachmentPaths)
try:
    cursor.execute("""
        UPDATE Comments
        SET AttachmentPaths = REPLACE(AttachmentPaths, 'Uploads/Comments/', 'Uploads/Documents/Comments/')
        WHERE AttachmentPaths LIKE '%Uploads/Comments/%'
    """)
except sqlite3.OperationalError:
    pass

# Update Questionnaires (AttachmentPaths)
try:
    cursor.execute("""
        UPDATE Questionnaires
        SET AttachmentPaths = REPLACE(AttachmentPaths, 'Uploads/questionnaires/', 'Uploads/Cabinet/Questionnaires/')
        WHERE AttachmentPaths LIKE '%Uploads/questionnaires/%'
    """)
except sqlite3.OperationalError:
    pass

# Update MeetingNotes (AttachmentPaths)
try:
    cursor.execute("""
        UPDATE MeetingNotes
        SET AttachmentPaths = REPLACE(AttachmentPaths, 'Uploads/notes/', 'Uploads/Cabinet/Notes/')
        WHERE AttachmentPaths LIKE '%Uploads/notes/%'
    """)
except sqlite3.OperationalError:
    pass

conn.commit()
conn.close()

print("Updated DB successfully.")
