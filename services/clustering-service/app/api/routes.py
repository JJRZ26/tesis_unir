from fastapi import APIRouter, HTTPException
import logging
from .schemas import (
    ClusterRequest,
    ClusterResponse,
    SimilarityRequest,
    SimilarityResponse,
    SimilarityResult,
    EmbeddingsRequest,
    EmbeddingsResponse,
    HealthResponse,
    ClusteringMethod,
)
from ..algorithms import ClusteringAlgorithms
from ..algorithms.clustering_algorithms import ClusteringMethod as AlgoMethod
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
clustering = ClusteringAlgorithms()
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    status = clustering.get_status()
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        **status,
    )


@router.post("/cluster", response_model=ClusterResponse)
async def cluster_texts(request: ClusterRequest):
    """Cluster texts using the specified algorithm."""
    try:
        # Map API enum to algorithm enum
        method_map = {
            ClusteringMethod.KMEANS: AlgoMethod.KMEANS,
            ClusteringMethod.DBSCAN: AlgoMethod.DBSCAN,
            ClusteringMethod.HDBSCAN: AlgoMethod.HDBSCAN,
            ClusteringMethod.AGGLOMERATIVE: AlgoMethod.AGGLOMERATIVE,
        }

        result = clustering.cluster_texts(
            texts=request.texts,
            method=method_map[request.method],
            n_clusters=request.n_clusters,
            min_cluster_size=request.min_cluster_size,
            min_samples=request.min_samples,
            eps=request.eps,
        )

        return ClusterResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Clustering failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/similar", response_model=SimilarityResponse)
async def find_similar(request: SimilarityRequest):
    """Find texts most similar to the query."""
    try:
        results = clustering.find_similar(
            query=request.query,
            texts=request.texts,
            top_k=request.top_k,
            threshold=request.threshold,
        )

        return SimilarityResponse(
            query=request.query,
            results=[SimilarityResult(**r) for r in results],
            total_texts=len(request.texts),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Similarity search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings", response_model=EmbeddingsResponse)
async def get_embeddings(request: EmbeddingsRequest):
    """Get embeddings for texts."""
    try:
        embeddings = clustering.get_embeddings(request.texts)

        return EmbeddingsResponse(
            embeddings=[e.tolist() for e in embeddings],
            dimensions=embeddings.shape[1],
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Embedding generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
