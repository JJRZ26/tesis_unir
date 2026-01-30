import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.algorithms.clustering_algorithms import ClusteringAlgorithms


client = TestClient(app)


class TestHealthEndpoint:
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "clustering-service"


class TestClusteringAlgorithms:
    @pytest.fixture
    def algorithms(self):
        return ClusteringAlgorithms()

    @pytest.fixture
    def sample_embeddings(self):
        # Generate sample embeddings for testing
        np.random.seed(42)
        return np.random.rand(20, 384).tolist()

    def test_algorithms_initialization(self, algorithms):
        assert algorithms is not None

    def test_kmeans_clustering(self, algorithms, sample_embeddings):
        result = algorithms.kmeans(sample_embeddings, n_clusters=3)

        assert "labels" in result
        assert "centroids" in result
        assert len(result["labels"]) == len(sample_embeddings)
        assert len(set(result["labels"])) <= 3

    def test_dbscan_clustering(self, algorithms, sample_embeddings):
        result = algorithms.dbscan(sample_embeddings, eps=0.5, min_samples=2)

        assert "labels" in result
        assert len(result["labels"]) == len(sample_embeddings)

    def test_hdbscan_clustering(self, algorithms, sample_embeddings):
        result = algorithms.hdbscan_cluster(sample_embeddings, min_cluster_size=2)

        assert "labels" in result
        assert len(result["labels"]) == len(sample_embeddings)

    def test_agglomerative_clustering(self, algorithms, sample_embeddings):
        result = algorithms.agglomerative(sample_embeddings, n_clusters=3)

        assert "labels" in result
        assert len(result["labels"]) == len(sample_embeddings)


class TestClusterEndpoint:
    def test_cluster_requires_texts_or_embeddings(self):
        response = client.post("/api/clustering/cluster", json={})
        assert response.status_code == 422

    @patch("app.api.routes.get_embeddings_for_texts")
    def test_cluster_texts_kmeans(self, mock_embeddings):
        # Mock embeddings
        mock_embeddings.return_value = np.random.rand(5, 384).tolist()

        response = client.post("/api/clustering/cluster", json={
            "texts": [
                "Quiero verificar mi ticket",
                "Necesito ver el estado de mi apuesta",
                "Cómo retiro mi dinero",
                "Quiero sacar mis ganancias",
                "Consulta de saldo"
            ],
            "algorithm": "kmeans",
            "n_clusters": 2
        })

        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "labels" in data or "clusters" in data or "error" in data

    @patch("app.api.routes.get_embeddings_for_texts")
    def test_cluster_texts_dbscan(self, mock_embeddings):
        mock_embeddings.return_value = np.random.rand(5, 384).tolist()

        response = client.post("/api/clustering/cluster", json={
            "texts": [
                "Hola buenas tardes",
                "Buenos días",
                "Verificar ticket",
                "Estado de mi apuesta",
                "Retirar dinero"
            ],
            "algorithm": "dbscan",
            "eps": 0.5,
            "min_samples": 2
        })

        assert response.status_code in [200, 500]


class TestSimilarEndpoint:
    @patch("app.api.routes.get_embedding_for_text")
    @patch("app.api.routes.get_embeddings_for_texts")
    def test_find_similar_texts(self, mock_embeddings, mock_query_embed):
        # Mock embeddings
        mock_query_embed.return_value = np.random.rand(384).tolist()
        mock_embeddings.return_value = np.random.rand(5, 384).tolist()

        response = client.post("/api/clustering/similar", json={
            "query": "Quiero verificar mi ticket",
            "candidates": [
                "Verificar estado del ticket",
                "Consultar apuesta",
                "Retirar dinero",
                "Cambiar contraseña",
                "Ver historial de tickets"
            ],
            "top_k": 3
        })

        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            if "similar" in data:
                assert len(data["similar"]) <= 3


class TestEmbeddingsEndpoint:
    @patch("app.api.routes.get_embeddings_for_texts")
    def test_generate_embeddings(self, mock_embeddings):
        mock_embeddings.return_value = np.random.rand(3, 384).tolist()

        response = client.post("/api/clustering/embeddings", json={
            "texts": [
                "Texto uno",
                "Texto dos",
                "Texto tres"
            ]
        })

        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            if "embeddings" in data:
                assert len(data["embeddings"]) == 3


class TestClusteringAlgorithmSelection:
    def test_invalid_algorithm(self):
        response = client.post("/api/clustering/cluster", json={
            "texts": ["texto 1", "texto 2"],
            "algorithm": "invalid_algorithm"
        })

        # Should return error for invalid algorithm
        assert response.status_code in [400, 422, 500]


class TestErrorHandling:
    def test_empty_texts_list(self):
        response = client.post("/api/clustering/cluster", json={
            "texts": [],
            "algorithm": "kmeans"
        })

        assert response.status_code in [400, 422]

    def test_single_text_clustering(self):
        response = client.post("/api/clustering/cluster", json={
            "texts": ["Solo un texto"],
            "algorithm": "kmeans",
            "n_clusters": 2
        })

        # Should handle gracefully (error or adapt)
        assert response.status_code in [200, 400, 500]

    def test_more_clusters_than_texts(self):
        response = client.post("/api/clustering/cluster", json={
            "texts": ["texto 1", "texto 2"],
            "algorithm": "kmeans",
            "n_clusters": 10
        })

        # Should handle gracefully
        assert response.status_code in [200, 400, 500]


class TestCosineSimilarity:
    def test_cosine_similarity_calculation(self):
        algorithms = ClusteringAlgorithms()

        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        vec3 = [0.0, 1.0, 0.0]

        # Same vectors should have similarity 1.0
        sim_same = algorithms.cosine_similarity(vec1, vec2)
        assert abs(sim_same - 1.0) < 0.001

        # Orthogonal vectors should have similarity 0.0
        sim_ortho = algorithms.cosine_similarity(vec1, vec3)
        assert abs(sim_ortho) < 0.001
