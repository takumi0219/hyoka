import os
import json
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# .envファイルから環境変数をロード
load_dotenv()

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
# 🚨 修正箇所：students.email を起点に sessions を検索 🚨
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
        # SQLを修正：
        # 1. sessionsとstudentsをbooth_idで結合。
        # 2. students.emailが検索メールアドレスに一致するものをWHERE句で絞り込む。
        #    -> これで、その学生のチームのブースIDに紐づくsessionsデータがすべて取得される。
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
            # 取得するカラムが増えました
            booth_id, raw_text, summary_text, is_processed, team_name, student_email = result
            
            # データが見つかったため、200 OKで応答
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
            # studentsテーブルにメールアドレスがないか、紐づくsessionsがない場合
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

# =========================================================================
# 既存のエンドポイント: POST /api/submit_feedback (変更なし)
# ※ sessions.visitor_attribute は訪問者メールとしてそのまま維持
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