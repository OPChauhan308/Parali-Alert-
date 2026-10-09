"""
Integration Tests for Parali Alert FastAPI Endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["app_name"] == "Parali Alert"


@pytest.mark.asyncio
async def test_study_areas():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/study-areas")
        assert resp.status_code == 200
        data = resp.json()
        assert "Sangrur" in data["pilot_districts"]
        assert "Ludhiana" in data["pilot_districts"]


@pytest.mark.asyncio
async def test_risk_rankings():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/risk-rankings?horizon=48")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_evaluated"] > 0
        assert len(data["rankings"]) > 0
        # Check first ranked item has priority_score >= next item
        if len(data["rankings"]) > 1:
            assert data["rankings"][0]["priority_score"] >= data["rankings"][1]["priority_score"]


@pytest.mark.asyncio
async def test_unit_detail():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/unit/SAN-01")
        assert resp.status_code == 200
        data = resp.json()
        assert data["unit"]["unit_id"] == "SAN-01"
        assert "spectral_details" in data
        assert "weather_forecast" in data


@pytest.mark.asyncio
async def test_evaluate_benchmark():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/evaluate")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["benchmarks"]) == 4
        assert "parali_alert_weighted" in str(data) or "Parali Alert Pre-Fire Engine" in str(data)
