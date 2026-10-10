"""
AWS S3 & SNS Integration & Local Storage Emulation Service.
Provides:
- Seamless S3 object storage for raw metadata, raster indices, and daily risk snapshots
- Fully compatible local filesystem fallback (emulating S3 bucket directory tree)
- Automated AWS SNS dispatch alerting for high-risk zones
- Zero credentials required in local mode, full Boto3 support in AWS cloud mode
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError
from config.settings import settings
import logging 

logger = logging.getLogger(__name__)

class AwsS3Service:
    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        self.use_local_emulator = settings.USE_LOCAL_S3_EMULATOR or not (
            settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY
        )
        self.local_base_path = Path(settings.LOCAL_STORAGE_PATH) / "s3_emulated" / self.bucket_name
        self.s3_client = None
        self.sns_client = None
        self.dispatch_topic_arn = getattr(settings, 'SNS_DISPATCH_TOPIC_ARN', None)

        if not self.use_local_emulator:
            try:
                # Initialize both clients using the configured credentials
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_DEFAULT_REGION
                )
                self.sns_client = boto3.client(
                    "sns",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_DEFAULT_REGION
                )
            except Exception:
                self.use_local_emulator = True

        if self.use_local_emulator:
            self.local_base_path.mkdir(parents=True, exist_ok=True)

    def save_json_snapshot(self, key: str, data: Any) -> Dict[str, Any]:
        """
        Saves a JSON snapshot to S3 or local emulated bucket.
        Key format example: 'snapshots/2026-10-25_risk_assessment_48h.json'
        """
        json_bytes = json.dumps(data, indent=2, default=str).encode("utf-8")
        timestamp = datetime.now(timezone.utc).isoformat()

        if self.use_local_emulator:
            dest_file = self.local_base_path / key
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_file, "wb") as f:
                f.write(json_bytes)
            return {
                "storage_backend": "local_s3_emulator",
                "bucket": self.bucket_name,
                "key": key,
                "uri": f"file://{dest_file.resolve()}",
                "size_bytes": len(json_bytes),
                "saved_at": timestamp
            }
        else:
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=json_bytes,
                    ContentType="application/json"
                )
                return {
                    "storage_backend": "aws_s3",
                    "bucket": self.bucket_name,
                    "key": key,
                    "uri": f"s3://{self.bucket_name}/{key}",
                    "size_bytes": len(json_bytes),
                    "saved_at": timestamp
                }
            except ClientError as e:
                # Graceful fallback to local
                dest_file = self.local_base_path / key
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                with open(dest_file, "wb") as f:
                    f.write(json_bytes)
                return {
                    "storage_backend": "local_fallback",
                    "bucket": self.bucket_name,
                    "key": key,
                    "uri": f"file://{dest_file.resolve()}",
                    "size_bytes": len(json_bytes),
                    "error": str(e),
                    "saved_at": timestamp
                }

    def load_json_snapshot(self, key: str) -> Optional[Any]:
        """
        Loads a JSON snapshot from S3 or local emulator.
        """
        if self.use_local_emulator:
            dest_file = self.local_base_path / key
            if dest_file.exists():
                with open(dest_file, "r") as f:
                    return json.load(f)
            return None
        else:
            try:
                resp = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
                content = resp["Body"].read().decode("utf-8")
                return json.loads(content)
            except Exception:
                # Try local emulator backup
                dest_file = self.local_base_path / key
                if dest_file.exists():
                    with open(dest_file, "r") as f:
                        return json.load(f)
                return None

    def trigger_dispatch_sms(self, unit_name: str, score: float, days_since_harvest: int, wind_dir: str, phone_number: str) -> bool:
        """
        Publishes a highly prescriptive SMS to a specific officer via AWS SNS.
        Includes a local emulator fallback for terminal logging during hackathon development.
        """
        message = (
            f"⚠️ PARALI DISPATCH ALERT: {unit_name} | "
            f"Priority Score: {score:.1f}/100\n"
            f"Context: Harvested {days_since_harvest} days ago. High residue detected. "
            f"Wind blowing {wind_dir} towards high-density airshed.\n"
            f"ACTION: Dispatch Happy Seeder units immediately to prevent ignition."
        )

        # Local Emulator / Mock Mode
        if self.use_local_emulator or not self.sns_client:
            logger.info(f"\n[LOCAL MOCK SMS TRIGGERED] -> Dest: {phone_number}\nPayload:\n{message}\n")
            return True

        # Live AWS SNS Mode
        if not self.dispatch_topic_arn:
            logger.warning("SNS_DISPATCH_TOPIC_ARN not set. Skipping live SMS alert.")
            return False

        try:
            response = self.sns_client.publish(
                PhoneNumber=phone_number, 
                Message=message,
                MessageAttributes={
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': 'Transactional' 
                    }
                }
            )
            logger.info(f"Successfully dispatched SMS for {unit_name}. MessageId: {response['MessageId']}")
            return True
        except ClientError as e:
            logger.error(f"Failed to trigger SNS dispatch for {unit_name}: {str(e)}")
            return False

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": "local_emulator" if self.use_local_emulator else "aws_s3_live",
            "bucket_name": self.bucket_name,
            "sns_configured": bool(self.sns_client and self.dispatch_topic_arn),
            "aws_region": settings.AWS_DEFAULT_REGION,
            "emulator_path": str(self.local_base_path.resolve()),
            "credentials_configured": bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)
        }

aws_service = AwsS3Service()
