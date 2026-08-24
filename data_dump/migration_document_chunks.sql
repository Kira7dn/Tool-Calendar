CREATE TABLE IF NOT EXISTS DocumentChunks (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    DocumentId INTEGER NOT NULL,
    ChunkIndex INTEGER NOT NULL,
    TextContent TEXT NOT NULL,
    VectorJson TEXT NOT NULL,
    FOREIGN KEY(DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IDX_DocumentChunks_DocumentId ON DocumentChunks(DocumentId);
