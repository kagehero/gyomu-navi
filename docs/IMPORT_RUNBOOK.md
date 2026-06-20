# 売上マスタ取り込み手順（#2 全部門開放 / #10 表記修正）

クライアント（津川様）から再送された修正版 Excel
`docs/社内システム売上報告階層 (1).xlsx` を取り込み、全部門（カーシェア / レンタカー /
タクシー / 回送 / スケジュール点検 / 法人リテール / その他 / 洗剤販売）と顧客・拠点・
車両リストをマスタへ反映する手順です。

> ⚠️ **注意**: 取り込み (`db:import-sales`) は `business_lines` / `client_companies` /
> `sites` / `business_types` / `vehicles` 等のマスタ表を **TRUNCATE してから再投入**します。
> `users` / `staffs` / `departments`（＝ログイン情報）は保持されますが、**本番DBに対して
> 実行する前に必ずバックアップ**を取得してください。スタッフの担当顧客割当
> (`staff_client_assigns`) 等は再投入により参照先 id が変わるため、取り込み後に
> 再設定が必要になる場合があります。

## 手順

> **取り込みの2段構成**: Excel → `catalog.json` の生成は `xlsx` ライブラリが要るため
> **フロント**側で実施します（ステップ 1–2）。生成済み `catalog.json` を DB へ投入する
> ステップ 3 は **バックエンド**側で実行します（バックエンドの `.env` のDB接続を使うため、
> フロントの `DATABASE_URL` を有効化する必要はありません）。

1. **Excel を所定の場所へ配置**（フロント）
   ビルドスクリプトは `frontend/public/社内システム売上報告階層.xlsx` を参照します
   （ファイル名末尾の `(1)` は付けない）。リポジトリ同梱の補助スクリプトで配置できます:

   ```bash
   cd frontend
   npm run db:stage-catalog     # docs/(1).xlsx → public/社内システム売上報告階層.xlsx
   ```

2. **catalog.json を再生成**（フロント・Excel → JSON）

   ```bash
   npm run db:build-catalog
   ```

   出力に `business_lines: 8` 等のサマリが表示されます。部門数・顧客数を確認してください。
   生成物は `frontend/src/lib/db/sales/catalog.json` です。

3. **DB へ取り込み**（バックエンド・本番DBに対しては事前バックアップ必須）

   ```bash
   cd ../backend
   npm run import:sales
   ```

   バックエンドの `ormconfig.ts`（＝バックエンド `.env`）のDB接続を使い、
   フロントの `catalog.json` を読み込んで投入します。フロントを別配置している等で
   パスが異なる場合は `CATALOG_PATH=/path/to/catalog.json npm run import:sales` で上書きできます。

4. **スタッフの担当割当を再設定**
   取り込みで顧客/部門の id が再採番されるため、マスタ管理画面で各スタッフの
   担当部門・担当顧客を設定し直してください（#5 の一括承認は割当済みのスタッフのみ承認します）。

## バックエンド側スキーマ前提

取り込み先DBには Phase2 スキーマ（マイグレーション 009〜017）が適用済みである必要が
あります。NestJS バックエンドでは:

```bash
cd backend
npm run migration:run
```

これにより bootstrap(001〜008) に加えて 009〜015（売上報告・車両・承認・entry rules・
画像）、016（下書き）、017（派遣人件費）が適用されます。
