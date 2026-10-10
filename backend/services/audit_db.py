"""
Parali Alert - Persistent SQLite Audit & Operational Storage Service.
Tracks:
1. WhatsApp & SMS dispatch history, delivery receipts, and officer acknowledgment timestamps.
2. Farmer ground-truth reports with verified ADO validations.
3. Custom Hiring Center (CHC) machinery fleet deployments and operational statuses.
"""

import sqlite3
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import json

logger = logging.getLogger("audit_db")

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = STORAGE_DIR / "parali_audit.db"


class AuditDatabase:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """Initializes database schemas for dispatches, farmer reports, and machinery deployments."""
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS whatsapp_dispatches (
                    dispatch_id TEXT PRIMARY KEY,
                    recipient_name TEXT,
                    recipient_phone TEXT,
                    unit_id TEXT,
                    district TEXT,
                    priority_score REAL,
                    language TEXT,
                    timestamp TEXT,
                    status TEXT,
                    provider TEXT,
                    message_preview TEXT,
                    delivered_at TEXT,
                    acknowledged_at TEXT,
                    ack_status TEXT DEFAULT 'PENDING'
                );

                CREATE TABLE IF NOT EXISTS farmer_reports (
                    report_id TEXT PRIMARY KEY,
                    farmer_name TEXT,
                    phone TEXT,
                    district TEXT,
                    unit_id TEXT,
                    village TEXT,
                    land_area_acres REAL,
                    crop_type TEXT,
                    harvest_status TEXT,
                    harvest_date TEXT,
                    residue_action TEXT,
                    machinery_requested INTEGER,
                    notes TEXT,
                    submitted_at TEXT,
                    verified_by_ado INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS machine_deployments (
                    deployment_id TEXT PRIMARY KEY,
                    unit_id TEXT,
                    district TEXT,
                    machine_type TEXT,
                    chc_name TEXT,
                    status TEXT,
                    assigned_at TEXT,
                    completed_at TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_dispatches_unit ON whatsapp_dispatches(unit_id);
                CREATE INDEX IF NOT EXISTS idx_farmer_unit ON farmer_reports(unit_id);
                CREATE INDEX IF NOT EXISTS idx_farmer_district ON farmer_reports(district);
                CREATE INDEX IF NOT EXISTS idx_deployments_unit ON machine_deployments(unit_id);
            """)

    # -------------------------------------------------------------
    # WhatsApp Dispatches
    # -------------------------------------------------------------
    def log_dispatch(self, record: Dict[str, Any]) -> Dict[str, Any]:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO whatsapp_dispatches (
                    dispatch_id, recipient_name, recipient_phone, unit_id, district,
                    priority_score, language, timestamp, status, provider,
                    message_preview, delivered_at, acknowledged_at, ack_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.get("dispatch_id"),
                    record.get("recipient_name"),
                    record.get("recipient_phone"),
                    record.get("unit_id"),
                    record.get("district"),
                    record.get("priority_score", 0.0),
                    record.get("language", "en"),
                    record.get("timestamp"),
                    record.get("status", "DELIVERED"),
                    record.get("provider", "WhatsApp Business Gateway"),
                    record.get("message_preview", ""),
                    record.get("delivered_at") or record.get("timestamp"),
                    record.get("acknowledged_at"),
                    record.get("ack_status", "PENDING"),
                ),
            )
        return record

    def list_dispatches(self, limit: int = 50, unit_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if unit_id:
                cur = conn.execute(
                    "SELECT * FROM whatsapp_dispatches WHERE unit_id = ? ORDER BY timestamp DESC LIMIT ?",
                    (unit_id, limit),
                )
            else:
                cur = conn.execute(
                    "SELECT * FROM whatsapp_dispatches ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                )
            return [dict(row) for row in cur.fetchall()]

    def acknowledge_dispatch(self, dispatch_id: str, ack_status: str = "ACKNOWLEDGED") -> bool:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                UPDATE whatsapp_dispatches
                SET ack_status = ?, acknowledged_at = ?
                WHERE dispatch_id = ?
                """,
                (ack_status, now_iso, dispatch_id),
            )
            return cur.rowcount > 0

    # -------------------------------------------------------------
    # Farmer Ground-Truth Reports
    # -------------------------------------------------------------
    def save_farmer_report(self, report: Dict[str, Any]) -> Dict[str, Any]:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO farmer_reports (
                    report_id, farmer_name, phone, district, unit_id,
                    village, land_area_acres, crop_type, harvest_status,
                    harvest_date, residue_action, machinery_requested,
                    notes, submitted_at, verified_by_ado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    report.get("report_id"),
                    report.get("farmer_name"),
                    report.get("phone"),
                    report.get("district"),
                    report.get("unit_id"),
                    report.get("village"),
                    float(report.get("land_area_acres", 5.0)),
                    report.get("crop_type"),
                    report.get("harvest_status"),
                    report.get("harvest_date"),
                    report.get("residue_action"),
                    1 if report.get("machinery_requested") else 0,
                    report.get("notes", ""),
                    report.get("submitted_at"),
                    1 if report.get("verified_by_ado") else 0,
                ),
            )
        return report

    def list_farmer_reports(
        self,
        district: Optional[str] = None,
        unit_id: Optional[str] = None,
        machinery_only: bool = False,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM farmer_reports WHERE 1=1"
        params: List[Any] = []

        if district and district.lower() != "all":
            query += " AND LOWER(district) = LOWER(?)"
            params.append(district)
        if unit_id and unit_id.lower() != "all":
            query += " AND LOWER(unit_id) = LOWER(?)"
            params.append(unit_id)
        if machinery_only:
            query += " AND machinery_requested = 1"

        query += " ORDER BY submitted_at DESC LIMIT ?"
        params.append(limit)

        with self._get_connection() as conn:
            cur = conn.execute(query, tuple(params))
            rows = [dict(row) for row in cur.fetchall()]
            for r in rows:
                r["machinery_requested"] = bool(r.get("machinery_requested", 0))
                r["verified_by_ado"] = bool(r.get("verified_by_ado", 0))
            return rows

    def get_unit_ground_truth(self, unit_id: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT
                    COUNT(*) as total_reports,
                    SUM(CASE WHEN machinery_requested = 1 THEN 1 ELSE 0 END) as machinery_demands,
                    SUM(CASE WHEN harvest_status LIKE '%HARVESTED%' THEN 1 ELSE 0 END) as harvested_confirmations,
                    MAX(submitted_at) as latest_report_date
                FROM farmer_reports
                WHERE unit_id = ?
                """,
                (unit_id,),
            )
            row = cur.fetchone()

        if not row or row["total_reports"] == 0:
            return {
                "unit_id": unit_id,
                "has_ground_truth": False,
                "reports_count": 0,
                "confidence_boost": 0.0,
                "machinery_demands": 0,
                "harvested_confirmations": 0,
                "latest_report_date": None,
            }

        total = row["total_reports"] or 0
        machinery = row["machinery_demands"] or 0
        harvested = row["harvested_confirmations"] or 0

        return {
            "unit_id": unit_id,
            "has_ground_truth": True,
            "reports_count": total,
            "harvested_confirmations": harvested,
            "machinery_demands": machinery,
            "confidence_boost": min(0.20, total * 0.05),
            "latest_report_date": row["latest_report_date"],
        }

    # -------------------------------------------------------------
    # Machinery Fleet Tracking
    # -------------------------------------------------------------
    def record_deployment(self, deployment: Dict[str, Any]) -> Dict[str, Any]:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO machine_deployments (
                    deployment_id, unit_id, district, machine_type, chc_name,
                    status, assigned_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    deployment.get("deployment_id"),
                    deployment.get("unit_id"),
                    deployment.get("district"),
                    deployment.get("machine_type", "Super Seeder"),
                    deployment.get("chc_name", "Primary CHC Hub"),
                    deployment.get("status", "ASSIGNED"),
                    deployment.get("assigned_at"),
                    deployment.get("completed_at"),
                ),
            )
        return deployment

    def list_deployments(self, unit_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if unit_id:
                cur = conn.execute(
                    "SELECT * FROM machine_deployments WHERE unit_id = ? ORDER BY assigned_at DESC",
                    (unit_id,),
                )
            else:
                cur = conn.execute("SELECT * FROM machine_deployments ORDER BY assigned_at DESC")
            return [dict(row) for row in cur.fetchall()]


audit_db = AuditDatabase()
