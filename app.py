import os
import json
from flask import Flask, render_template, request, jsonify
# flask_corsをインポート
from flask_cors import CORS 
from google.cloud import speech_v1p1beta1 as speech
from google import genai
from google.genai.errors import APIError
import base64

# ... (設定ファイルの読み込み、クライアント初期化のコードは省略) ...

# Flask アプリと Google Cloud Speech Client の初期化
app = Flask(__name__)

# --- CORS設定の追加 ---
# 全てのオリジン(*)からのアクセスを許可、または特定のオリジンを指定
# 開発環境では全てのオリジンを許可するのが最も簡単です
CORS(app) 
# 特定のオリジンを許可する場合は以下のようにします:
# CORS(app, origins=["http://localhost:5173"]) 

# ... (クライアントとモデルの初期化コード) ...

# --- ルーティング ---

@app.route('/')
def index():
    """メインページを表示する"""
    return render_template('index.html')

@app.route('/recognize', methods=['POST'])
def recognize_audio():
    """Base64エンコードされた音声データを受け取り、Google Cloud Speech-to-Textで文字起こしを行う"""
    # ... (既存の /recognize の処理) ...

    # ここに既存の /recognize の関数本体のコードを貼り付けます

    data = request.get_json()
    if 'audio_data' not in data:
        return jsonify({"success": False, "error": "No audio_data provided"}), 400

    try:
        # Base64データをデコード
        audio_data_base64 = data['audio_data']
        audio_content = base64.b64decode(audio_data_base64)

        # Google Cloud Speech-to-Text の設定
        audio = speech.RecognitionAudio(content=audio_content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,  # ReactのMediaRecorderがデフォルトで出力する形式
            sample_rate_hertz=48000, # 適切なレートを設定
            language_code="ja-JP",
        )

        # 同期リクエストで文字起こしを実行
        response = client.recognize(config=config, audio=audio)

        transcript = ""
        # 応答から最も確信度の高い結果を取得
        for result in response.results:
            transcript += result.alternatives[0].transcript
        
        if transcript:
            return jsonify({"success": True, "text": transcript})
        else:
            return jsonify({"success": False, "error": "文字起こしの結果が空でした。"}), 500
    
    except Exception as e:
        print(f"Speech-to-Textエラー: {e}")
        return jsonify({"success": False, "error": f"Speech-to-Textエラーが発生しました: {str(e)}"}), 500

@app.route('/summarize', methods=['POST'])
def summarize_feedback():
    """フィードバックテキストをAIに送信し、要約と評価の割合を取得する"""
    # ... (既存の /summarize の処理) ...
    # ここに既存の /summarize の関数本体のコードを貼り付けます

    data = request.get_json()
    text = data.get('text', '')
    attribute = data.get('attribute', 'general_visitor')
    booth_number = data.get('booth_number', 'N/A')

    if not text:
        return jsonify({"success": False, "error": "テキストが提供されていません。"}), 400

    if not gemini_client:
        return jsonify({"success": False, "error": "Geminiクライアントが初期化されていません。"}), 500

    prompt = f"""
    あなたは企業のブース評価の専門家です。以下のブース来場者からのフィードバックを分析し、JSON形式で以下の構造に従って要約と評価の比率を出力してください。
    
    - 来場者属性: {attribute}
    - ブース番号: {booth_number}
    - フィードバックテキスト:
    ---
    {text}
    ---

    ### 出力形式の要件 (JSON)
    1.  `ratio_good`: 10点満点での「褒める点」の割合（整数）。
    2.  `ratio_advice`: 10点満点での「改善点（アドバイス）」の割合（整数）。
    3.  `summary`: 要約と分析を含む構造化された配列。
        - 各要素は`title`（見出し）と`items`（箇条書きのリスト）を持つこと。
        - 箇条書きは具体的で実行可能な改善点や、高く評価された点を記述すること。
    4.  `ratio_good` + `ratio_advice` は必ずしも10である必要はありませんが、合計10に近い値が望ましいです。

    ### 例外処理
    - `summary`の箇条書きは日本語で、Markdown形式として後で表示されることを想定してください（Markdownの箇条書き記号`-`は不要です。）。
    - 応答はJSONのみとし、他の説明文やMarkdownのバッククォート(`)を含めないでください。
    """
    
    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[prompt],
            config={
                "response_mime_type": "application/json",
                "response_schema": {
                    "type": "OBJECT",
                    "properties": {
                        "ratio_good": {"type": "INTEGER", "description": "10点満点での褒める点の評価。"},
                        "ratio_advice": {"type": "INTEGER", "description": "10点満点での改善点（アドバイス）の評価。"},
                        "summary": {
                            "type": "ARRAY",
                            "description": "要約と分析の各セクション。",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING", "description": "セクションのタイトル（例: 評価されている点, 改善提案）。"},
                                    "items": {
                                        "type": "ARRAY",
                                        "description": "箇条書きの項目。",
                                        "items": {"type": "STRING"}
                                    }
                                }
                            }
                        }
                    },
                    "required": ["ratio_good", "ratio_advice", "summary"]
                }
            }
        )
        
        # 応答からJSON文字列を抽出
        json_string = response.text.strip().lstrip('```json').rstrip('```')
        summary_data = json.loads(json_string)

        # 割合と要約データを抽出
        ratio_good = summary_data.get('ratio_good', 5)
        ratio_advice = summary_data.get('ratio_advice', 5)
        summary_sections = summary_data.get('summary', [])

        # 要約セクションを整形（HTML表示用に文字列化）
        formatted_summary = ""
        for section in summary_sections:
            # **評価されている点 (Good Points)**:\n
            formatted_summary += f"**{section.get('title', 'タイトル不明')}**:\n"
            # - 箇条書き1
            for item in section.get('items', []):
                formatted_summary += f"- {item}\n"
            formatted_summary += "\n" # セクション間の空行

        return jsonify({
            "success": True, 
            "summary": formatted_summary.strip(),
            "ratio_good": ratio_good,
            "ratio_advice": ratio_advice
        })
            
    except APIError as e:
        print(f"Gemini APIエラー: {e}")
        return jsonify({"success": False, "error": f"Gemini APIエラーが発生しました: {str(e)}"}), 500
    except Exception as e:
        print(f"サーバー処理エラー: {e}")
        return jsonify({"success": False, "error": f"サーバー処理エラーが発生しました: {str(e)}"}), 500

if __name__ == '__main__':
    # 開発サーバーの起動
    app.run(debug=True, port=5000)