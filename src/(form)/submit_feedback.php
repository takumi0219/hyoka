<?php
// =================================================================
// 1. CORS設定 (OPTIONSリクエスト対応を強化)
// =================================================================
// 許可するオリジン
header("Access-Control-Allow-Origin: http://localhost:5173"); 
// 許可するメソッド
header("Access-Control-Allow-Methods: POST, OPTIONS");
// 許可するヘッダー (特にContent-Typeは必須)
header("Access-Control-Allow-Headers: Content-Type");
// プリフライト結果をキャッシュする時間 (オプション)
header("Access-Control-Max-Age: 86400");
// POSTリクエスト用のContent-Type設定は、OPTIONSリクエストの後に移動します
// header("Content-Type: application/json"); 


// OPTIONSリクエスト（CORSプリフライト）の場合は、ヘッダーを設定して終了
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // ログで200が返されていることを確認しましたが、CORSの標準は204です。
    // サーバーの挙動を考慮し、ここでは明示的に200で終了させてみます。
    http_response_code(200); 
    exit(0);
}

// OPTIONSリクエストではない場合（POSTの場合）のみJSONヘッダーを設定
header("Content-Type: application/json");

// =================================================================
// 2. 環境変数と接続文字列の設定
// [変更なし]
// =================================================================
// 🚨🚨🚨 重要: この行をご自身のSupabase接続文字列に置き換えてください 🚨🚨🚨
// 例: "postgres://user:password@host:port/database"
$database_url = "YOUR_SUPABASE_DATABASE_URL_HERE"; 

// PHPのpg_connect関数が解釈できる形式に変換
$db_conn = pg_connect($database_url);
// ... [後続のコードは省略]

if (!$db_conn) {
    http_response_code(500);
    error_log("❌ データベース接続失敗: " . pg_last_error());
    echo json_encode(["message" => "❌ データベース接続失敗。PHPサーバーのログを確認してください。"]);
    exit;
}

// =================================================================
// 3. POSTデータの受信とバリデーション
// =================================================================
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// POSTリクエストだがJSONデータがない場合のエラー処理
if (json_last_error() !== JSON_ERROR_NONE || empty($data)) {
    http_response_code(400);
    pg_close($db_conn);
    echo json_encode(["message" => "❌ JSONデータの解析エラー、またはデータが空です。"]);
    exit;
}

$booth_id = $data['booth_id'] ?? null;
// praise_ratioとadvice_ratioは文字列として送られてくるためfloatvalで変換
$praise_ratio = floatval($data['praise_ratio'] ?? 0);
$advice_ratio = floatval($data['advice_ratio'] ?? 0);
$raw_text = $data['raw_text'] ?? null;
$visitor_attribute = $data['visitor_attribute'] ?? null;

if (!$booth_id || !$raw_text || !$visitor_attribute) {
    http_response_code(400);
    pg_close($db_conn);
    echo json_encode(["message" => "❌ 必須フィールドが不足しています。"]);
    exit;
}

// =================================================================
// 4. SQL実行 (INSERT)
// =================================================================
$sql = <<<SQL
    INSERT INTO public."sessions"
    ("booth_id", "praise_ratio", "advice_ratio", "raw_text", "visitor_attribute", "summariy_text", "is_processed") 
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
SQL;

// パラメータを配列として準備
$params = [
    $booth_id, 
    $praise_ratio, 
    $advice_ratio, 
    $raw_text, 
    $visitor_attribute,
    "",      // summariy_text
    'f'      // is_processed (PostgreSQLのboolean 'false')
];

$result = pg_query_params($db_conn, $sql, $params);

if ($result) {
    // 挿入成功
    $inserted_row = pg_fetch_assoc($result);
    $inserted_id = $inserted_row['id'] ?? 'N/A';
    
    pg_close($db_conn);
    
    http_response_code(201);
    echo json_encode([
        "message" => "✅ PHP経由で保存成功。", 
        "status" => "success", 
        "inserted_id" => $inserted_id
    ]);
} else {
    // 挿入失敗
    $error_message = pg_last_error($db_conn);
    
    pg_close($db_conn);
    
    http_response_code(500);
    echo json_encode([
        "message" => "❌ データベースへの保存中にエラーが発生しました。", 
        "error_detail" => $error_message
    ]);
}

?>