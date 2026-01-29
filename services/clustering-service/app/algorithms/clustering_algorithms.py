import numpy as np
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.metrics import silhouette_score
import hdbscan
import logging
from typing import Optional
from enum import Enum
from sentence_transformers import SentenceTransformer
from ..config import get_settings

logger = logging.getLogger(__name__)


class ClusteringMethod(str, Enum):
    """Available clustering methods."""
    KMEANS = "kmeans"
    DBSCAN = "dbscan"
    HDBSCAN = "hdbscan"
    AGGLOMERATIVE = "agglomerative"


class ClusteringAlgorithms:
    """Clustering algorithms for grouping similar texts/queries."""

    def __init__(self):
        self.settings = get_settings()
        self._model = None

    @property
    def embedding_model(self):
        """Lazy load sentence transformer model."""
        if self._model is None:
            try:
                self._model = SentenceTransformer(self.settings.embedding_model)
                logger.info(f"Loaded embedding model: {self.settings.embedding_model}")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {str(e)}")
                self._model = None
        return self._model

    def get_embeddings(self, texts: list[str]) -> np.ndarray:
        """Get embeddings for a list of texts."""
        if self.embedding_model is None:
            raise ValueError("Embedding model not available")
        return self.embedding_model.encode(texts)

    def cluster_texts(
        self,
        texts: list[str],
        method: ClusteringMethod = ClusteringMethod.HDBSCAN,
        n_clusters: Optional[int] = None,
        min_cluster_size: Optional[int] = None,
        min_samples: Optional[int] = None,
        eps: Optional[float] = None,
    ) -> dict:
        """
        Cluster texts using the specified method.

        Args:
            texts: List of texts to cluster
            method: Clustering algorithm to use
            n_clusters: Number of clusters (for k-means and agglomerative)
            min_cluster_size: Minimum cluster size (for HDBSCAN)
            min_samples: Minimum samples (for DBSCAN/HDBSCAN)
            eps: Epsilon parameter (for DBSCAN)

        Returns:
            Dictionary with cluster assignments and metadata
        """
        if len(texts) < 2:
            return {
                "success": False,
                "error": "Need at least 2 texts to cluster",
                "labels": [],
                "n_clusters": 0,
            }

        # Get embeddings
        embeddings = self.get_embeddings(texts)

        # Perform clustering
        if method == ClusteringMethod.KMEANS:
            labels, metadata = self._kmeans_cluster(
                embeddings, n_clusters or self.settings.default_n_clusters
            )
        elif method == ClusteringMethod.DBSCAN:
            labels, metadata = self._dbscan_cluster(
                embeddings,
                eps=eps or 0.5,
                min_samples=min_samples or self.settings.default_min_samples,
            )
        elif method == ClusteringMethod.HDBSCAN:
            labels, metadata = self._hdbscan_cluster(
                embeddings,
                min_cluster_size=min_cluster_size or self.settings.default_min_cluster_size,
                min_samples=min_samples or self.settings.default_min_samples,
            )
        elif method == ClusteringMethod.AGGLOMERATIVE:
            labels, metadata = self._agglomerative_cluster(
                embeddings, n_clusters or self.settings.default_n_clusters
            )
        else:
            return {
                "success": False,
                "error": f"Unknown method: {method}",
                "labels": [],
                "n_clusters": 0,
            }

        # Calculate silhouette score if we have more than one cluster
        n_unique = len(set(labels)) - (1 if -1 in labels else 0)
        silhouette = None
        if n_unique > 1 and n_unique < len(texts):
            try:
                silhouette = float(silhouette_score(embeddings, labels))
            except Exception:
                pass

        # Build clusters
        clusters = self._build_clusters(texts, labels)

        return {
            "success": True,
            "method": method.value,
            "labels": [int(l) for l in labels],
            "n_clusters": n_unique,
            "n_noise": int(sum(1 for l in labels if l == -1)),
            "silhouette_score": round(silhouette, 3) if silhouette else None,
            "clusters": clusters,
            **metadata,
        }

    def _kmeans_cluster(
        self, embeddings: np.ndarray, n_clusters: int
    ) -> tuple[np.ndarray, dict]:
        """Perform K-means clustering."""
        # Ensure n_clusters doesn't exceed number of samples
        n_clusters = min(n_clusters, len(embeddings))

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(embeddings)

        return labels, {
            "inertia": float(kmeans.inertia_),
            "n_iter": int(kmeans.n_iter_),
        }

    def _dbscan_cluster(
        self, embeddings: np.ndarray, eps: float, min_samples: int
    ) -> tuple[np.ndarray, dict]:
        """Perform DBSCAN clustering."""
        dbscan = DBSCAN(eps=eps, min_samples=min_samples, metric="cosine")
        labels = dbscan.fit_predict(embeddings)

        return labels, {
            "eps": eps,
            "min_samples": min_samples,
        }

    def _hdbscan_cluster(
        self, embeddings: np.ndarray, min_cluster_size: int, min_samples: int
    ) -> tuple[np.ndarray, dict]:
        """Perform HDBSCAN clustering."""
        # Adjust parameters if we have few samples
        min_cluster_size = min(min_cluster_size, max(2, len(embeddings) // 2))
        min_samples = min(min_samples, min_cluster_size)

        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            metric="euclidean",
            cluster_selection_method="eom",
        )
        labels = clusterer.fit_predict(embeddings)

        return labels, {
            "min_cluster_size": min_cluster_size,
            "min_samples": min_samples,
            "probabilities": [float(p) for p in clusterer.probabilities_],
        }

    def _agglomerative_cluster(
        self, embeddings: np.ndarray, n_clusters: int
    ) -> tuple[np.ndarray, dict]:
        """Perform Agglomerative clustering."""
        n_clusters = min(n_clusters, len(embeddings))

        clustering = AgglomerativeClustering(n_clusters=n_clusters)
        labels = clustering.fit_predict(embeddings)

        return labels, {
            "n_leaves": int(clustering.n_leaves_),
        }

    def _build_clusters(
        self, texts: list[str], labels: np.ndarray
    ) -> dict[str, list[str]]:
        """Build cluster dictionary from labels."""
        clusters = {}
        for text, label in zip(texts, labels):
            label_key = f"cluster_{label}" if label >= 0 else "noise"
            if label_key not in clusters:
                clusters[label_key] = []
            clusters[label_key].append(text)
        return clusters

    def find_similar(
        self,
        query: str,
        texts: list[str],
        top_k: int = 5,
        threshold: float = 0.5,
    ) -> list[dict]:
        """
        Find texts most similar to the query.

        Args:
            query: Query text
            texts: List of texts to search
            top_k: Number of results to return
            threshold: Minimum similarity threshold

        Returns:
            List of dictionaries with text and similarity score
        """
        if not texts:
            return []

        # Get embeddings
        query_embedding = self.embedding_model.encode([query])[0]
        text_embeddings = self.embedding_model.encode(texts)

        # Calculate cosine similarities
        similarities = self._cosine_similarity(query_embedding, text_embeddings)

        # Sort by similarity
        indices = np.argsort(similarities)[::-1]

        # Filter by threshold and return top_k
        results = []
        for idx in indices[:top_k]:
            sim = float(similarities[idx])
            if sim >= threshold:
                results.append({
                    "text": texts[idx],
                    "similarity": round(sim, 3),
                    "index": int(idx),
                })

        return results

    def _cosine_similarity(
        self, vec1: np.ndarray, vec2: np.ndarray
    ) -> np.ndarray:
        """Calculate cosine similarity between vec1 and all vectors in vec2."""
        vec1_norm = vec1 / np.linalg.norm(vec1)

        if len(vec2.shape) == 1:
            vec2_norm = vec2 / np.linalg.norm(vec2)
        else:
            vec2_norm = vec2 / np.linalg.norm(vec2, axis=1, keepdims=True)

        return np.dot(vec2_norm, vec1_norm)

    def get_status(self) -> dict:
        """Get service status."""
        return {
            "embedding_model": self.settings.embedding_model,
            "embedding_loaded": self._model is not None,
        }
