# dxs-consigliere 使い方ガイド

## 概要

dxs-consigliere は BSV (Bitcoin SV) ブロックチェーンの高性能インデクサーです。
特定のアドレスやSTASトークンの UTXO、残高、トランザクション履歴を追跡し、リアルタイム通知を提供します。

## 現在のデプロイ情報

| 項目 | 値 |
|------|-----|
| Consigliere API | http://13.230.42.14:5000 |
| Swagger UI | http://13.230.42.14:5000/swagger |
| RavenDB Studio | http://13.230.42.14:8080/studio/index.html |
| SignalR WebSocket | ws://13.230.42.14:5000/ws/consigliere |
| EC2 Instance | t3.small (2 vCPU, 2GB RAM) |
| Region | ap-northeast-1 (Tokyo) |
| データソース | JungleBus (GorillaPool) |

---

## API エンドポイント一覧

### 1. アドレス管理 (Admin)

#### ウォッチアドレスの追加
監視対象のBSVアドレスを追加します。追加後、そのアドレスに関連するトランザクションが自動的にインデックスされます。

```bash
POST /api/admin/manage/address

curl -X POST http://13.230.42.14:5000/api/admin/manage/address \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "name": "Satoshi Genesis Address"
  }'
```

**パラメータ:**
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| address | string | Yes | BSVアドレス |
| name | string | Yes | アドレスの識別名 |

#### STASトークンの追加
監視対象のSTASトークンを追加します。

```bash
POST /api/admin/manage/stas-token

curl -X POST http://13.230.42.14:5000/api/admin/manage/stas-token \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "542a56ec7a307fd68bf925d8f4d525ca61e868ad",
    "symbol": "USDT-TON"
  }'
```

**パラメータ:**
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| tokenId | string | Yes | STASトークンID |
| symbol | string | Yes | トークンシンボル |

---

### 2. 残高・UTXO照会 (Address)

#### 残高照会
```bash
POST /api/address/balance

curl -X POST http://13.230.42.14:5000/api/address/balance \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"],
    "tokenIds": []
  }'
```

**レスポンス例:**
```json
[
  {
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "confirmed": 6800000000,
    "unconfirmed": 0
  }
]
```

#### UTXOセット取得
```bash
POST /api/address/utxo-set

curl -X POST http://13.230.42.14:5000/api/address/utxo-set \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "tokenId": null,
    "satoshis": null
  }'
```

**パラメータ:**
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| address | string | Yes* | BSVアドレス (*addressかtokenIdのいずれか必須) |
| tokenId | string | Yes* | STASトークンID |
| satoshis | long | No | 指定した場合、合計がこの値以上になる最小UTXOセットを返す |

#### バッチUTXOセット取得
```bash
POST /api/address/batch/utxo-set

curl -X POST http://13.230.42.14:5000/api/address/batch/utxo-set \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["address1", "address2"],
    "tokenIds": ["tokenId1"]
  }'
```

#### トランザクション履歴取得
```bash
POST /api/address/history

curl -X POST http://13.230.42.14:5000/api/address/history \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "tokenIds": [],
    "desc": true,
    "skipZeroBalance": false,
    "skip": 0,
    "take": 50
  }'
```

**パラメータ:**
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| address | string | Yes | BSVアドレス |
| tokenIds | string[] | No | フィルタするトークンID |
| desc | bool | No | 降順ソート |
| skipZeroBalance | bool | No | 残高ゼロをスキップ |
| skip | int | Yes | ページネーション: スキップ数 |
| take | int | Yes | ページネーション: 取得数 |

---

### 3. トランザクション (Transaction)

#### トランザクション取得
```bash
GET /api/tx/get/{txid}

curl http://13.230.42.14:5000/api/tx/get/abc123...def456
```

#### バッチトランザクション取得 (最大1000件)
```bash
GET /api/tx/batch/get?ids=txid1&ids=txid2

curl "http://13.230.42.14:5000/api/tx/batch/get?ids=txid1&ids=txid2"
```

#### ブロック高によるトランザクション取得 (最大500件/ページ)
```bash
GET /api/tx/by-height/get?blockHeight=700000&skip=0

curl "http://13.230.42.14:5000/api/tx/by-height/get?blockHeight=700000&skip=0"
```

#### トランザクションブロードキャスト
```bash
POST /api/tx/broadcast/{raw_hex}

curl -X POST "http://13.230.42.14:5000/api/tx/broadcast/{raw_transaction_hex}"
```

**重要:** ブロードキャストにはBSVノードRPC接続が必要です。現在のJungleBusのみの構成ではブロードキャストは動作しません。

#### STASトランザクション検証
```bash
GET /api/tx/stas/validate/{txid}

curl http://13.230.42.14:5000/api/tx/stas/validate/abc123...def456
```

---

### 4. リアルタイム通知 (SignalR WebSocket)

#### 接続
```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://13.230.42.14:5000/ws/consigliere")
    .build();

await connection.start();
```

#### アドレスのトランザクション監視を開始
```javascript
await connection.invoke("SubscribeToTransactionStream", {
    address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
});
```

#### イベント受信
```javascript
// 新しいトランザクション検出
connection.on("OnTransactionFound", (hex) => {
    console.log("New transaction:", hex);
});

// トランザクション削除（reorg等）
connection.on("OnTransactionDeleted", (hash) => {
    console.log("Transaction deleted:", hash);
});

// 残高変更
connection.on("OnBalanceChanged", (balanceDto) => {
    console.log("Balance changed:", balanceDto);
});
```

#### WebSocket経由でのブロードキャスト
```javascript
const success = await connection.invoke("Broadcast", rawTransactionHex);
```

#### 監視解除
```javascript
await connection.invoke("UnsubscribeToTransactionStream", {
    address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
});
```

---

### 5. ブロックチェーン同期状態
```bash
GET /api/admin/blockchain/sync-status

curl http://13.230.42.14:5000/api/admin/blockchain/sync-status
```

**注意:** BSVノードRPC接続が必要。JungleBusのみの構成では500エラーになります。

---

## JungleBus設定

現在のJungleBus設定:

```
JungleBus__Enabled=true
JungleBus__BlockSubscriptionId=d161bec33767024eb18bd90bd0c70c0fd199e8fb468e5cb7564bd8b54333a682
JungleBus__MempoolSubscriptionId=d161bec33767024eb18bd90bd0c70c0fd199e8fb468e5cb7564bd8b54333a682
```

JungleBusは以下を提供:
- ブロックデータのストリーミング受信
- メンプールトランザクションのリアルタイム監視
- コントロールメッセージによる接続状態管理

JungleBusはデータの**受信専用**であり、トランザクションの**送信（ブロードキャスト）は不可**です。

---

## docker-compose.yml 設定

```yaml
services:
  ravendb:
    image: ravendb/ravendb:latest
    ports:
      - "8080:8080"
    environment:
      - RAVEN_Setup_Mode=None
      - RAVEN_License_Eula_Accepted=true
      - RAVEN_Security_UnsecuredAccessAllowed=PublicNetwork

  consigliere:
    image: consigliere:local
    ports:
      - "5000:5000"
    environment:
      - ASPNETCORE_HTTP_PORTS=5000
      - RavenDb__Urls__0=http://ravendb:8080
      - RavenDb__DbName=Consigliere
      - Network=Mainnet
      - ScanMempoolOnStart=false
      - BlockCountToScanOnStart=0
      - JungleBus__Enabled=true
      - JungleBus__BlockSubscriptionId=<subscription_id>
      - JungleBus__MempoolSubscriptionId=<subscription_id>
    depends_on:
      - ravendb
```

---

## 月額コスト

| リソース | 月額 (USD) |
|----------|-----------|
| EC2 t3.small (2 vCPU, 2GB) | ~$15.18 |
| EBS gp3 20GB | ~$1.60 |
| データ転送 ~50GB | ~$4.50 |
| **合計** | **~$21.28** |

---

---

# 秒間100万件送金テスト: パフォーマンス分析

## 1. 現在の構成で秒間100万件の送金は可能か？

### 結論: 不可能

現在の構成では秒間100万件のブロードキャストは**不可能**です。以下がその理由です。

### 理由

#### A. ブロードキャストにBSVノードRPC接続が必須
現在の構成はJungleBusのみであり、**トランザクションのブロードキャスト機能が動作しません。**

Consigliereのブロードキャスト処理フロー:
```
API Request → BroadcastService → BitcoindService → IRpcClient.SendRawTransaction → BSVノード
```

`BroadcastService` は内部で `BitcoindService.Broadcast()` を呼び出し、これは `IRpcClient.SendRawTransaction(hex)` を実行します。IRpcClientはBSVノードのRPCエンドポイントへの接続を必要とします。JungleBusはデータの受信（ブロック・メンプール監視）専用であり、送信（ブロードキャスト）機能はありません。

#### B. APIは1リクエスト=1トランザクション
```
POST /api/tx/broadcast/{raw}
```
バッチブロードキャストエンドポイントが存在しないため、100万件のブロードキャストには100万回のHTTPリクエストが必要です。

#### C. 1ブロードキャストあたり2回のRavenDB書き込み
```csharp
// BroadcastService.cs
await documentStore.AddOrUpdateEntity(broadcastAttempt);  // 1回目: 記録作成
// ... BSVノードにブロードキャスト ...
await documentStore.UpdateEntity(broadcastAttempt);        // 2回目: 結果更新
```

#### D. リトライポリシー
失敗時に10回リトライ（各2秒待機）する設計:
```csharp
Policy.Handle<Exception>().WaitAndRetryAsync(10, _ => TimeSpan.FromSeconds(2));
```

#### E. EC2 t3.small のリソース制限
- 2 vCPU, 2GB RAM
- ネットワーク帯域: 最大5Gbps (バースト)
- RavenDB + Consigliere が同一インスタンスで動作

#### F. BSVネットワーク自体の制限
現在のBSV mainnetの実効スループット: 約5,000〜50,000 tx/sec
(Teranodeにより将来的に1M+ tx/secが目標だが、2026年時点で完全実現していない)

---

## 2. 現在の構成で秒間何件のブロードキャストが可能か？

### 予測: 秒間 50〜200件（BSVノード接続追加後）

| ボトルネック | 予測スループット |
|-------------|----------------|
| BSVノードRPC (SendRawTransaction) | ~500-1,000 tx/sec (単体) |
| RavenDB書き込み (2回/tx) | ~1,000-5,000 writes/sec |
| HTTP API (単一エンドポイント) | ~500-2,000 req/sec |
| EC2 t3.small CPU/メモリ | ~100-300 req/sec (全体制約) |
| **総合予測（現在の構成）** | **~50-200 tx/sec** |

### 内訳

**RPC呼び出し:** BSVノードの `sendrawtransaction` RPCは1回あたり ~1-5ms。ただしConsigliereは同期的に処理するため、並行数がCPUコア数（2）に制限される。

**RavenDB:** 書き込み性能は約1,000-5,000 ops/sec（2GB RAMの制約下）。1トランザクションあたり2回書き込みがあるため、DB側のボトルネックは500-2,500 tx/sec。

**APIサーバー:** ASP.NET Coreの単一インスタンスで ~2,000-5,000 req/sec 処理可能だが、t3.smallの2 vCPUでは実質500-2,000程度。

**ネットワーク:** 1トランザクション平均250バイトとして、200 tx/sec = 50KB/sec（ネットワークはボトルネックにならない）。

**総合:** 最も遅いコンポーネント（CPU + 同期処理）により、**秒間50〜200件**が現実的な上限。

---

## 3. 秒間100万件を実現するためのソリューション

### アーキテクチャ全体像

```
                        ┌─────────────────────────┐
                        │   Load Balancer (ALB)    │
                        │   1M req/sec 受付        │
                        └────────┬────────────────┘
                                 │
                    ┌────────────┼────────────────┐
                    │            │                 │
              ┌─────▼────┐ ┌────▼─────┐    ┌─────▼────┐
              │ Worker 1  │ │ Worker 2  │... │ Worker N  │
              │ (ECS/EC2) │ │ (ECS/EC2) │    │ (ECS/EC2) │
              └─────┬─────┘ └─────┬─────┘    └─────┬─────┘
                    │             │                  │
              ┌─────▼─────────────▼──────────────────▼─────┐
              │         Message Queue (SQS/Kafka)           │
              │         バッファリング & バッチ処理           │
              └─────────────────┬───────────────────────────┘
                                │
                    ┌───────────┼───────────────┐
                    │           │               │
              ┌─────▼────┐ ┌───▼──────┐  ┌────▼─────┐
              │ BSV Node │ │ BSV Node │  │ BSV Node │
              │ Cluster 1│ │ Cluster 2│  │ Cluster N│
              │ (MAPI)   │ │ (MAPI)   │  │ (MAPI)   │
              └──────────┘ └──────────┘  └──────────┘
```

### ソリューション A: Consigliereを使わず直接ブロードキャスト

**推奨度: 高**

秒間100万件のブロードキャストが目的であれば、Consigliereはインデクサー（受信・追跡）であり、大量送信には不向きです。ブロードキャスト専用のアーキテクチャを構築すべきです。

| コンポーネント | 役割 | 推奨サービス |
|-------------|------|------------|
| トランザクション生成 | 署名済みtxの作成 | カスタムアプリ |
| キューイング | 非同期バッファリング | Amazon SQS / Apache Kafka |
| ブロードキャスト | BSVネットワークへの送信 | MAPI / ARC (TAAL) / GorillaPool |
| インデックス・確認 | 送信結果の追跡 | Consigliere (JungleBus経由) |

**ARC (TAAL):** BSVトランザクションブロードキャスト専用API。バッチ送信対応。
```
POST https://arc.taal.com/v1/tx
POST https://arc.taal.com/v1/txs  (バッチ)
```

**MAPI (Merchant API):** トランザクション送信・手数料見積もり・ステータス確認を提供。

### ソリューション B: 水平スケーリング

**推奨度: 中**

Consigliereを使い続ける場合のスケーリング戦略:

| 対策 | 効果 | コスト |
|------|------|--------|
| EC2スケールアップ (c6i.8xlarge) | ~2,000 tx/sec | ~$800/月 |
| 複数インスタンス + ALB (×100台) | ~20,000 tx/sec | ~$15,000/月 |
| バッチブロードキャストAPI追加（コード改修） | 10-50x改善 | 開発コスト |
| RavenDB書き込みの非同期化（コード改修） | 2-5x改善 | 開発コスト |
| BSVノードクラスタ (×50台) | ノードRPCボトルネック解消 | ~$25,000/月 |

**100万tx/secをConsigliereで実現する場合の推定コスト: $50,000〜$100,000/月+大規模コード改修**

### ソリューション C: 推奨アーキテクチャ（実現可能な最適解）

```
[Webアプリ] → [Amazon SQS FIFO / Kafka]
                    ↓
            [Lambda / ECS Workers ×1000]
                    ↓
            [ARC API (TAAL) バッチ送信]
                    ↓
            [BSVネットワーク]
                    ↓
            [JungleBus → Consigliere]  ← 結果のインデックス・確認用
```

| コンポーネント | スペック | 月額コスト |
|-------------|---------|-----------|
| Amazon SQS | 100M メッセージ/日 | ~$40 |
| ECS Fargate Workers (×100) | 各4 vCPU, 8GB | ~$15,000 |
| ARC API (TAAL) | 1M tx/sec | 要問合せ (推定$5,000-20,000) |
| Consigliere (結果確認用) | t3.small | ~$21 |
| ALB | ロードバランサー | ~$20 |
| **合計** | | **~$20,000-35,000/月** |

### 重要な考慮事項

1. **BSVネットワークの実効スループット:** 2026年現在、BSV Teranodeの完全展開状況によりネットワーク自体が1M tx/secを処理できるかは要確認。
2. **トランザクション手数料:** 100万tx/sec × 60秒 = 6,000万tx。最小手数料0.05 sat/byte、平均250byteとして、6,000万 × 12.5 sat = 7.5億sat = 7.5 BSV/分。
3. **UTXO管理:** 100万tx/secの送金には事前に十分な数のUTXOを分割・準備する必要がある（UTXO splitting）。
4. **Consigliereの役割:** 大量ブロードキャストではConsigliereは送信側ではなく、**受信・インデックス・確認側**として使うのが適切。

### まとめ

| 項目 | 回答 |
|------|------|
| 現在の構成で1M tx/sec可能か？ | **不可能**（ブロードキャスト自体が動作しない + 構造的制約） |
| 現在の構成の最大スループット | **~50-200 tx/sec**（BSVノード追加後） |
| 1M tx/sec実現のソリューション | ARC/MAPI直接送信 + SQS/Kafka + 分散Workers。Consigliereはインデックス・確認専用で併用 |
