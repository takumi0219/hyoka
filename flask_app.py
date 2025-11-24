import os
import json
import psycopg2
import base64
import time # timeモジュールをインポート
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# .envファイルから環境変数をロード
load_dotenv()

# -------------------------------------------------------------
# ★★★ IndentationErrorを修正したデバッグコード ★★★ 
# -------------------------------------------------------------
debug_key = os.environ.get('GEMINI_API_KEY')
if debug_key:
    print(f"✅ DEBUG: GEMINI_API_KEYは読み込まれています (最初の5文字: {debug_key[:5]}...)")
else:
    print("❌ DEBUG: GEMINI_API_KEYは読み込まれていません！")
# -------------------------------------------------------------


app = Flask(__name__)

# Reactアプリ (http://localhost:5173) からのアクセスを許可
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}}) 

def get_db_connection():
    """データベース接続を確立し、接続オブジェクトを返します。"""
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("❌ データベース接続に失敗しました！エラー: DATABASE_URLが設定されていません。")
        return None, "DATABASE_URLが設定されていません。"

    try:
        conn = psycopg2.connect(database_url)
        return conn, None
    except Exception as e:
        error_message = f"データベース接続エラー: {e}"
        print(f"❌ {error_message}")
        return None, error_message

# =========================================================================
# 既存のエンドポイント: GET /api/feedback/<email> (変更なし)
# =========================================================================
@app.route('/api/feedback/<email>', methods=['GET'])
def get_feedback_by_email(email):
    """
    学生のメールアドレス（students.email）を起点として、所属チームのブースIDに紐づく
    フィードバックデータ（sessions）をデータベースから取得します。
    """
    search_email = email.lower().strip() 

    print(f"✅ Route matched! Processing GET request for student email: {search_email}") 
    
    conn, db_error = get_db_connection()
    if db_error:
        return jsonify({"message": "❌ サーバー側のデータベース接続エラー", "error_detail": db_error}), 500
    
    cursor = conn.cursor()
    
    try:
        sql = """
            SELECT 
                s.booth_id, 
                s.raw_text, 
                s.summary_text, 
                s.is_processed,
                t.team_name,
                t.email
            FROM 
                public.sessions s
            INNER JOIN 
                public.students t ON TRIM(LOWER(s.booth_id)) = TRIM(LOWER(t.booth_id))
            WHERE 
                TRIM(LOWER(t.email)) = %s -- studentsテーブルのメールアドレスでフィルタ
            ORDER BY 
                s.id DESC 
            LIMIT 1;
        """
        
        cursor.execute(sql, (search_email,))
        result = cursor.fetchone()
        
        if result:
            booth_id, raw_text, summary_text, is_processed, team_name, student_email = result
            
            score = 85 if is_processed else 50 
            
            response_data = {
                "team_name": team_name,
                "booth_id": booth_id,
                "score": score,
                "comments": [
                    "取得したraw_text: " + raw_text[:50] + ("..." if len(raw_text) > 50 else ""),
                    "サマリー: " + (summary_text if summary_text else "サマリーテキストはまだ生成されていません。"),
                    f"データ処理ステータス: {'完了' if is_processed else '未処理'}",
                    f"学生メール: {student_email}"
                ]
            }
            
            return jsonify(response_data), 200
        else:
            print(f"⚠️ No data found for student email: {search_email}. Returning 404.")
            return jsonify({
                "message": f"まだプレゼンテーションを行っていないので、データがありません。プレゼンテーションを行い、フィードバックを収集してください。",
                "score": None 
            }), 404
            
    except psycopg2.Error as db_err:
        conn.rollback()
        error_detail = f"データベース検索エラー: {db_err.pgerror}"
        print(f"❌ {error_detail}")
        return jsonify({
            "message": "❌ データベース検索中にエラーが発生しました。",
            "error_detail": error_detail
        }), 500
        
    except Exception as e:
        conn.rollback()
        error_detail = f"予期せぬサーバーエラー: {e}"
        print(f"❌ {error_detail}")
        return jsonify({
            "message": "❌ 予期せぬサーバーエラーが発生しました。",
            "error_detail": error_detail
        }), 500
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# -------------------------------------------------------------
# Gemini API呼び出し関数
# -------------------------------------------------------------
# 🚨 実際には、'requests'ライブラリを使ったHTTP POSTリクエストが必要です。
# ここでは、そのロジックを簡潔に示し、結果をシミュレートします。
def call_gemini_api_for_stt_and_summary(base64_audio_data, prompt, mime_type):
    """
    Base64エンコードされた音声データを受け取り、Gemini APIを呼び出して
    STT（音声認識）と要約を同時に行います。
    
    注: この関数は、実際のAPIコールではなく、ロジックのプレースホルダーです。
    """
    print(f"🚀 Gemini APIに音声データ ({len(base64_audio_data)} bytes) を送信中...")
    
    # 実際はここでrequests.postを使ってAPIを叩く
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_api_key:
        print("❌ GEMINI_API_KEYが設定されていません。STT/要約をスキップします。")
        return {
            "stt_text": "【STTエラー: APIキーが設定されていません。】",
            "summary": "要約なし"
        }

    # APIコールロジックのシミュレーション（時間のかかる処理を模倣）
    # 実際のGemini APIコール実装例 (要requestsライブラリ):
    # import requests
    # API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent"
    # headers = {'Content-Type': 'application/json'}
    # payload = {
    #     "contents": [
    #         {"parts": [{"text": prompt}]},
    #         {"parts": [{"inlineData": {"mimeType": mime_type, "data": base64_audio_data}}]}
    #     ],
    #     "config": {"systemInstruction": {"parts": [{"text": "You are a helpful assistant."}]}}
    # }
    # response = requests.post(f"{API_URL}?key={gemini_api_key}", headers=headers, json=payload)
    # result = response.json()
    # ... 結果のパースとエラー処理 ...
    
    time.sleep(3) 

    # 応答の構造をシミュレーション
    simulated_stt_text = (
        "「皆さん、このブースのデモは非常に革新的でした。特に、AIの応答速度が以前のバージョンより大幅に向上しているのを感じました。"
        "しかし、インターフェースの色使いが少し暗く、もう少し明るいトーンにすると、来場者の注目を集めやすいでしょう。全体的には素晴らしい進化です。」"
    )
    simulated_summary = "AI応答速度の向上は評価されたが、インターフェースの色使いを明るくする改善の提案があった。"

    return {
        "stt_text": simulated_stt_text,
        "summary": simulated_summary
    }

# -------------------------------------------------------------
# 新規エンドポイント: POST /api/process_audio
# -------------------------------------------------------------
@app.route('/api/process_audio', methods=['POST'])
def process_audio():
    """
    クライアントから送られたBase64エンコードのPCMオーディオデータを受け取り、
    Gemini APIでテキスト化と要約を実行します。
    """
    try:
        data = request.json
    except Exception as e:
        return jsonify({"message": "❌ 無効なJSONデータ", "error_detail": str(e)}), 400

    base64_audio = data.get('audio_data')
    mime_type = data.get('mime_type')
    booth_id = data.get('booth_id')
    
    if not base64_audio or not mime_type or not booth_id:
        return jsonify({"message": "❌ 必須データ（audio_data, mime_type, booth_id）が不足しています"}), 400

    # 1. Gemini API呼び出し用のプロンプトを作成
    system_prompt = (
        f"あなたはプロのフィードバックアナリストです。以下の音声を正確にテキスト化（STT）し、"
        f"次に、そのテキストの内容を元に、ブースID {booth_id} に対する評価サマリー（良かった点と改善点）を"
        f"最大30文字で簡潔にまとめてください。"
    )
    
    try:
        # 2. Gemini APIを呼び出し（ここではシミュレーション）
        gemini_result = call_gemini_api_for_stt_and_summary(
            base64_audio, 
            system_prompt, 
            mime_type
        )
        
        stt_text = gemini_result["stt_text"]
        summary_text = gemini_result["summary"]

        return jsonify({
            "message": "✅ 音声処理成功",
            "stt_text": stt_text,
            "summary_text": summary_text
        }), 200

    except Exception as e:
        error_detail = f"Gemini API呼び出しまたは処理中のエラー: {e}"
        print(f"❌ {error_detail}")
        return jsonify({
            "message": "❌ サーバーでの音声処理に失敗しました。",
            "error_detail": error_detail
        }), 500

# =========================================================================
# 既存のエンドポイント: POST /api/submit_feedback (変更なし)
# =========================================================================
@app.route('/api/submit_feedback', methods=['POST'])
def submit_feedback():
    """クライアントから受け取った評価データをSupabaseに挿入します。"""
    
    conn, db_error = get_db_connection()
    if db_error:
        return jsonify({"message": "❌ サーバー側のデータベース接続エラー", "error_detail": db_error}), 500

    try:
        data = request.json
    except Exception as e:
        conn.close()
        return jsonify({"message": "❌ 無効なJSONデータ", "error_detail": str(e)}), 400

    if not data:
        conn.close()
        return jsonify({"message": "❌ リクエストボディが空です"}), 400

    booth_id = data.get('booth_id')
    raw_text = data.get('raw_text')
    visitor_attribute = data.get('visitor_attribute')
    
    try:
        praise_ratio = float(data.get('praise_ratio', 0))
        advice_ratio = float(data.get('advice_ratio', 0))
    except ValueError:
        conn.close()
        return jsonify({"message": "❌ 比率データが無効です", "error_detail": "praise_ratio/advice_ratioは数値である必要があります"}), 400

    if not booth_id or not raw_text or not visitor_attribute:
        conn.close()
        return jsonify({"message": "❌ 必須フィールドが不足しています"}), 400

    cursor = conn.cursor()
    inserted_id = None
    
    try:
        sql = """
            INSERT INTO public.sessions
            (booth_id, praise_ratio, advice_ratio, raw_text, visitor_attribute, summary_text, is_processed) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
        """
        
        # 挿入時にメールアドレスとbooth_idを小文字化して保存する（検索効率のため）
        params = (
            booth_id.lower().strip(), 
            praise_ratio, 
            advice_ratio, 
            raw_text, 
            visitor_attribute.lower().strip(), # 訪問者のメール/属性として保存
            "",  
            False 
        )
        
        cursor.execute(sql, params)
        
        inserted_id = cursor.fetchone()[0]
        
        conn.commit()
        
        return jsonify({
            "message": "✅ Supabaseへのデータ挿入に成功しました。", 
            "status": "success",
            "inserted_id": inserted_id
        }), 201

    except psycopg2.Error as db_err:
        conn.rollback()
        error_detail = f"データベースエラー: {db_err.pgerror}"
        print(f"❌ {error_detail}")
        return jsonify({
            "message": "❌ データベースへの挿入中にエラーが発生しました。",
            "error_detail": error_detail
        }), 500
        
    except Exception as e:
        conn.rollback()
        error_detail = f"予期せぬサーバーエラー: {e}"
        print(f"❌ {error_detail}")
        return jsonify({
            "message": "❌ 予期せぬサーバーエラーが発生しました。",
            "error_detail": error_detail
        }), 500
        
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    # 接続テストと実行
    test_conn, test_error = get_db_connection()
    if test_conn:
        print("✅ 起動前にデータベース接続テストに成功しました。")
        test_conn.close()
    else:
        print(f"⚠️ データベース接続テストに失敗しました。{test_error}")
        print("⚠️ .envファイルに正しいDATABASE_URLが設定されているか確認してください。")
        
    app.run(port=5000, debug=True)