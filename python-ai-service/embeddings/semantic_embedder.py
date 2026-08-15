from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

class SemanticEmbedder:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        logger.info(f"Loading SemanticEmbedder model: {model_name}")
        self.model = SentenceTransformer(model_name)
        logger.info("Model loaded successfully")

    def embed_text(self, text: str) -> list[float]:
        try:
            # Generate embedding
            embedding = self.model.encode(text)
            
            # SentenceTransformers encode returns a numpy array. 
            # all-MiniLM-L6-v2 is already normalized if we use the correct settings,
            # but let's ensure it's converted to a standard Python list of floats
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise e

# Create a global singleton instance to be reused
_embedder_instance = None

def get_embedder() -> SemanticEmbedder:
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = SemanticEmbedder()
    return _embedder_instance
