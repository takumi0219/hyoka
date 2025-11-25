import os
import json
import psycopg2
import base64
import requests 
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# .envファイルから環境変数をロード
load_dotenv()

# -------------------------------------------------------------
# デバッグコード
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
        # 接続タイムアウトを設定
        conn = psycopg2.connect(database_url, connect_timeout=5)
        return conn, None
    except Exception as e:
        error_message = f"データベース接続エラー: {e}"
        print(f"❌ {error_message}")
        return None, error_message

# =========================================================================
# 既存のエンドポイント: GET /api/feedback/<email> (全件取得と属性の追加)
# =========================================================================
@app.route('/api/feedback/<email>', methods=['GET'])
def get_feedback_by_email(email):
    """
    学生のメールアドレス（students.email）を起点として、所属チームのブースIDに紐づく
    フィードバックデータ（sessions）をデータベースから**全件**取得します。
    また、全チームの総数とチームメンバーリストも同時に取得します。
    """
    search_email = email.lower().strip() 

    print(f"✅ Route matched! Processing GET request for student email: {search_email}") 
    
    conn, db_error = get_db_connection()
    if db_error:
        return jsonify({"message": "❌ サーバー側のデータベース接続エラー", "error_detail": db_error}), 500
    
    cursor = conn.cursor()
    
    try:
        # 1. チーム名とブースIDを学生テーブルから取得
        team_info_sql = """
            SELECT 
                t.team_name,
                t.booth_id
            FROM 
                public.students t
            WHERE 
                TRIM(LOWER(t.email)) = %s;
        """
        cursor.execute(team_info_sql, (search_email,))
        team_result = cursor.fetchone()

        if not team_result:
            print(f"⚠️ No student found for email: {search_email}. Returning 404.")
            return jsonify({
                "message": f"メールアドレス {search_email} に紐づく学生情報が見つかりません。",
                "score": None
            }), 404
            
        team_name, booth_id = team_result
        
        # 2. ★★★ 該当チームのメンバーリストを取得 ★★★
        # team_name でフィルタリングし、全メンバーを取得
        team_members_sql = """
            SELECT 
                s.full_name, 
                s.email
            FROM 
                public.students s
            WHERE 
                TRIM(LOWER(s.team_name)) = %s;
        """
        # ★★★ 修正: team_name を引数として渡す ★★★
        cursor.execute(team_members_sql, (team_name.lower().strip(),))
        member_results = cursor.fetchall()

        team_members_list = []
        for name, member_email in member_results:
             # 現在ログインしているユーザーを特定するために、メールアドレスを保持
            is_current_user = (member_email.lower().strip() == search_email)
            team_members_list.append({
                "name": name,
                "email": member_email,
                "is_current_user": is_current_user
            })

        # 3. 全チームの総数を取得
        total_teams_sql = "SELECT COUNT(DISTINCT team_name) FROM public.students;"
        cursor.execute(total_teams_sql)
        total_teams_count = cursor.fetchone()[0] if cursor.rowcount else 0

        # 4. 該当ブースIDの全セッションデータを取得 (visitor_attributeを追加)
        sessions_sql = """
            SELECT 
                s.raw_text, 
                s.summary_text, 
                s.is_processed,
                s.visitor_attribute,
                s.praise_ratio, 
                s.advice_ratio
            FROM 
                public.sessions s
            WHERE 
                TRIM(LOWER(s.booth_id)) = %s 
            ORDER BY 
                s.id DESC;
        """
        
        cursor.execute(sessions_sql, (booth_id.lower().strip(),))
        session_results = cursor.fetchall()

        feedback_list = []
        total_score = 0
        
        for raw_text, summary_text, is_processed, visitor_attribute, praise_ratio, advice_ratio in session_results:
            # スコアは、is_processedに応じて暫定的に算出
            # （本来はAI処理で算出すべきだが、現状は仮のロジック）
            score = 85 if is_processed else 50 
            total_score += score
            
            feedback_list.append({
                "raw_text": raw_text,
                "summary_text": summary_text,
                "visitor_attribute": visitor_attribute,
                "score": score,
                "is_processed": is_processed,
                "praise_ratio": praise_ratio,
                "advice_ratio": advice_ratio
            })

        average_score = round(total_score / len(feedback_list)) if feedback_list else None
        
        response_data = {
            "team_name": team_name,
            "booth_id": booth_id,
            "total_count": len(feedback_list),
            "total_teams_count": total_teams_count, 
            "average_score": average_score, # 全フィードバックの平均スコア
            "team_members": team_members_list, # ★★★ ここで追加 ★★★
            "feedbacks": feedback_list # 全フィードバックのリスト
        }
        
        if not feedback_list:
             print(f"⚠️ No feedback data found for team booth: {booth_id}. Returning 200 (No data).")
             # データがない場合も200で返す（学生情報は取得できているため）
             return jsonify({
                "message": f"まだフィードバックがありません。ブースID {booth_id} のフィードバックを収集してください。",
                "team_name": team_name,
                "booth_id": booth_id,
                "total_count": 0,
                "total_teams_count": total_teams_count, 
                "average_score": None,
                "team_members": team_members_list, # ★★★ ここで追加 ★★★
                "feedbacks": []
            }), 200
        
        return jsonify(response_data), 200
            
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
# Gemini API呼び出しユーティリティ (共通処理)
# -------------------------------------------------------------
def _call_gemini_api_base(payload, error_prefix):
    """共通のGemini API呼び出しロジックとエラー処理を扱います。"""
    API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent"
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_api_key:
        print("❌ GEMINI_API_KEYが設定されていません。処理をスキップします。")
        raise Exception("APIキーが設定されていません。")

    headers = {'Content-Type': 'application/json'}
    
    try:
        response = requests.post(
            f"{API_URL}?key={gemini_api_key}", 
            headers=headers, 
            json=payload,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        generated_text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        
        if not generated_text:
            raise Exception("Gemini APIからの応答テキストが空でした。")

        print(f"✅ Gemini APIからの応答を受信しました: {error_prefix}")
        return generated_text

    except requests.exceptions.HTTPError as http_err:
        status_code = http_err.response.status_code if http_err.response is not None else "Unknown"
        error_detail = "APIエラー: 詳細不明"
        try:
             # エラーメッセージをJSONから抽出
             error_response = http_err.response.json()
             error_detail = f"APIエラー: {error_response.get('error', {}).get('message', '詳細不明')} (Status: {status_code})"
        except:
             error_detail = http_err.response.text[:100] if http_err.response else "API応答なし"
        print(f"❌ HTTPエラーが発生しました: {http_err} (Status: {status_code})")
        raise Exception(error_detail)
    except requests.exceptions.RequestException as req_err:
        print(f"❌ リクエストエラーが発生しました: {req_err}")
        raise Exception(f"ネットワークエラー: {req_err}")
    except Exception as e:
        print(f"❌ {error_prefix}エラー: {e}")
        raise Exception(f"{error_prefix}エラー: {e}")

# -------------------------------------------------------------
# STT専用のAPI呼び出し
# -------------------------------------------------------------
def call_gemini_api_for_stt(base64_audio_data, prompt, mime_type):
    """Base64エンコードされた音声データを受け取り、Gemini APIを呼び出してSTTのみを行います。"""
    print(f"🚀 Gemini APIに音声データ ({len(base64_audio_data)} bytes) を送信中 (STT専用)...")
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inlineData": {"mimeType": mime_type, "data": base64_audio_data}}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": "You are a professional transcriber. Accurately transcribe the audio content (STT) in Japanese. Do not add any summary or extra text."}]
        },
        "tools": [{"google_search": {} }]
    }
    
    try:
        stt_text = _call_gemini_api_base(payload, "STT")
        return {"stt_text": stt_text}
    except Exception as e:
        # 例外メッセージをSTTエラーとして返す
        return {"stt_text": f"【STTエラー: {e}】"}

# -------------------------------------------------------------
# 要約専用のAPI呼び出し
# -------------------------------------------------------------
def call_gemini_api_for_summary(raw_text):
    """テキストを受け取り、Gemini APIを呼び出して要約を行います。"""
    print("🚀 Gemini APIにテキストを送信中 (要約専用)...")
    
    # ここでのpromptはシステム指示ではなく、ユーザーコンテンツとして使用
    prompt = f"以下のフィードバックテキストを読み、ポジティブな点と改善点を抽出し、30文字以内の簡潔な日本語で要約してください。\n\nテキスト:\n{raw_text}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {
            "parts": [{"text": "You are a professional feedback analyst. Summarize the user-provided text in Japanese, focusing on key positive and negative points, strictly under 30 characters. Do not include any introduction or closing phrases."}]
        },
        # テキスト処理のためtoolsは省略
    }
    
    try:
        summary_text = _call_gemini_api_base(payload, "要約")
        return {"summary_text": summary_text.strip()}
    except Exception as e:
        # 例外メッセージを要約エラーとして返す
        return {"summary_text": f"【要約エラー: {e}】"}

# -------------------------------------------------------------
# エンドポイント: POST /api/process_audio (STTのみを返すように更新)
# -------------------------------------------------------------
@app.route('/api/process_audio', methods=['POST'])
def process_audio():
    """
    クライアントから送られたBase64エンコードのオーディオデータを受け取り、
    Gemini APIでテキスト化（STT）のみを実行します。
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

    prompt_text = f"ブースID {booth_id} へのフィードバックをテキスト化してください。"
    
    try:
        # call_gemini_api_for_stt を使用
        gemini_result = call_gemini_api_for_stt(base64_audio, prompt_text, mime_type)
        stt_text = gemini_result["stt_text"]

        return jsonify({
            "message": "✅ 音声処理成功",
            "stt_text": stt_text
        }), 200

    except Exception as e:
        error_detail = f"音声処理中のエラー: {e}"
        print(f"❌ {error_detail}")
        return jsonify({
            "message": "❌ サーバーでの音声処理に失敗しました。",
            "error_detail": error_detail
        }), 500

# -------------------------------------------------------------
# 新規エンドポイント: POST /api/generate_summary (テキストから要約を生成)
# -------------------------------------------------------------
@app.route('/api/generate_summary', methods=['POST'])
def generate_summary():
    """クライアントから送られたテキストを受け取り、Gemini APIで要約を生成します。"""
    try:
        data = request.json
        raw_text = data.get('raw_text')
        if not raw_text:
            return jsonify({"message": "❌ 必須データ（raw_text）が不足しています"}), 400
            
    except Exception as e:
        return jsonify({"message": "❌ 無効なJSONデータ", "error_detail": str(e)}), 400
        
    try:
        gemini_result = call_gemini_api_for_summary(raw_text)
        summary_text = gemini_result["summary_text"]
        
        return jsonify({
            "message": "✅ 要約生成成功",
            "summary_text": summary_text
        }), 200

    except Exception as e:
        error_detail = f"要約生成中のエラー: {e}"
        print(f"❌ {error_detail}")
        return jsonify({
            "message": "❌ サーバーでの要約生成に失敗しました。",
            "error_detail": error_detail
        }), 500

# =========================================================================
# 既存のエンドポイント: POST /api/submit_feedback (要約を受け付けて保存するように更新)
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
    summary_text = data.get('summary_text', "") # ★★★ 修正: summary_textを受け取る ★★★
    
    try:
        praise_ratio = float(data.get('praise_ratio', 0))
        advice_ratio = float(data.get('advice_ratio', 0))
    except ValueError:
        conn.close()
        return jsonify({"message": "❌ 比率データが無効です", "error_detail": "praise_ratio/advice_ratioは数値である必要があります"}), 400

    if not booth_id or not raw_text or not visitor_attribute:
        conn.close()
        return jsonify({"message": "❌ 必須フィールドが不足しています"}), 400

    # summary_textがあれば、is_processedをTrueにする
    is_processed = bool(summary_text and summary_text != "") # ★★★ 修正: summary_textがあればTrueにする ★★★

    cursor = conn.cursor()
    inserted_id = None
    
    try:
        sql = """
            INSERT INTO public.sessions
            (booth_id, praise_ratio, advice_ratio, raw_text, visitor_attribute, summary_text, is_processed) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
        """
        
        params = (
            booth_id.lower().strip(), 
            praise_ratio, 
            advice_ratio, 
            raw_text, 
            visitor_attribute.lower().strip(), 
            summary_text,  # ★★★ 修正: 受け取ったsummary_textを保存 ★★★
            is_processed   # ★★★ 修正: is_processedを更新 ★★★
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