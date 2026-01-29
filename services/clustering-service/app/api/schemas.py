from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ClusteringMethod(str, Enum):
    """Available clustering methods."""
    KMEANS = "kmeans"
    DBSCAN = "dbscan"
    HDBSCAN = "hdbscan"
    AGGLOMERATIVE = "agglomerative"


class ClusterRequest(BaseModel):
    """Request for text clustering."""
    texts: list[str] = Field(..., min_length=2)
    method: ClusteringMethod = ClusteringMethod.HDBSCAN
    n_clusters: Optional[int] = Field(None, ge=2, le=100)
    min_cluster_size: Optional[int] = Field(None, ge=2)
    min_samples: Optional[int] = Field(None, ge=1)
    eps: Optional[float] = Field(None, gt=0)


class ClusterResponse(BaseModel):
    """Response from clustering operation."""
    success: bool
    method: Optional[str] = None
    labels: list[int]
    n_clusters: int
    n_noise: Optional[int] = None
    silhouette_score: Optional[float] = None
    clusters: dict[str, list[str]]
    error: Optional[str] = None


class SimilarityRequest(BaseModel):
    """Request for similarity search."""
    query: str = Field(..., min_length=1)
    texts: list[str] = Field(..., min_length=1)
    top_k: int = Field(5, ge=1, le=100)
    threshold: float = Field(0.5, ge=0, le=1)


class SimilarityResult(BaseModel):
    """Single similarity result."""
    text: str
    similarity: float
    index: int


class SimilarityResponse(BaseModel):
    """Response from similarity search."""
    query: str
    results: list[SimilarityResult]
    total_texts: int


class EmbeddingsRequest(BaseModel):
    """Request for text embeddings."""
    texts: list[str] = Field(..., min_length=1)


class EmbeddingsResponse(BaseModel):
    """Response with text embeddings."""
    embeddings: list[list[float]]
    dimensions: int


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str
    embedding_model: str
    embedding_loaded: bool
