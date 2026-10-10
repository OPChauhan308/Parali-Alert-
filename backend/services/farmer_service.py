"""
Parali Alert - Farmer Ground-Truth Self-Reporting Service.
Enables farmers and village sarpanches to report harvest completion, request CRM machinery,
and provide ground-truth validation for satellite crop residue detections.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

from backend.services.audit_db import audit_db

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "reports"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_FILE = STORAGE_DIR / "farmer_reports.json"


class FarmerReportingService:
    def __init__(self):
        self._reports: List[Dict[str, Any]] = []
        self._init_data()

    def _init_data(self):
        # 1. Check if SQLite already has reports
        existing_in_db = audit_db.list_farmer_reports(limit=200)
        if existing_in_db:
            self._reports = existing_in_db
            return

        # 2. Otherwise load from JSON and migrate to SQLite
        if REPORTS_FILE.exists():
            try:
                with open(REPORTS_FILE, "r") as f:
                    self._reports = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load farmer reports from JSON: {e}")
                self._reports = []

        if not self._reports:
            # Seed with representative ground-truth observations from Sangrur and Ludhiana
            self._reports = [
                {
                    "report_id": "FR-2024-001",
                    "farmer_name": "Gurpreet Singh",
                    "phone": "+91-98765-43210",
                    "district": "Sangrur",
                    "unit_id": "SAN-01",
                    "village": "Mehlan",
                    "land_area_acres": 12.5,
                    "crop_type": "Basmati 1121",
                    "harvest_status": "HARVESTED_YESTERDAY",
                    "harvest_date": "2024-10-25",
                    "residue_action": "SUPER_SEEDER_NEEDED",
                    "machinery_requested": True,
                    "submitted_at": "2024-10-26T08:30:00Z",
                    "verified_by_ado": True
                },
                {
                    "report_id": "FR-2024-002",
                    "farmer_name": "Harinder Dhillon",
                    "phone": "+91-98140-55443",
                    "district": "Ludhiana",
                    "unit_id": "LUD-02",
                    "village": "Jagraon",
                    "land_area_acres": 8.0,
                    "crop_type": "PR-126",
                    "harvest_status": "HARVESTED_RECENTLY",
                    "harvest_date": "2024-10-26",
                    "residue_action": "BALER_REQUESTED",
                    "machinery_requested": True,
                    "submitted_at": "2024-10-27T10:15:00Z",
                    "verified_by_ado": True
                },
                {
                    "report_id": "FR-2024-003",
                    "farmer_name": "Balwinder Kaur",
                    "phone": "+91-98722-11990",
                    "district": "Bathinda",
                    "unit_id": "BAT-03",
                    "village": "Maur Mandi",
                    "land_area_acres": 15.0,
                    "crop_type": "Pusa 44",
                    "harvest_status": "STANDING_CROP",
                    "harvest_date": "2024-11-02",
                    "residue_action": "HAPPY_SEEDER_BOOKED",
                    "machinery_requested": False,
                    "submitted_at": "2024-10-27T14:20:00Z",
                    "verified_by_ado": False
                }
            ]

        # Migrate into SQLite
        for r in self._reports:
            audit_db.save_farmer_report(r)
        self._save_json_backup()

    def _save_json_backup(self):
        try:
            with open(REPORTS_FILE, "w") as f:
                json.dump(self._reports, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist farmer reports backup: {e}")

    def add_report(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submits a farmer self-report with SQLite persistence.
        """
        report_id = f"FR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        new_entry = {
            "report_id": report_id,
            "farmer_name": report_data.get("farmer_name", "Anonymous Farmer"),
            "phone": report_data.get("phone", ""),
            "district": report_data.get("district", "Sangrur"),
            "unit_id": report_data.get("unit_id", "SAN-01"),
            "village": report_data.get("village", ""),
            "land_area_acres": float(report_data.get("land_area_acres", 5.0)),
            "crop_type": report_data.get("crop_type", "Paddy (PR-126)"),
            "harvest_status": report_data.get("harvest_status", "HARVESTED_YESTERDAY"),
            "harvest_date": report_data.get("harvest_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "residue_action": report_data.get("residue_action", "SUPER_SEEDER_NEEDED"),
            "machinery_requested": bool(report_data.get("machinery_requested", True)),
            "notes": report_data.get("notes", ""),
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "verified_by_ado": False
        }

        # Persist to SQLite
        audit_db.save_farmer_report(new_entry)
        self._reports.insert(0, new_entry)
        self._save_json_backup()
        logger.info(f"New farmer report registered: {report_id} for unit {new_entry['unit_id']}")
        return new_entry

    def list_reports(
        self,
        district: Optional[str] = None,
        unit_id: Optional[str] = None,
        machinery_only: bool = False
    ) -> List[Dict[str, Any]]:
        return audit_db.list_farmer_reports(district=district, unit_id=unit_id, machinery_only=machinery_only)

    def get_unit_ground_truth(self, unit_id: str) -> Dict[str, Any]:
        """
        Summarizes farmer reports for a specific unit to calibrate satellite risk models.
        """
        return audit_db.get_unit_ground_truth(unit_id)


farmer_service = FarmerReportingService()
