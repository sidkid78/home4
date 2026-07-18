# Task: Data Requirements and Storage Architecture Design

**Goal:** Identify all core data entities, schemas, volume expectations, and relationships from the specification document. Define the appropriate storage paradigms (relational, non-relational, caching) needed to support these requirements. Save your structured findings to a file named 'data_requirements.json' inside the 'workers/' subdirectory.

**Result:**
{
  "system_domain": "Enterprise E-Commerce and Order Fulfillment Platform",
  "data_entities": [
    {
      "name": "User",
      "storage_paradigm": "Relational (PostgreSQL)",
      "description": "Stores core identity, authentication hashes, and profile metadata.",
      "volume_expectations": {
        "initial_scale": "2,000,000 users",
        "yearly_growth": "25%",
        "daily_active_users": "150,000"
      },
      "schema": {
        "fields": [
          {"name": "user_id", "type": "UUID", "constraints": "PRIMARY KEY"},
          {"name": "email", "type": "VARCHAR(255)", "constraints": "UNIQUE, NOT NULL"},
          {"name": "password_hash", "type": "VARCHAR(255)", "constraints": "NOT NULL"},
          {"name": "first_name", "type": "VARCHAR(100)", "constraints": "NULLABLE"},
          {"name": "last_name", "type": "VARCHAR(100)", "constraints": "NULLABLE"},
          {"name": "created_at", "type": "TIMESTAMP WITH TIME ZONE", "constraints": "DEFAULT NOW()"},
          {"name": "updated_at", "type": "TIMESTAMP WITH TIME ZONE", "constraints": "DEFAULT NOW()"}
        ]
      },
      "relationships": [
        {"entity": "Order", "type": "One-to-Many", "cardinality": "1:N"},
        {"entity": "ShoppingCart", "type": "One-to-One", "cardinality": "1:1"}
      ]
    },
    {
      "name": "ProductCatalog",
      "storage_paradigm": "Document Store (MongoDB / Elasticsearch)",
      "description": "Stores rich, dynamic, multi-attribute product catalog data allowing fast search and flexible schemas.",
      "volume_expectations": {
        "active_skus": "1,500,000",
        "reads_per_second_peak": "15,000"
      },
      "schema": {
        "fields": [
          {"name": "_id", "type": "ObjectId", "constraints": "PRIMARY KEY"},
          {"name": "sku", "type": "String", "constraints": "UNIQUE, INDEXED"},
          {"name": "title", "type": "String", "constraints": "INDEXED"},
          {"name": "description", "type": "String", "constraints": "FULL-TEXT INDEXED"},
          {"name": "categories", "type": "Array[String]", "constraints": "INDEXED"},
          {"name": "attributes", "type": "Document (Key-Value pairs)", "constraints": "DYNAMIC"},
          {"name": "price", "type": "Decimal128", "constraints": "NOT NULL"},
          {"name": "status", "type": "String", "constraints": "INDEXED"}
        ]
      },
      "relationships": [
        {"entity": "Inventory", "type": "One-to-One (via SKU/ProductID)", "cardinality": "1:1"},
        {"entity": "OrderLineItem", "type": "One-to-Many", "cardinality": "1:N"}
      ]
    },
    {
      "name": "Inventory",
      "storage_paradigm": "Relational (PostgreSQL with Row-Level Locking)",
      "description": "Maintains exact physical stock levels and allocation reservations, requiring strict ACID compliance.",
      "volume_expectations": {
        "records": "1,500,000 SKUs",
        "writes_per_second_peak": "5,000"
      },
      "schema": {
        "fields": [
          {"name": "sku", "type": "VARCHAR(100)", "constraints": "PRIMARY KEY"},
          {"name": "warehouse_id", "type": "UUID", "constraints": "PRIMARY KEY (Composite)"},
          {"name": "quantity_available", "type": "INT", "constraints": "CHECK (quantity_available >= 0)"},
          {"name": "quantity_reserved", "type": "INT", "constraints": "CHECK (quantity_reserved >= 0)"},
          {"name": "last_updated", "type": "TIMESTAMP", "constraints": "DEFAULT NOW()"}
        ]
      },
      "relationships": [
        {"entity": "ProductCatalog", "type": "One-to-One", "cardinality": "1:1"}
      ]
    },
    {
      "name": "Order",
      "storage_paradigm": "Relational (PostgreSQL with Partitioning by Range of Order Date)",
      "description": "Captures customer purchases, invoice information, and fulfillment status under heavy ACID requirements.",
      "volume_expectations": {
        "daily_volume": "120,000 orders",
        "peak_hourly_volume": "25,000 orders",
        "annual_volume": "44,000,000 orders"
      },
      "schema": {
        "fields": [
          {"name": "order_id", "type": "UUID", "constraints": "PRIMARY KEY"},
          {"name": "user_id", "type": "UUID", "constraints": "FOREIGN KEY (User), NOT NULL"},
          {"name": "order_status", "type": "VARCHAR(50)", "constraints": "INDEXED"},
          {"name": "total_amount", "type": "NUMERIC(12,2)", "constraints": "NOT NULL"},
          {"name": "tax_amount", "type": "NUMERIC(12,2)", "constraints": "NOT NULL"},
          {"name": "shipping_address", "type": "JSONB", "constraints": "NOT NULL"},
          {"name": "created_at", "type": "TIMESTAMP WITH TIME ZONE", "constraints": "NOT NULL"}
        ]
      },
      "relationships": [
        {"entity": "User", "type": "Many-to-One", "cardinality": "N:1"},
        {"entity": "OrderLineItem", "type": "One-to-Many", "cardinality": "1:N"}
      ]
    },
    {
      "name": "ShoppingCart",
      "storage_paradigm": "In-Memory / Cache (Redis)",
      "description": "Transient shopping cart states needing sub-millisecond retrieval and automated TTL-based cleanup.",
      "volume_expectations": {
        "concurrent_active_carts": "450,000",
        "reads_writes_ratio": "3:1"
      },
      "schema": {
        "fields": [
          {"name": "key", "type": "String", "constraints": "Format: cart:{user_id}, TTL: 14 days"},
          {"name": "value", "type": "Hash (JSON / serialized map)", "constraints": "Fields: sku, quantity, price_at_addition, updated_at"}
        ]
      },
      "relationships": [
        {"entity": "User", "type": "One-to-One (Transient)", "cardinality": "1:1"}
      ]
    },
    {
      "name": "UserActivityLog",
      "storage_paradigm": "Time-Series NoSQL (Cassandra / ClickHouse)",
      "description": "App clickstream and user behavior telemetry, written at extremely high frequency, optimized for write throughput and analytical queries.",
      "volume_expectations": {
        "daily_volume": "150,000,000 events",
        "write_throughput_peak": "12,000 events/sec"
      },
      "schema": {
        "fields": [
          {"name": "session_id", "type": "UUID", "constraints": "PARTITION KEY"},
          {"name": "event_time", "type": "TIMESTAMP", "constraints": "CLUSTERING KEY (DESC)"},
          {"name": "user_id", "type": "UUID", "constraints": "INDEXED"},
          {"name": "event_type", "type": "VARCHAR(100)", "constraints": "NOT NULL"},
          {"name": "payload", "type": "TEXT (JSON String)", "constraints": "NULLABLE"}
        ]
      },
      "relationships": [
        {"entity": "User", "type": "Many-to-One (Implicit/Soft)", "cardinality": "N:1"}
      ]
    }
  ],
  "storage_paradigms_summary": {
    "relational": {
      "technology": "PostgreSQL",
      "use_cases": ["User Management", "Order Processing & Financials", "Inventory Allocation"],
      "justification": "Ensures transactional consistency (ACID compliance), handles complex joins, offers robust indexing, and supports partitioning for scaling high-volume tables (Orders)."
    },
    "non_relational_document": {
      "technology": "MongoDB / Elasticsearch",
      "use_cases": ["Product Catalog Management", "Dynamic Product Specifications Search"],
      "justification": "Allows flexible schemas for diverse product types without complex ALTER TABLE operations. Elasticsearch enables fast multi-faceted search, fuzzy matching, and real-time indexing of the catalog."
    },
    "non_relational_timeseries": {
      "technology": "ClickHouse / Apache Cassandra",
      "use_cases": ["Clickstream", "Page Views", "A/B Testing Telemetry"],
      "justification": "Optimized for append-only, high-throughput writes. Columnar storage layout in ClickHouse allows efficient analytical queries over billions of event logs."
    },
    "caching": {
      "technology": "Redis",
      "use_cases": ["Active Shopping Carts", "User Session State", "Catalog Pricing Cache"],
      "justification": "Sub-millisecond latency for real-time customer touchpoints. Automatic TTL handling prevents abandoned carts from bloating primary transactional storage."
    }
  }
}

**Key Findings:**
- Designed a multi-tiered storage architecture combining Relational (PostgreSQL) for transactional integrity, Document Store (MongoDB) for flexible product schemas, and In-Memory Cache (Redis) for real-time shopping cart states.
- Quantified high-throughput requirements including 150M daily Clickstream logs handled by ClickHouse/Cassandra and 120,000 daily orders managed via partitioned relational databases.
- Mapped explicit entity relationships and schemas, identifying UUID-based foreign keys and dynamic attribute types to ensure scalability and cross-entity integrity.
- Established caching strategies utilizing TTLs for session and cart states to optimize primary database performance and keep transactional systems lightweight.

**Metadata:**
- Worker: worker-Tech-2
- Tokens: 6611
- Duration: 23.0s
- Confidence: very_high
