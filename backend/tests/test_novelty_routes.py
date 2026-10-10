"""
Unit and Integration Tests for Parali Alert Novelty Features (N1, N2, N4, N6, N7).
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_whatsapp_alert_dispatch():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Dispatch in English
        resp = await client.post("/api/alerts/whatsapp", json={
            "unit_id": "SAN-01",
            "recipient_name": "Rajesh Kumar (ADO Sangrur)",
            "recipient_phone": "+91-98765-11223",
            "language": "en"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "SAN-01" in data["dispatch"]["unit_id"]
        assert "PARALI ALERT" in data["formatted_message"]["message"]

        # Dispatch in Punjabi (ਪੰਜਾਬੀ)
        resp_pa = await client.post("/api/alerts/whatsapp", json={
            "unit_id": "LUD-02",
            "recipient_name": "Gurmeet Singh (BDO Jagraon)",
            "recipient_phone": "+91-98765-44556",
            "language": "pa"
        })
        assert resp_pa.status_code == 200
        data_pa = resp_pa.json()
        assert data_pa["success"] is True
        assert "ਪਰਾਲੀ ਅਲਰਟ" in data_pa["formatted_message"]["message"]


@pytest.mark.asyncio
async def test_farmer_reporting_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Submit report
        payload = {
            "farmer_name": "Jagjit Singh",
            "phone": "+91-98150-12345",
            "district": "Sangrur",
            "unit_id": "SAN-02",
            "village": "Bhawanigarh",
            "land_area_acres": 10.0,
            "crop_type": "Basmati 1509",
            "harvest_status": "HARVESTED_YESTERDAY",
            "harvest_date": "2024-10-27",
            "residue_action": "SUPER_SEEDER_NEEDED",
            "machinery_requested": True,
            "notes": "Urgent super seeder required before Nov 1"
        }
        post_resp = await client.post("/api/farmer-reports", json=payload)
        assert post_resp.status_code == 200
        post_data = post_resp.json()
        assert post_data["farmer_name"] == "Jagjit Singh"
        assert post_data["report_id"].startswith("FR-")

        # List reports
        get_resp = await client.get("/api/farmer-reports?district=Sangrur")
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        assert get_data["total_reports"] >= 1


@pytest.mark.asyncio
async def test_cpcb_air_quality_stations():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/air-quality/cpcb-stations")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_stations"] >= 5
        assert "average_regional_aqi" in data
        # Check presence of key stations
        station_names = [s["station_name"] for s in data["stations"]]
        assert any("Punjab Agricultural University" in name for name in station_names)


@pytest.mark.asyncio
async def test_carbon_emissions_calculator():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Regional summary
        summary_resp = await client.get("/api/emissions/summary")
        assert summary_resp.status_code == 200
        summary_data = summary_resp.json()
        assert summary_data["total_at_risk_residue_hectares"] > 0
        assert summary_data["potential_co2_tonnes"] > 0
        assert "projected_intervention_impact" in summary_data

        # Unit emissions
        unit_resp = await client.get("/api/emissions/unit/SAN-01")
        assert unit_resp.status_code == 200
        unit_data = unit_resp.json()
        assert unit_data["unit_id"] == "SAN-01"
        assert "potential_emissions_kg" in unit_data
        assert "social_cost_of_carbon" in unit_data


@pytest.mark.asyncio
async def test_satellite_comparison_viewer():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/satellite/comparison/SAN-01")
        assert resp.status_code == 200
        data = resp.json()
        assert data["unit_id"] == "SAN-01"
        assert "pre_harvest" in data
        assert "post_harvest" in data
        assert "change_detection" in data
        assert data["change_detection"]["delta_ndvi"] < 0
