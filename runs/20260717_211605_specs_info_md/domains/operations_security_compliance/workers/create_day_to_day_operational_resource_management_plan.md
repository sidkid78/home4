# Task: Create Day-to-Day Operational Resource Management Plan

**Goal:** Develop a comprehensive resource management and operational footprint plan to support the product's daily lifecycle. Define requirements for infrastructure scaling, support tier structure (L1/L2/L3), monitoring/observability metrics (SLIs, SLOs, SLAs), change management processes, and ongoing cost-optimizations. You must write this operational blueprint and save it to 'workers/operational_resource_management.md'.

**Result:**
# Operational Resource Management and Footprint Plan
**Document Reference:** OPS-RMP-001  
**Version:** 1.0.0  
**Target Path:** `workers/operational_resource_management.md`  

---

## 1. Executive Summary & Document Purpose
This document establishes the comprehensive operational resource management framework and footprint plan required to support the daily lifecycle of our enterprise product. It details the infrastructure scaling strategies, tiered support workflows, monitoring and observability frameworks, change management protocols, and cost-optimizations required to maintain high availability (99.99%), reduce operational overhead, and control cloud expenditures. 

This blueprint serves as the official operational standard for Site Reliability Engineering (SRE), DevOps, Infrastructure, and Customer Support teams.

---

## 2. Infrastructure Scaling Requirements

To ensure the system dynamically adapts to fluctuating workloads without sacrificing performance or incurring excessive costs, we implement a multi-layered, automated scaling strategy across our compute, database, and storage tiers.

### 2.1 Compute Scaling (Kubernetes / Auto-scaling Groups)
Our application runs on containerized workloads managed by Amazon EKS (Elastic Kubernetes Service). We utilize a two-pronged scaling approach:

1. **Horizontal Pod Autoscaler (HPA):**
   * **Metrics:** Target Average CPU Utilization at **70%** and Target Average Memory Utilization at **80%**.
   * **Custom Metric (Prometheus):** HTTP Request Rate (TPS per pod) exceeding **150 TPS** triggers proactive scaling.
   * **Cooldown Periods:** Scale-up cooldown is set to **0 seconds** (immediate), while scale-down cooldown is set to **300 seconds (5 minutes)** to prevent "flapping."
2. **Cluster Autoscaler (Karpenter):**
   * **Provisioning:** Dynamically provisions EC2 instances based on unschedulable pod requirements.
   * **Instance Selection:** Mixed-instance policy utilizing compute-optimized (`c6i` series) and general-purpose (`m6i` series) families to balance performance and cost.

### 2.2 Database Scaling (Amazon Aurora PostgreSQL)
Databases are scaled to handle read-heavy traffic and secure data durability.
* **Vertical Scaling:** Primary writer instance utilizes `db.r6g.4xlarge` (64GB RAM, 16 vCPUs).
* **Horizontal Read Scaling:** 
  * Aurora Auto-scaling dynamically adds up to **5 Read Replicas** based on average CPU utilization exceeding **65%** or Average Connections exceeding **2,500**.
  * Connection pooling is enforced via **PgBouncer** to prevent connection starvation and reduce overhead.
* **Storage Auto-scaling:** Storage automatically scales up to **64 TB** without downtime based on actual data footprint.

### 2.3 Storage and Network Scaling
* **Object Storage (Amazon S3):** Unlimited scaling naturally. API request rate scaling is handled by prefix partitioning to exceed the base limits of 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per prefix.
* **Content Delivery Network (Amazon CloudFront):** Configured for global edge caching of all static assets, reducing origin load by **85%**.
* **Load Balancing (AWS ALB):** Pre-warmed for known high-traffic seasonal events; otherwise, automatically scales based on LCU (Load Balancer Capacity Units) consumption.

---

## 3. Support Tier Structure (L1/L2/L3) & Incident Management

We operate a 24/7 Follow-the-Sun support model designed to triage, escalate, and resolve incidents with minimal mean time to resolve (MTTR).

### 3.1 Support Tier Matrix

| Tier | Role / Team | Key Responsibilities | Primary Skills / Tools | Response Time Target |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | Service Desk / NOC | Initial triage, categorization, password resets, basic troubleshooting, user access, routing to L2. | Jira Service Management, Confluence Knowledge Base, Basic CLI, Monitoring Dashboards. | **< 15 minutes** (P1) / **< 1 hour** (P2-P4) |
| **L2** | DevOps & SysAdmin Team | Deep technical troubleshooting, log analysis, configuration changes, patching, restarting services, DB queries. | Datadog, Kibana, Kubernetes (kubectl), SQL, SSH access to staging/production clones. | **< 30 minutes** (P1) / **< 4 hours** (P2-P4) |
| **L3** | Core Engineering / SRE | Bug fixing, hotpatching, infrastructure-as-code repairs, database migrations, third-party vendor escalations. | Source Code (Go, React, Python), AWS Console, Terraform, Deep Database Tuning. | **Immediate** (P1) / **< 24 hours** (P2-P4) |

### 3.2 Escalation Pathways and SLA Workflow
```
[User Incident Reported]
         │
         ▼
 ┌──────────────┐
 │   L1 Team    ├───────► Is it a known issue with KB article? ──► [YES] ──► Resolve & Close
 └──────┬───────┘
        │ [NO / Requires Tech Access]
        ▼
 ┌──────────────┐
 │   L2 Team    ├───────► Can it be resolved via Config/Restart? ──► [YES] ──► Resolve & Close
 └──────┬───────┘
        │ [NO / Requires Code Change or Infra Fix]
        ▼
 ┌──────────────┐
 │   L3 Team    ├───────► Hotfix / Terraform Run / DB Patch ───────► Deploy to Prod ──► Close
 └──────────────┘
```

### 3.3 Incident Severity Classifications & Resolution Targets

* **Severity 1 (P1) - Critical:** core service is completely down for all or a significant portion (>10%) of users.
  * *Response SLA:* 15 mins | *Workaround SLA:* 1 hour | *Resolution SLA:* 4 hours.
* **Severity 2 (P2) - High:** Key functionality is impaired, or a subset of customers cannot access specific modules with no immediate workaround.
  * *Response SLA:* 30 mins | *Workaround SLA:* 4 hours | *Resolution SLA:* 12 hours.
* **Severity 3 (P3) - Medium:** Minor bugs, performance degradation below SLOs, but service is functional and workarounds exist.
  * *Response SLA:* 4 hours | *Workaround SLA:* 24 hours | *Resolution SLA:* 5 business days.
* **Severity 4 (P4) - Low:** Cosmetic issues, documentation errors, enhancement requests.
  * *Response SLA:* 24 hours | *Workaround SLA:* N/A | *Resolution SLA:* Next scheduled release cycle.

### 3.4 On-Call Rotation and Paging
* Managed via **PagerDuty**.
* **Primary and Secondary Rotations:** Rotated weekly across global SRE and engineering teams.
* **Escalation Policy:** If the Primary on-call does not acknowledge a P1/P2 alert within **10 minutes**, the system automatically pages the Secondary. If unacknowledged after another **5 minutes**, it escalates to the Engineering Director.

---

## 4. Monitoring & Observability Metrics (SLIs, SLOs, SLAs)

We utilize the **Four Golden Signals** (Latency, Traffic, Errors, and Saturation) to monitor system health and guarantee compliance with our business agreements.

### 4.1 Service Level Indicators (SLIs) and Service Level Objectives (SLOs)

| Service Component | SLI Definition | Target SLO (Monthly) | Error Budget |
| :--- | :--- | :--- | :--- |
| **API Gateway** | % of API requests with HTTP status codes other than 5xx with response time < 200ms. | **99.95%** of requests | **0.05%** of requests (approx. 21.6 mins of downtime/month) |
| **Web Frontend** | % of pages fully rendered and interactive within 1.5 seconds (LCP). | **99.0%** of sessions | **1.0%** of sessions |
| **Database (Aurora)**| % of queries executed in < 50ms and connection count < 80% of capacity. | **99.9%** of queries | **0.1%** of queries |
| **Payment Processor** | % of successful transactions processed without timeout or 5xx failures. | **99.99%** of requests | **0.01%** of requests |

### 4.2 Customer Service Level Agreements (SLAs)
* **Monthly Uptime SLA:** We guarantee **99.9%** availability of core APIs and user portals.
* **Financial Penalty Structure for SLA Breaches:**
  * < 99.9% to 99.5% availability: **10%** bill credit returned to affected customers.
  * < 99.5% to 99.0% availability: **25%** bill credit returned.
  * < 99.0% availability: **50%** bill credit returned.

### 4.3 Observability Stack Setup
* **Metrics & APM:** **Datadog** for unified trace, metric, and log monitoring. Automated APM tracing across all microservices.
* **Log Aggregation:** **Elasticsearch, Logstash, and Kibana (ELK)** for structured indexing of application logs. Sensitive data (PII) is masked at the log-shipper level.
* **Distributed Tracing:** **OpenTelemetry (OTel)** instrumentation embedded in services, outputting trace data to Datadog.
* **Synthetics:** Synthetic HTTP tests run every **60 seconds** from 5 global AWS regions to detect external reachability and DNS issues.

---

## 5. Change Management Processes

To preserve system stability and minimize human error, all modifications to production must adhere to our strict change control protocols.

### 5.1 Change Categories and Workflows

1. **Standard Changes:** Low-risk, pre-approved, recurring operational tasks (e.g., standard OS patching, daily database backup testing).
   * *Workflow:* Peer-reviewed in git; auto-approved upon passing CI/CD pipelines. No CAB (Change Advisory Board) approval required.
2. **Normal Changes:** Non-recurring infrastructure modifications, application feature releases, database schema alterations.
   * *Workflow:* Requires a formal Change Request (CR) ticket, peer-review by senior engineers, validation in staging, and formal sign-off by the **Change Advisory Board (CAB)**, which meets twice weekly.
3. **Emergency Changes:** Crucial fixes implemented to resolve active P1 incidents, restore degraded services, or patch critical security vulnerabilities.
   * *Workflow:* Bypasses regular CAB. Requires approval from the **Emergency Change Advisory Board (ECAB)** (comprising at least two senior technical leaders/directors). Post-incident, a full review is conducted.

### 5.2 Deployment Strategies
* **Canary Deployments:** For core microservices, deployments route **5%** of production traffic to the new version. The system monitors error rates, latency, and system resource utilization for **30 minutes**. If performance is stable, traffic is gradually increased (25% -> 50% -> 100%).
* **Blue/Green Deployments:** For database-heavy front-end applications, a green environment is fully spun up and warmed up. Once validation checks pass, traffic is instantly rerouted via Route53 DNS weighted routing.

### 5.3 Rollback Triggers & Automated Rollbacks
Deployments are automatically halted and rolled back to the previous stable state if any of the following metrics are tripped during the canary or rolling phase:
* **HTTP 5xx Rate:** Exceeds **1%** of total traffic over a rolling 2-minute window.
* **P95 Latency:** Spikes by more than **25%** over the baseline.
* **Pod CrashLoopBackOffs:** Occurs in more than **10%** of new pods.
* **Uncaught Exceptions:** Frequency in logs increases by **20%** compared to the prior release.

### 5.4 Post-Implementation Review (PIR) and Post-Mortems
* **Blameless Culture:** Focuses on system vulnerabilities and process enhancements rather than individual mistakes.
* **Mandatory Criteria:** A PIR/Post-Mortem must be conducted within **48 hours** for all P1 incidents and failed Normal changes.
* **Action Items:** Outlined with strict owners and completion dates (<14 days) to prevent incident recurrence.

---

## 6. Ongoing Cost-Optimization Strategies

Maintaining high efficiency and ensuring zero waste is integral to our operational lifecycle.

### 6.1 Instance Right-Sizing and Serverless Adoption
* **AWS Compute Optimizer:** Reviewed bi-weekly to identify over-provisioned EC2 and RDS instances. Instances with average CPU utilization under **15%** over a 14-day period are downgraded to a lower tier.
* **AWS Lambda & Fargate:** Non-continuous background jobs, data ingestion pipelines, and nightly batch processing are migrated to serverless execution models to eliminate idle host costs.

### 6.2 Commitment and Purchasing Models
* **AWS Savings Plans:** We secure a 3-year Compute Savings Plan covering **70%** of baseline compute costs, yielding up to **45%** savings over on-demand rates.
* **Reserved Instances (RIs):** Utilized for stable database nodes (Amazon Aurora PostgreSQL) on a 1-year partial-upfront payment schedule.
* **Spot Instances:** Integrated into our Kubernetes worker node groups via Karpenter for non-critical, fault-tolerant workloads (e.g., test environments, background image processing, and analytical queues). This yields savings of up to **90%** compared to on-demand pricing.

### 6.3 Storage Lifecycle Management
* **Amazon S3 Intelligent-Tiering:** Default storage class for application-generated user data. It dynamically shifts infrequently accessed files to cheaper tiers (Infrequent Access, Archive Instant Access) without performance loss.
* **Lifecycle Rules:**
  * Application Debug Logs: Transitioned to S3 Glacier Deep Archive after **14 days** and permanently deleted after **90 days**.
  * Database Backups: Retained locally for **35 days** (point-in-time recovery), archived to Glacier for **365 days**, then permanently purged.

### 6.4 Cost Allocation Tags and Budget Alerts
* **Resource Tagging Policy:** Mandatory tags for all provisioned infrastructure: `Environment` (Production, Staging, Dev), `Project`, `Cost-Center`, and `Owner`. Un-tagged resources are flagged and terminated automatically after **48 hours** by automated custodian scripts.
* **AWS Budgets:** Configured with real-time Slack and email alerts. Notifications are triggered when actual cloud spend reaches **80%, 90%, and 100%** of the monthly budget. An additional **110% forecast trigger** sends a high-priority page to the Finance and Engineering leadership teams.


**Key Findings:**
- Established dynamic, multi-layered auto-scaling policies including HPA targets (70% CPU / 80% RAM), Karpenter cluster auto-scaling, and Aurora DB read replica expansions based on connection saturation.
- Defined a structured L1/L2/L3 support model with clear escalation SLA thresholds (under 15 minutes for P1 incidents) and structured on-call paging mechanisms using PagerDuty.
- Formulated detailed SLIs, SLOs, and SLAs (such as a 99.9% availability target with tiered financial credits for breaches) and integrated an observability stack based on Datadog, ELK, and OpenTelemetry.
- Standardized change management into Standard, Normal, and Emergency categories with clear deployment strategies (Blue/Green and Canary) and automated rollback triggers.
- Optimized cloud footprint cost parameters through the systematic deployment of AWS Savings Plans, Karpenter-managed Spot instances, S3 Intelligent-Tiering lifecycle rules, and automated resource tagging.

**Metadata:**
- Worker: worker-Oper-3
- Tokens: 8411
- Duration: 32.8s
- Confidence: very_high
