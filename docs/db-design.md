# Gyomu Navi — データベース設計書 (Phase 1)

本ドキュメントは、現状 `src/lib/mockData.ts` で完結している全機能を、本番運用に耐える PostgreSQL スキーマへ移行するための設計仕様です。実装は本書をレビュー後に着手します。

---

## 1. 前提と決定事項

| 項目 | 決定 |
|---|---|
| テナント | **シングルテナント**。将来マルチ化する場合は再設計が必要 |
| 規模感 | 数百人 / 複数現場 (中規模)。テーブルパーティションは現段階では切らず、後で切れる構造にする |
| ID | **全テーブル UUID** (`gen_random_uuid()`)。URL 露出を許容、外部結合に強い |
| 文字コード / 照合順序 | UTF-8 / `C` または `ja-JP-x-icu` (DB 作成時に決定) |
| タイムスタンプ | 全て `TIMESTAMPTZ`。アプリ側は ISO8601 で扱う |
| 物理削除 / 論理削除 | マスタ系は `deleted_at TIMESTAMPTZ` で論理削除。トランザクション系 (勤怠/報告) は物理削除しない (履歴) |
| ロール | **admin / manager / employee** の 3 階層 |
| 遅刻判定 | Phase 1 では実装しない。`attendance_logs.status` は `working / done / absent` の 3 値のみ |
| 画像アップロード | Vercel Blob。`business_reports.image_url` 列に URL を保存 |
| 既読管理 | `notice_reads` 中間テーブル |

### 1.1 権限スコープ (重要)

```
admin    : 全データ参照・更新可
manager  : 自部門に所属する staffs と、その staffs が配属されている sites 配下のデータのみ
employee : 自分 (users.staff_profile_id が指す staffs) のデータのみ
           + 自配属現場の board_posts (掲示板)
           + 自身宛/自部門宛/全体宛 の notices
```

manager のスコープは「部門単位」で切ります。`users.department_id`(後述) が manager の管轄部門で、そこに所属する `staffs.department_id = users.department_id` の全員が見える範囲です。

---

## 2. ER 概要

```
                  ┌────────────────┐
                  │  departments   │  部門マスタ
                  └───────┬────────┘
                          │ 1
                          │
        ┌─────────────────┴────────┐
        │ N                        │ 0..N (manager scope)
   ┌────┴────┐               ┌─────┴─────┐
   │ staffs  │◄──────────────│   users   │ (auth) ───┐
   └────┬────┘ staff_profile  └─────┬─────┘            │ N
        │ 1                          │                  │
        │                            │ 1               ▼
        │                            │            ┌────────┐
        │ N                          │ N          │ notice │
        │                       ┌────┴────────┐   │ _reads │
        │                       │   notices   │◄──┴────────┘
        │                       └─────────────┘
        │
        ▼ N           N    1    ┌──────────────────┐
   ┌──────────────────────┐     │ client_companies │ 顧客企業マスタ
   │  staff_site_assigns  │     └────────┬─────────┘
   │  (M:N: staff×site)   │              │ 1
   └──────────┬───────────┘              │
              │ N                        │ N
              ▼                     ┌────┴────┐
         ┌────────┐                 │  sites  │ 現場マスタ
         │ sites  │◄────────────────┴─────────┘
         └────┬───┘
              │ 1
              ▼ N
       ┌────────────────────┐
       │  attendance_logs   │ 勤怠ログ
       │  business_reports  │ 業務報告 (image_url, business_type FK)
       │  board_posts       │ 現場掲示板
       └────────────────────┘
                │ N
                ▼ 1
        ┌────────────────┐
        │ business_types │ (clientId に紐づく業務種別)
        └────────────────┘
```

主要な多対多 (M:N):
- **staff_site_assigns** : 1 スタッフが複数現場、1 現場に複数スタッフ。現行 mockData の `Staff.siteIds[]` を正規化したもの。
- **notice_reads** : 既読管理。

---

## 3. テーブル定義

### 3.1 マスタ系

#### departments — 部門
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK, default `gen_random_uuid()` | |
| name | VARCHAR(100) | NOT NULL UNIQUE (deleted_at IS NULL の範囲で) | "清掃部門" など |
| created_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| updated_at | TIMESTAMPTZ | NOT NULL default `now()` | トリガで自動更新 |
| deleted_at | TIMESTAMPTZ | NULL | 論理削除 |

#### client_companies — 顧客企業 (子会社)
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(255) | NOT NULL | "株式会社ABC不動産" |
| code | VARCHAR(20) | NOT NULL UNIQUE (deleted_at IS NULL) | "ABC" — 表示・並び替え用 |
| created_at / updated_at / deleted_at | | | |

#### sites — 現場
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| client_id | UUID | NOT NULL REFERENCES client_companies(id) | |
| name | VARCHAR(255) | NOT NULL | "新宿パークタワー" |
| latitude | NUMERIC(9,6) | NOT NULL | GPS 中心 |
| longitude | NUMERIC(9,6) | NOT NULL | |
| radius_m | INTEGER | NOT NULL DEFAULT 100 CHECK (radius_m > 0) | GPS 判定半径 |
| created_at / updated_at / deleted_at | | | |

インデックス: `idx_sites_client_id ON sites(client_id) WHERE deleted_at IS NULL`

#### business_types — 業務種別 (顧客ごとに定義される業務)
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| client_id | UUID | NOT NULL REFERENCES client_companies(id) | |
| name | VARCHAR(100) | NOT NULL | "日常清掃" |
| created_at / updated_at / deleted_at | | | |
| UNIQUE (client_id, name) WHERE deleted_at IS NULL | | | 同一顧客内で重複禁止 |

#### staffs — スタッフプロフィール (勤務者の属性。auth とは分離)
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| department_id | UUID | NOT NULL REFERENCES departments(id) | |
| name | VARCHAR(100) | NOT NULL | "佐藤 花子" |
| hourly_rate | INTEGER | NOT NULL CHECK (hourly_rate >= 0) | 円 |
| created_at / updated_at / deleted_at | | | |

インデックス: `idx_staffs_department_id ON staffs(department_id) WHERE deleted_at IS NULL`

> **設計判断**: mockData の `Staff.role: "admin"|"staff"` 列は **users 側のロール** と二重定義になるため staffs からは削除します。「人」としての属性は staffs に、「アプリ利用者」としての属性は users に置きます。

#### staff_site_assigns — スタッフと現場の M:N
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| staff_id | UUID | NOT NULL REFERENCES staffs(id) ON DELETE CASCADE | |
| site_id | UUID | NOT NULL REFERENCES sites(id) ON DELETE CASCADE | |
| assigned_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| PRIMARY KEY (staff_id, site_id) | | | |

インデックス: `idx_assigns_site_id ON staff_site_assigns(site_id)` (逆引き用)

### 3.2 認証

#### users — 既存テーブル (改修)

既存:
```sql
id UUID PK
email VARCHAR(255) UNIQUE
password_hash TEXT
display_name VARCHAR(255)
app_role VARCHAR(20)  -- 'admin' | 'employee'
staff_profile_id TEXT -- 'st2' 等の文字列
created_at TIMESTAMPTZ
```

**変更点 (`005_users_link_to_staff.sql`):**

1. `app_role` の CHECK 制約を `'admin' | 'manager' | 'employee'` に拡張
2. `staff_profile_id TEXT` を **削除** し、`staff_id UUID REFERENCES staffs(id) ON DELETE SET NULL` を **追加**
3. manager 用に `department_id UUID REFERENCES departments(id)` を追加 (admin/employee は NULL)
4. `updated_at TIMESTAMPTZ` を追加

整合性ルール (CHECK 制約として表現):
- `app_role = 'employee'` のとき `staff_id IS NOT NULL`
- `app_role = 'manager'` のとき `department_id IS NOT NULL`
- `app_role = 'admin'` のとき両方 NULL

> **移行の互換性**: 既存 seed の `staff_profile_id = 'st2'` は捨てます。新 seed では `staff_id` に新 staffs のレコード UUID を入れます。デモアカウント (`admin@example.com` / `employee@example.com`) のメール・パスワードは維持。

### 3.3 トランザクション系

#### attendance_logs — 勤怠ログ
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| staff_id | UUID | NOT NULL REFERENCES staffs(id) | 過去履歴のため staffs を消しても残す → ON DELETE は RESTRICT |
| site_id | UUID | NOT NULL REFERENCES sites(id) | 同上 |
| work_date | DATE | NOT NULL | JST の日付。`punch_in_at` のタイムゾーン換算で決まる |
| punch_in_at | TIMESTAMPTZ | NOT NULL | |
| punch_out_at | TIMESTAMPTZ | NULL | |
| status | VARCHAR(20) | NOT NULL CHECK (status IN ('working', 'done', 'absent')) | |
| punch_in_lat | NUMERIC(9,6) | NULL | 打刻時 GPS |
| punch_in_lng | NUMERIC(9,6) | NULL | |
| punch_out_lat | NUMERIC(9,6) | NULL | |
| punch_out_lng | NUMERIC(9,6) | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| updated_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| UNIQUE (staff_id, work_date) | | | 1 日 1 レコード (複数現場の掛け持ちは別途要件確認) |

インデックス:
- `idx_attendance_staff_date ON attendance_logs(staff_id, work_date DESC)` — 個人履歴
- `idx_attendance_date ON attendance_logs(work_date DESC)` — 日次集計
- `idx_attendance_site_date ON attendance_logs(site_id, work_date DESC)` — 現場別

> **パーティションの後付け対応**: 現段階で範囲パーティションは切りませんが、`work_date` をパーティションキーに想定した複合 PK が必要になったときのため、`UNIQUE (staff_id, work_date)` を `PRIMARY KEY` には**しない** (id を PK にしておく)。

#### business_reports — 業務報告
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| staff_id | UUID | NOT NULL REFERENCES staffs(id) RESTRICT | |
| site_id | UUID | NOT NULL REFERENCES sites(id) RESTRICT | |
| client_id | UUID | NOT NULL REFERENCES client_companies(id) RESTRICT | site から導出可能だが結合の都合で持つ (denormalize) |
| business_type_id | UUID | NOT NULL REFERENCES business_types(id) RESTRICT | |
| count | INTEGER | NOT NULL CHECK (count >= 0) | 件数 |
| image_url | TEXT | NULL | Vercel Blob URL |
| memo | TEXT | NULL | |
| reported_at | TIMESTAMPTZ | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| updated_at | TIMESTAMPTZ | NOT NULL default `now()` | |

インデックス:
- `idx_reports_reported_at ON business_reports(reported_at DESC)` — 日付フィルタ
- `idx_reports_staff_reported ON business_reports(staff_id, reported_at DESC)`
- `idx_reports_client_reported ON business_reports(client_id, reported_at DESC)`
- `idx_reports_site_reported ON business_reports(site_id, reported_at DESC)`

> **denormalize の根拠**: ダッシュボードで「顧客別売上集計」を高頻度で叩くため、毎回 sites を JOIN すると重い。`client_id` は site から自動で埋める (アプリ層 or トリガで)。

### 3.4 通知・掲示板

#### notices — お知らせ
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| from_user_id | UUID | NOT NULL REFERENCES users(id) RESTRICT | 発信者 (users 側) |
| target_type | VARCHAR(20) | NOT NULL CHECK (target_type IN ('all', 'department', 'individual')) | |
| target_department_id | UUID | NULL REFERENCES departments(id) | target_type='department' のとき NOT NULL |
| target_user_id | UUID | NULL REFERENCES users(id) | target_type='individual' のとき NOT NULL |
| client_id | UUID | NULL REFERENCES client_companies(id) | 子会社絞り込み (NULL = 全子会社) |
| title | VARCHAR(255) | NOT NULL | |
| body | TEXT | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| updated_at | TIMESTAMPTZ | NOT NULL default `now()` | |

整合性 CHECK 制約:
- `target_type='all'` のとき `target_department_id IS NULL AND target_user_id IS NULL`
- `target_type='department'` のとき `target_department_id IS NOT NULL AND target_user_id IS NULL`
- `target_type='individual'` のとき `target_user_id IS NOT NULL AND target_department_id IS NULL`

インデックス: `idx_notices_created ON notices(created_at DESC)`

> mockData の `fromStaffId` は users 側へ。発信者は「アプリ操作者」なので users が自然です。

#### notice_reads — 既読
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| notice_id | UUID | NOT NULL REFERENCES notices(id) ON DELETE CASCADE | |
| user_id | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE | |
| read_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| PRIMARY KEY (notice_id, user_id) | | | |

インデックス: `idx_notice_reads_user ON notice_reads(user_id)` (逆引き未読件数用)

> `notices.total_target` / `read_count` は **持ちません**。`target_type` から動的に算出する。理由: target が変化した場合に整合が崩れるリスクを排除し、SOT を 1 つにするため。算出が重くなった段階でマテビューを足す。

#### board_posts — 現場掲示板
| 列 | 型 | 制約 | 備考 |
|---|---|---|---|
| id | UUID | PK | |
| site_id | UUID | NOT NULL REFERENCES sites(id) ON DELETE CASCADE | |
| author_user_id | UUID | NOT NULL REFERENCES users(id) RESTRICT | |
| title | VARCHAR(255) | NOT NULL | |
| body | TEXT | NOT NULL | |
| pinned | BOOLEAN | NOT NULL DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | NOT NULL default `now()` | |
| updated_at | TIMESTAMPTZ | NOT NULL default `now()` | |

インデックス: `idx_board_site_pinned_created ON board_posts(site_id, pinned DESC, created_at DESC)`

---

## 4. 共通仕様

### 4.1 updated_at の自動更新

全テーブル共通でトリガ関数を 1 つ作って各テーブルに適用:

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```

`003_migration_tracking.sql` でこの関数を作成し、以降のマイグレーションで各テーブルに `BEFORE UPDATE` トリガを張る。

### 4.2 マイグレーション管理 (`schema_migrations` テーブル)

```sql
CREATE TABLE schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`migrate.ts` は `src/lib/db/migrations/` 配下の `.sql` をファイル名昇順で走査し、`schema_migrations` に無いものだけを 1 つのトランザクションで適用 → 成功したら同テーブルに記録。

> **既存ファイルの扱い**: 現状の `schema.sql` (users 作成) と `002_user_roles.sql` (app_role/staff_profile_id 追加) は **削除せず**、`migrations/001_users.sql` / `migrations/002_user_roles.sql` にリネームして組み込みます。既存 DB に対しては `INSERT INTO schema_migrations ('001_users.sql'), ('002_user_roles.sql')` を冪等に流すことで「適用済み」として記録します (バックフィル)。

### 4.3 タイムゾーン

- アプリ → DB: ISO8601 文字列 / `TIMESTAMPTZ`
- `attendance_logs.work_date` は **JST 基準の日付** とする。pg 側は `(punch_in_at AT TIME ZONE 'Asia/Tokyo')::date` を式インデックスにする選択もあるが、Phase 1 ではアプリ層で計算して `work_date` に格納します。

### 4.4 削除ポリシー

- マスタ系 (departments / client_companies / sites / business_types / staffs): `deleted_at` で論理削除。FK 参照側 (attendance_logs など) は `RESTRICT` で守る。
- ユーザー (users): 退職時は `deleted_at` を立てる (列を追加。`005` で追加)。論理削除されたユーザーはログイン不可。
- トランザクション系: 物理削除しない。誤登録の修正は管理画面から「打ち消しレコード」を入れる方針 (Phase 2 以降)。

---

## 5. mockData.ts → 新スキーマ対応表

| mockData の型 / 定数 | 新スキーマ |
|---|---|
| `Staff.id` ("st1", ...) | `staffs.id` (UUID, 新規発番) |
| `Staff.role` | **削除**。users 側で表現 |
| `Staff.hourlyRate` | `staffs.hourly_rate` |
| `Staff.departmentId` | `staffs.department_id` |
| `Staff.siteIds[]` | `staff_site_assigns` 行 |
| `ClientCompany` | `client_companies` |
| `Site` | `sites` |
| `Department` | `departments` |
| `BusinessType` | `business_types` |
| `AttendanceLog.date` / `punchIn` / `punchOut` | `attendance_logs.work_date` / `punch_in_at` / `punch_out_at` (JST の DATE と TIMESTAMPTZ に合成) |
| `AttendanceLog.status` ("出勤中"等) | `attendance_logs.status` ('working'/'done'/'absent') にマッピング。"遅刻" は Phase 1 では `done` に倒す |
| `BusinessReport` | `business_reports` |
| `Notice` | `notices` |
| `notice.readCount` / `totalTarget` | `notice_reads` から動的算出 |
| `BoardPost` | `board_posts` |

---

## 6. ファイル構成 (実装フェーズで作るもの)

```
src/lib/db/
  pool.ts                          (変更なし)
  migrate.ts                       (全面改修: schema_migrations 対応)
  seed.ts                          (全面改修: 新スキーマ + mockData の内容を投入)
  migrations/
    001_users.sql                  (現 schema.sql を移動)
    002_user_roles.sql             (現状のものを移動)
    003_migration_tracking.sql     (schema_migrations + set_updated_at)
    004_master_data.sql            (departments, client_companies, sites, business_types, staffs, staff_site_assigns)
    005_users_link_to_staff.sql    (users 改修: staff_id / department_id / deleted_at / manager ロール / updated_at)
    006_attendance.sql             (attendance_logs)
    007_business_reports.sql       (business_reports)
    008_notices.sql                (notices, notice_reads, board_posts)
```

旧 `src/lib/db/schema.sql` と `002_user_roles.sql` は `migrations/` 配下へ移動し、`migrate.ts` がそれらを未適用 DB に対しては流せるようにします。

---

## 7. 実装フェーズの段取り (Step 2 以降の予定)

| Step | 内容 | 検証方法 |
|---|---|---|
| 2 | マイグレーション 003〜008 を作成、`migrate.ts` 改修、`seed.ts` 改修 | Neon test branch を作り直し → `npm run db:migrate && npm run db:seed` でクリーン投入できる |
| 3a | マスタ系 API (`/api/master/{staffs,sites,clients,departments,business-types}`) | curl + Vitest |
| 3b | 勤怠 API (`/api/attendance/*`) | 同上 |
| 3c | 業務報告 API (`/api/reports/*`) + Vercel Blob 連携 | アップロードは Phase 4 で詳細実装、URL 受け渡しまでを 3c |
| 3d | 通知・掲示板 API (`/api/notices/*`, `/api/board/*`) | 同上 |
| 4 | UI を mockData → TanStack Query + API に置き換え (機能ごと) | 既存画面の動作維持 |
| 5 | `mockData.ts` を完全削除、`employeeScope.ts` を DB クエリベースに書き直し | 型エラー 0、ビルド成功 |

---

## 8. 残課題 / 後続検討

- **シフト管理 / 遅刻判定**: 設計から外した。要件確定後に `shifts` テーブルを追加 (Phase 2)。
- **監査ログ (`audit_logs`)**: 誰が何をいつ変えたかの追跡。Phase 2 で `before / after` を JSONB で持つ専用テーブルを作る想定。
- **画像のアクセス制御**: Vercel Blob の URL はランダム性は高いが推測不能ではない。プライベートアクセスにするか署名付き URL にするかは Phase 3c で決定。
- **メンテナンス**: `VACUUM ANALYZE` の自動化、`pg_stat_statements` の有効化は本番運用開始時に Neon の設定で対応。
