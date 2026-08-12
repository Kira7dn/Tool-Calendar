import sqlite3
import json
import urllib.request
import math

DB_PATH = 'data_dump/documents.db'
OLLAMA_URL = 'http://127.0.0.1:11434/api/embeddings'
MODEL_NAME = 'nomic-embed-text'
CHUNK_SIZE = 1000

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

def main():
    print("Starting vector backfill for existing documents...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all documents that have FullText but no chunks yet
    cursor.execute('''
        SELECT d.Id, d.FullText 
        FROM Documents d
        LEFT JOIN DocumentChunks c ON d.Id = c.DocumentId
        WHERE d.FullText IS NOT NULL AND d.FullText != '' AND c.Id IS NULL
    ''')
    
    docs = cursor.fetchall()
    print(f"Found {len(docs)} documents to process.")
    
    for doc_id, text in docs:
        print(f"Processing DocumentId {doc_id}...")
        
        chunks = []
        for i in range(0, len(text), CHUNK_SIZE):
            chunks.append(text[i:i+CHUNK_SIZE])
            
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
