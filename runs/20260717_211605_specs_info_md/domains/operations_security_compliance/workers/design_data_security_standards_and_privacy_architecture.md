# Task: Design Data Security Standards and Privacy Architecture

**Goal:** Formulate a robust, standalone data security policy and privacy-by-design architectural blueprint. Detail the data lifecycle requirements, including data classification schemes, encryption standards (in-transit, at-rest, and in-use), access control paradigms (RBAC/ABAC), secure API integrations, and vulnerability management cycles. Align your recommendations with industry standards like NIST SP 800-53 or ISO/IEC 27001. You must write your complete standards document and save it to 'workers/data_security_standards.md'.

**Result:**
# Data Security Standards and Privacy Architecture Blueprint

This blueprint outlines the enterprise standards and architectural patterns designed to protect organizational data assets, align with NIST SP 800-53 (Rev. 5) and ISO/IEC 27001:2022 standards, and implement Privacy-by-Design (PbD) principles.

---

## 1. Data Classification Matrix
To guarantee appropriate security control allocation (complying with NIST FIPS 199/200), organizational data is classified into four distinct levels:

| Classification Level | Definition | Examples | Primary Technical Controls |
| :--- | :--- | :--- | :--- |
| **Level 1: Public** | Data cleared for general public access; exposure carries no risk. | Marketing collateral, public documentation, external web content. | HTTPS/TLS 1.3, integrity monitoring. |
| **Level 2: Internal** | Routine business data intended for internal use only; low exposure impact. | Internal memos, organizational charts, standard operating procedures. | Domain authentication, basic RBAC, standard at-rest encryption. |
| **Level 3: Confidential** | Sensitive operations data; disclosure could harm competitive advantage or reputation. | Source code, financial models, legal agreements, vendor contracts. | ABAC enforcement, DLP monitoring, strict AES-256 encryption. |
| **Level 4: Restricted** | Highly sensitive data bound by strict regulatory, legal, or statutory mandates. | PII, PHI, Cardholder Data (PCI-DSS), cryptographic keys. | Envelope encryption, TEEs (Intel SGX), database tokenization, multi-factor ABAC. |

---

## 2. Encryption, Key Management, and Identity/Access Management (IAM) Specifications

### 2.1 Encryption Standards
*   **Data In-Transit (Motion):** TLS 1.3 is the mandatory standard for all external APIs and public web endpoints (TLS 1.2 allowed solely for legacy B2B integrations). Perfect Forward Secrecy (PFS) is required using approved cipher suites like `TLS_AES_256_GCM_SHA384`. Mutual TLS (mTLS) is mandated for all internal microservices communications.
*   **Data At-Rest:** AES-256 standard encryption across all databases, object storage (S3), and block storage (EBS). 
*   **Data In-Use (Processing):** Hardware-based Trusted Execution Environments (TEEs, such as Intel SGX/AMD SEV) are required for Level 4 (Restricted) workloads in cloud environments. Fully Homomorphic Encryption (FHE) is applied where multi-tenant processing of encrypted data is necessary.

### 2.2 Key Management Infrastructure
*   **Hardware Security Modules (HSMs):** Key management must be backed by FIPS 140-3 Level 3 validated physical HSMs or cloud native KMS.
*   **Key Protection Strategy:** Implementation of envelope encryption architecture where local Data Encryption Keys (DEKs) are dynamically generated and encrypted by highly restricted Key Encryption Keys (KEKs) managed within the KMS.

### 2.3 Identity and Access Management (IAM)
*   **Role-Based Access Control (RBAC):** Leveraged for foundational, coarse-grained user directory provisioning matching department roles.
*   **Attribute-Based Access Control (ABAC):** Mandated for fine-grained access determination on Level 3 and Level 4 datasets. ABAC engine dynamically evaluates:
    *   *Subject Attributes:* Security clearance level, endpoint patch compliance state, current risk score.
    *   *Resource Attributes:* Data classification tagging, legal jurisdiction, data ownership.
    *   *Contextual Attributes:* Geolocation coordinates, request timestamp, network connection state (e.g., VPN requirement).

---

## 3. Secure Data Flow and Vulnerability Management Protocols

### 3.1 Secure Data Flow & Transmission Control
To safely process data across the lifecycle (Creation, Storage, Usage, Sharing, Archiving, Destruction):
*   **Collection & Minimization:** Collection of PII must map to a defined business objective with explicit user consent (NIST PT-2, PT-3).
*   **API Gateways & Authentication:** Every data exchange interface sits behind an enterprise API Gateway. Client requests are authenticated utilizing **OAuth 2.0 / OIDC** with short-lived JWT tokens, checking scope permissions dynamically.
*   **Traffic Sanitization & Defense:** Edge-level Web Application Firewalls (WAF) inspect inbound requests. Strict schema validation (e.g., OpenAPI compliance enforcement) drops anomalous payloads before execution.
*   **Destruction Protocols:** When data exceeds storage retention windows, physical and virtual assets are wiped utilizing **NIST SP 800-88 Guidelines for Media Sanitization** standards.

### 3.2 Vulnerability Management Protocol
*   **Shift-Left Discovery:** Continuous SAST, DAST, and Software Composition Analysis (SCA) for third-party open-source components are embedded as automated quality gates within the CI/CD deployment pipeline.
*   **Continuous Runtime Monitoring:** Weekly credentialed vulnerability scans alongside Cloud Security Posture Management (CSPM) and Container Workload Protection Platforms (CWPP) actively inspect live configurations.
*   **Prioritization Metric:** Uses CVSS v4.0 metrics paired with the Exploit Prediction Scoring System (EPSS) to isolate and patch exploits active "in the wild" first.
*   **Remediation SLAs:**
    *   *Critical Severity:* 24–48 hours (or immediate execution of mitigating network rules).
    *   *High Severity:* 7 days.
    *   *Medium Severity:* 30 days.
    *   *Low Severity:* 90 days.
*   **Feedback & Verification:** Continuous automated regression testing and automated Red Team (penetration testing) exercises validate that deployed patches successfully resolve identified vulnerabilities.

**Key Findings:**
- Defined a comprehensive 4-tier data classification matrix (Public, Internal, Confidential, Restricted) mapped to specific technical compliance requirements and NIST/ISO frameworks.
- Specified enterprise encryption practices including TLS 1.3 with PFS in-transit, AES-256 with FIPS 140-3 Level 3 HSM envelope key management at-rest, and TEEs/Confidential Computing in-use.
- Architected zero-trust IAM architecture combining directory-level RBAC with granular, attribute-based access control (ABAC) dynamically evaluating subject, resource, and environmental context.
- Established a proactive vulnerability management protocol leveraging Shift-Left pipeline gates (SAST/DAST/SCA), EPSS prioritizations, and strict remediation SLAs ranging from 24-48 hours to 90 days.

**Metadata:**
- Worker: worker-Oper-2
- Tokens: 8914
- Duration: 51.9s
- Confidence: very_high
