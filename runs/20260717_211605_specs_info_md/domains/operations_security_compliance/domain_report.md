# Domain Report: Operations, Security & Compliance

**Goal:** Assess the operational footprint, data handling requirements, and regulatory considerations implied by the project details. Your team must design a standalone framework for legal compliance, data security standards, and the day-to-day resource management necessary to support the product launch and lifecycle.

# Unified Domain Report: Operational Footprint, Data Handling, and Regulatory Compliance Framework

This report establishes a comprehensive, production-ready framework for legal compliance, data security, and day-to-day operational resource management to support our product throughout its lifecycle. 

---

## 1. Executive Summary & Key Insights

As we prepare for the enterprise product launch, the operational and regulatory landscape requires a tightly coupled, automated approach to security, compliance, and infrastructure management. Key takeaways include:

1. **Zero-Tolerance Compliance:** The elimination of "right to cure" periods across major U.S. state privacy laws requires our consent and opt-out workflows (specifically Global Privacy Control headers and California’s DROP registry) to be fully functional on day one.
2. **Dynamic Data Guardrails:** A structured four-tier data classification model underpins our identity and encryption architectures. Moving beyond static Role-Based Access Control (RBAC), we mandate Attribute-Based Access Control (ABAC) for sensitive and restricted data levels.
3. **High-Availability Infrastructure:** Our platform targets a monthly uptime of 99.95% for core APIs. To maintain this without ballooning costs, we utilize a multi-layered auto-scaling policy (Kubernetes HPA + Karpenter) paired with aggressive cloud cost-optimizations (AWS Savings Plans, Spot instances, and S3 Intelligent-Tiering).
4. **Resilient Support Pipeline:** Standardized L1/L2/L3 support workflows operate with a strict 15-minute response SLA for critical P1 incidents, managed through on-call rotations and automated rollback-capable deployment pipelines.

*Note: The planned assessment for "Incident Response, Business Continuity, and Lifecycle Governance" (originally assigned to Worker-Oper-4) yielded no result. Gaps and mitigation strategies for these areas are highlighted in the final section of this report.*

---

## 2. Legal and Regulatory Compliance Framework

Modern software systems must navigate a complex grid of overlapping global and regional legal requirements. Our framework is engineered to operationalize these mandates directly into our system architectures.

### Regulatory Mapping Matrix

| Jurisdiction / Law | Key Legal Obligations | Operational Impact | Non-Compliance Risk / Penalties |
| :--- | :--- | :--- | :--- |
| **GDPR (EU & UK)** | - Affirmative opt-in consent for tracking<br>- 72-hour breach notifications<br>- Explicit data minimization & purpose limitation | - Implement strict cookie walls blocking cookies until consent is given<br>- Establish hardcoded automated data retention limits (24-36 months) | Up to €20 million or 4% of global annual turnover, whichever is higher. |
| **U.S. State Laws (CCPA/CPRA, IN, KY, RI, etc.)** | - Auto-recognition of Universal Opt-Outs (GPC)<br>- Mandatory opt-out for AI/ADMT profiling<br>- Integration with CA DROP platform (if Data Broker) | - Code system to parse and honor Global Privacy Control (GPC) headers<br>- Set up an automated check of California's DROP registry every 45 days<br>- Zero "cure periods" | Immediate enforcement and statutory civil penalties per violation without warning. |
| **HIPAA (U.S. Healthcare)** | - Secure Protected Health Information (PHI)<br>- Enforce role-based access control (RBAC)<br>- Execute Business Associate Agreements (BAAs) | - Mandate AES-256 encryption at rest and TLS 1.3 in transit<br>- Restrict third-party integrations to BAA-compliant hosts only | Criminal and civil penalties; immediate HHS and public media notification for breaches >500 users. |
| **COPPA (Children's Privacy)** | - Verifiable parental consent for users < 13<br>- Strict data deletion and minimization | - Implement age-gating across onboarding workflows<br>- Restrict behavioral and tracking ads on child accounts | Extensive FTC civil penalties per violating transaction. |
| **PCI-DSS / GLBA** | - Secure payment and credit cardholder data<br>- Network segmentation | - Prevent card data storage in regular logs<br>- Isolate payment pipelines using strict network segmentation | Payment processor fines; revocation of credit card processing privileges. |

### Dynamic User Consent & Profiling Controls
To meet regional variations in privacy laws, our front-end services run a geotargeted user consent workflow:
1. **Dynamic Detection:** Upon landing, the system identifies user location via secure IP lookups and checks the incoming browser headers for **Global Privacy Control (GPC)** signals.
2. **Opt-In Regions (e.g., EU/UK):** All non-essential, marketing, and profiling trackers are blocked by default. A granular consent banner is presented with no pre-ticked checkboxes. 
3. **Opt-Out Regions (e.g., US General):** Non-essential trackers are permitted by default, but a prominent "Do Not Sell/Share My Personal Info" footer link is rendered. If a GPC signal is active, the system automatically transitions the user to an opt-out state.
4. **Profiling & AI Safeguards:** Users are provided an explicit, separate control to opt out of Automated Decision-Making Technology (ADMT) or AI-driven profiling. All choices are written to an immutable audit database.

### Automated Data Subject Access Requests (DSARs)
The platform manages DSARs through a standardized, automated pipeline to meet strict statutory deadlines (30 days for GDPR; 45 days for US State Laws):

```
 [DSAR Portal Intake] ──► [Auth & Verification] ──► [Classify Jurisdiction & Set SLA]
                                                               │
                                                               ▼
 [Secure File Delivery] ◄── [PII Sanitization Check] ◄── [Automated Extraction & Deletion]
```

* **Intake & Verification (Days 1–3):** Standardized secure portal requests. Identity is verified via existing account credentials to prevent collecting excessive new PII.
* **Extraction & Compilation (Days 5–20):** Automated scripts extract the user's data across production databases, backups, payment gateways, and marketing CRMs into a structured JSON/CSV format.
* **Cascading Deletion (Days 5–20):** If deletion is requested, APIs trigger cascading purges across all internal databases and third-party systems. In addition, California-based consumers are cross-referenced with the CA DROP registry every 45 days to enforce external purge requests.
* **Sanitization & Delivery (Days 20–30/45):** Exported files are scanned to ensure no secondary party’s PII is leaked, and are then delivered via a secure, short-lived, encrypted link.

---

## 3. Data Security Standards and Privacy Architecture

Our privacy-by-design architecture aligns directly with NIST SP 800-53 (Rev. 5) and ISO/IEC 27001:2022 standards. Security controls are strictly apportioned based on our four-tier classification model.

### Data Classification Matrix

| Classification Level | Definition | Examples | Primary Technical Controls |
| :--- | :--- | :--- | :--- |
| **Level 1: Public** | Clear for general public access; exposure carries no operational risk. | Marketing site content, public product documentation. | HTTPS/TLS 1.3, integrity monitoring. |
| **Level 2: Internal** | Routine business operations data; low-risk exposure impact. | Internal wikis, organizational charts, SOPs. | Domain SSO authentication, coarse-grained RBAC, standard disk encryption. |
| **Level 3: Confidential** | Sensitive operational data; exposure impacts competitive edge. | Source code, financial projections, legal contracts. | Attribute-Based Access Control (ABAC), DLP monitoring, AES-256 encryption. |
| **Level 4: Restricted** | Highly sensitive data bound by legal or statutory compliance mandates. | PII, PHI, Cardholder Data (PCI), cryptographic keys. | Envelope encryption, TEEs (Intel SGX), database tokenization, multi-factor ABAC. |

### Encryption & Key Management (KMS)
* **Data in Motion:** Modern TLS 1.3 is the mandatory standard for all ingress public APIs (TLS 1.2 is restricted to legacy B2B APIs only). Perfect Forward Secrecy (PFS) is enforced using `TLS_AES_256_GCM_SHA384`. Internal microservices communicate strictly via mutual TLS (mTLS).
* **Data at Rest:** All block, object, and database storage arrays are encrypted using AES-256. Highly restricted data undergoes envelope encryption, where local Data Encryption Keys (DEKs) are dynamically generated and wrapped with Key Encryption Keys (KEKs) managed inside FIPS 140-3 Level 3 validated Hardware Security Modules (HSMs).
* **Data in Use:** For Level 4 data workloads, the system leverages cloud-native Hardware-Based Trusted Execution Environments (TEEs) such as Intel SGX or AMD SEV to ensure secure, confidential memory computing.

### Zero-Trust Access Control (RBAC to ABAC Transition)
While coarse-grained user provisioning matches internal departments via Role-Based Access Control (RBAC), access to Level 3 (Confidential) and Level 4 (Restricted) datasets is controlled dynamically at runtime by an Attribute-Based Access Control (ABAC) engine. This engine evaluates three distinct sets of attributes:
* **Subject Attributes:** Security clearance level, device compliance/patch state, current risk score.
* **Resource Attributes:** Classification tagging, jurisdiction constraints, data owner constraints.
* **Contextual Attributes:** Current GPS geolocation coordinates, active VPN connection state, request timestamps.

### Vulnerability and Lifecycle Management
We incorporate a "shift-left" security methodology coupled with rigid remediation SLA windows:
* **Pipeline Security Gates:** Every code check-in undergoes automated Static Application Security Testing (SAST), Dynamic Application Security Testing (DAST), and Software Composition Analysis (SCA) to flag and block vulnerable third-party dependencies before compilation.
* **Runtime Verification:** Continuous vulnerability scanners, Cloud Security Posture Management (CSPM), and Container Workload Protection Platforms (CWPP) map configurations in real-time. Vulnerabilities are prioritized using CVSS v4.0 metrics and the Exploit Prediction Scoring System (EPSS).
* **Remediation SLAs:** 
  * *Critical:* 24–48 hours (or immediate execution of mitigating network rules)
  * *High:* 7 days
  * *Medium:* 30 days
  * *Low:* 90 days
* **Secure Destruction:** Data exceeding statutory holding periods is permanently purged from physical and virtual instances using standards adhering to the **NIST SP 800-88 Guidelines for Media Sanitization**.

---

## 4. Operational Resource Management & Support Infrastructure

To support the daily workload of our enterprise services, we maintain a resilient operational infrastructure designed for 99.99% system availability.

### Infrastructure Scaling Requirements
Our primary runtime workloads are hosted inside Amazon EKS (Elastic Kubernetes Service) with dynamic auto-scaling rules:

1. **Compute (EKS):** 
   * The **Horizontal Pod Autoscaler (HPA)** scales pods based on Target Average CPU Utilization at **70%** and Target Average Memory Utilization at **80%**. Pod scaling is also triggered directly if Prometheus detects HTTP request rates passing **150 TPS** per pod.
   * **Karpenter** acts as the cluster autoscaler, dynamically spinning up EC2 instances from mixed families (`c6i` compute-optimized and `m6i` general-purpose) to minimize cost while resolving unschedulable pod states.
2. **Database (Amazon Aurora PostgreSQL):**
   * Primary writer runs on a high-capacity `db.r6g.4xlarge` instance (64GB RAM, 16 vCPUs).
   * Read performance scales horizontally by deploying up to **5 Read Replicas** dynamically when average CPU utilization exceeds **65%** or database connections exceed **2,500**. Connection starvation is managed via **PgBouncer** connection pools.
3. **Storage & Content Delivery:**
   * Global static assets are cached on an Amazon CloudFront CDN, aiming for an **85% origin offload rate**. S3 bucket ingestion scales beyond base API limits (3,500 PUT/5,500 GET per second) using structured prefix partitioning.

### Support Tier Structure & Escalation Path
We manage customer and system issues under a 24/7/365 Follow-the-Sun support model:

| Support Tier | Team | Key Responsibilities | Primary Toolkit | Response SLA |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | NOC / Service Desk | Initial triage, basic troubleshooting, user access, routing to L2. | Jira Service Desk, Confluence, CLI | **< 15 min** (P1) / **< 1 hr** (P2-P4) |
| **L2** | DevOps & SysAdmin | Deep troubleshooting, log analysis, configuration patches, DB queries. | Datadog, ELK, Kubectl, SQL | **< 30 min** (P1) / **< 4 hr** (P2-P4) |
| **L3** | Core SRE / Eng | Hotpatching, code bugfixes, DB migrations, IaC/Terraform updates. | Go, Python, React, AWS, TF | **Immediate** (P1) / **< 24 hr** (P2-P4) |

* **PagerDuty Escalation:** On-call rotations operate weekly. If a primary engineer fails to acknowledge a P1/P2 page within **10 minutes**, the system automatically escalates to the secondary engineer, and then to the Engineering Director after an additional **5 minutes**.

### Observability Metrics (SLIs, SLOs, SLAs)
Our operations are measured against the **Four Golden Signals** (Latency, Traffic, Errors, and Saturation):

* **Service Level Objectives (SLOs):**
  * *API Gateway:* **99.95%** of API requests must yield response times < 200ms (excluding 5xx codes).
  * *Web Frontend:* **99.0%** of user sessions must fully render and become interactive within 1.5 seconds.
  * *Database (Aurora):* **99.9%** of queries must execute in < 50ms with connections below 80% capacity.
* **Customer Service Level Agreement (SLA) & Credits:**
  * We commit to a monthly uptime SLA of **99.9%** for core APIs.
  * *Breach Penalties:* 10% bill credit returned if availability drops below 99.9%; 25% credit returned below 99.5%; and 50% credit returned below 99.0%.
* **Monitoring Stack:** Real-time metrics and APM distributed tracing are aggregated via **Datadog** (using native **OpenTelemetry** instrumentation). Structured logs are collected via **ELK**, where PII is dynamically masked at the log-shipper level to preserve user privacy.

---

## 5. Ongoing Change Control & Cost Optimization

System updates must occur without impacting operational stability, and infrastructure costs must scale efficiently.

### Change Management Workflow
* **Standard Changes (Low-Risk, Pre-Approved):** OS patches or backup tests that are peer-reviewed in Git and auto-deployed via CI/CD pipelines once testing is successful.
* **Normal Changes (Code Releases, DB Schemas):** Require formal ticket logging, staging validation, peer-reviews, and approval by the **Change Advisory Board (CAB)**, which meets twice weekly.
* **Emergency Changes (Active Incidents/Critical Patches):** Bypasses standard CAB; requires immediate approval from the **Emergency CAB (ECAB)** (minimum of two technical directors). A Post-Implementation Review (PIR) must be published within 48 hours.

### Modern Deployment and Rollback Strategies
We employ low-risk deployment models to protect production stability:
* **Canary Deployments:** Microservices route **5%** of live traffic to new versions. System health (error rates, latency, pod crashes) is validated for **30 minutes** before traffic is incrementally ramped up (25% -> 50% -> 100%).
* **Blue/Green Deployments:** Front-end and heavy database configurations spin up parallel "green" environments. Traffic is instantly swapped via AWS Route53 weighted DNS once validated.
* **Automated Rollbacks:** Deployments are immediately aborted and rolled back if:
  * HTTP 5xx error rates exceed **1%** of total traffic over any 2-minute window.
  * P95 latency increases by more than **25%** over the current baseline.
  * More than **10%** of pods experience a `CrashLoopBackOff` state.

### Cloud Cost-Optimization Strategies
To prevent resource waste, we implement continuous cloud cost-controls:
1. **Right-Sizing & Serverless:** AWS Compute Optimizer dynamically flags over-provisioned nodes. Any instance averaging under **15% CPU** usage over 14 days is automatically downsized. Background, non-continuous cron jobs are run entirely on AWS Lambda or ECS Fargate to minimize idle host costs.
2. **Commitment Models:** We maintain a 3-year **Compute Savings Plan** to cover **70%** of baseline compute, yielding up to **45%** savings over on-demand rates. Reserved Instances (RIs) are locked in for stable database nodes on 1-year terms.
3. **Spot Instances:** Kubernetes worker nodes utilize Spot instances managed by Karpenter for non-critical, stateless, or analytical queuing workloads, lowering compute costs by up to **90%**.
4. **Data Tiering & Lifecycle Policies:** Standard S3 storage leverages **S3 Intelligent-Tiering** to automatically shift cold data to lower-cost tiers. Standard application debug logs are migrated to Glacier Deep Archive after **14 days** and deleted after **90 days**.

---

## 6. Gaps, Risks, and Mitigations

### Missing Worker Output Flag (Worker-Oper-4)
The task "Develop Incident Response, Business Continuity, and Lifecycle Governance" assigned to **Worker-Oper-4 returned no result (N/A)**. To protect our launch, we flag this gap as a **High Priority Risk** and propose the following immediate mitigations:

1. **Interim Incident Response (IR) Plan:**
   * *Gap:* Missing formalized, step-by-step IR procedures for non-breach platform outages.
   * *Mitigation:* Until a complete IR plan is designed, SRE teams will default to the PagerDuty escalation policies, leveraging L1/L2/L3 workflows and the blameless post-mortem framework outlined in Section 4. We will also run our scheduled bi-annual breach drills focusing on simulated containment.
2. **Interim Business Continuity & Disaster Recovery (BC/DR):**
   * *Gap:* No defined Recovery Point Objective (RPO) or Recovery Time Objective (RTO) targets.
   * *Mitigation:* Standardize PostgreSQL Aurora database backups to maintain automated continuous point-in-time recovery (PITR) with a **35-day retention window**, backing up to a secondary AWS geographical region. All storage volumes must have daily snapshot configurations active.
3. **Software Lifecycle Governance:**
   * *Gap:* Missing formal end-of-life (EOL) and software deprecation schedules.
   * *Mitigation:* Default to our bi-weekly AWS Compute Optimizer and active dependency reviews to flag outdated packages, enforcing immediate upgrading of security-critical packages according to our Vulnerability Remediation SLAs.

---

### Saving synthesised report
The finalized, cohesive domain report has been compiled and saved to the designated path:
`domain_report.md`
