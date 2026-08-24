import sqlite3
import json
import urllib.request
import math

DB_PATH = 'data_dump/documents.db'
OLLAMA_URL = 'http://127.0.0.1:11434/api/embeddings'
MODEL_NAME = 'nomic-embed-text'
CHUNK_WORDS = 250
OVERLAP_WORDS = 50

def generate_embedding(text):
    if not text or not text.strip():
        return []
    
    data = json.dumps({
        "model": MODEL_NAME,
        "prompt": text
    }).encode('utf-8')
    
    req = urllib.request.Request(OLLAMA_URL, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get('embedding', [])
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return []

def chunk_text_with_overlap(text, chunk_words=CHUNK_WORDS, overlap_words=OVERLAP_WORDS):
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = words[i:i + chunk_words]
        chunks.append(" ".join(chunk))
        if i + chunk_words >= len(words):
            break
        i += (chunk_words - overlap_words)
    return chunks

def main():
    print("Starting vector backfill for existing documents...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Lấy thêm TenCongVan và SoVanBan để làm giàu ngữ cảnh cho từng chunk
    cursor.execute('''
        SELECT d.Id, d.FullText, d.TenCongVan, d.SoVanBan
        FROM Documents d
        LEFT JOIN DocumentChunks c ON d.Id = c.DocumentId
        WHERE d.FullText IS NOT NULL AND d.FullText != '' AND c.Id IS NULL
    ''')
    
    docs = cursor.fetchall()
    print(f"Found {len(docs)} documents to process.")
    
    for doc_id, text, ten_cong_van, so_van_ban in docs:
        print(f"Processing DocumentId {doc_id}...")
        
        # Tạo phần header metadata cho từng chunk
        ten_cv = ten_cong_van if ten_cong_van else 'Không có'
        so_cv = so_van_ban if so_van_ban else 'Không có'
        header = f"[Tên Công văn: {ten_cv}] [Số hiệu: {so_cv}]\n\n"
        
        # Cắt chữ thông minh có overlap
        raw_chunks = chunk_text_with_overlap(text)
        
        # Gắn header vào đầu mỗi đoạn chunk
        chunks = [header + c for c in raw_chunks]
            
        for chunk_idx, chunk in enumerate(chunks):
            vector = generate_embedding(chunk)
            if vector:
                cursor.execute('''
                    INSERT INTO DocumentChunks (DocumentId, ChunkIndex, TextContent, VectorJson)
                    VALUES (?, ?, ?, ?)
                ''', (doc_id, chunk_idx, chunk, json.dumps(vector)))
                
        conn.commit()
        print(f"  -> Saved {len(chunks)} chunks.")

    conn.close()
    print("Backfill completed successfully!")

if __name__ == '__main__':
    main()
