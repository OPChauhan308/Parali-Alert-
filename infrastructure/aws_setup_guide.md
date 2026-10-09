# Parali Alert: AWS Cloud Architecture & Deployment Guide

This document details the production AWS architecture, deployment steps, IAM policies, and cost-conscious configurations for **Parali Alert**.

---

## 1. Cloud Architecture Overview

```
                        +---------------------------+
                        | Amazon EventBridge        |
                        | (Cron: Daily at 05:30 IST)|
                        +-------------+-------------+
                                      |
                                      v
+------------------------+      +---------------------------+
| External Data Feeds    | ---> | AWS Lambda                |
| - Sentinel-2 (AWS Open)|      | (Pre-Fire Risk Pipeline)  |
| - NASA FIRMS (VIIRS)   |      | Memory: 1024MB, 300s TTL  |
| - Open-Meteo Forecast  |      +-------------+-------------+
+------------------------+                    |
                                              v
                               +---------------------------+
                               | Amazon S3 Data Lake       |
                               | - Raw Scene Metadata      |
                               | - Temporal Spectral Arrays|
                               | - Daily Priority Snapshots|
                               | - Field Dispatch CSVs     |
                               +---------------------------+
```

---

## 2. Cost-Conscious Cloud Design

Parali Alert is architected to operate within or near the **AWS Free Tier** ($0 to <$3/month):
1. **Serverless Execution**: AWS Lambda runs once or twice daily (~30-60 seconds per run). Free tier covers 1,000,000 requests and 3.2 million seconds of compute per month.
2. **Sentinel-2 on AWS Open Data**: Accessed via public zero-cost STAC assets and S3 Open Data buckets without egress fees.
3. **S3 Lifecycle Rules**: Automatically transitions raw snapshots older than 60 days to Glacier/Infrequent Access.
4. **Local Fallback Mode**: The backend includes a complete local emulator (`USE_LOCAL_S3_EMULATOR=true`) for local development without incurring any AWS charges.

---

## 3. Deployment Steps via AWS SAM

### Prerequisites
- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed (`brew install aws-sam-cli`)
- Docker installed (optional, for local container emulation)

### Deploying the Stack
```bash
cd infrastructure
sam build
sam deploy --guided \
  --stack-name parali-alert-cloud \
  --region ap-south-1 \
  --parameter-overrides EnvironmentName=prod
```

---

## 4. Environment Variables Configuration

Set these variables in AWS Systems Manager Parameter Store or Lambda environment:

| Variable | Description | Default |
|---|---|---|
| `S3_BUCKET_NAME` | Dedicated S3 Data Lake Bucket | `parali-alert-data-lake-prod` |
| `AWS_DEFAULT_REGION` | AWS Region | `ap-south-1` |
| `FIRMS_MAP_KEY` | NASA FIRMS API Key | `""` (uses open feeds if blank) |
| `DATA_MODE` | `live` or `sample` | `live` |
| `ENABLE_AIR_QUALITY_CONSEQUENCE` | Downwind consequence proxy | `true` |

---

## 5. IAM Least-Privilege Policy

The Lambda execution role requires only read/write access to the specific Parali Alert S3 bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::parali-alert-data-lake-*",
        "arn:aws:s3:::parali-alert-data-lake-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```
