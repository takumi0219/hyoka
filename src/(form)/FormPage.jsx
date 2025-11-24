import React, { useState, useRef } from "react";

// =================================================================
// FeedbackForm Component
// =================================================================

const FeedbackForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    booth_id: "",
    raw_text: "",
    visitor_attribute: "industry_professional", // 初期値
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // 音声処理中のステート

  // 録音関連のステートと参照
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const customAlert = (message) => {
    // alert()の代わりにconsoleに出力
    console.log("App Message:", message);
    // ユーザーに視覚的に通知するため、簡略化のためwindow.alertを使用
    // 実際のアプリケーションでは、カスタムモーダルを使用してください。
    window.alert(message);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting || isProcessingAudio) return;

    if (
      !formData.booth_id ||
      !formData.raw_text ||
      !formData.visitor_attribute
    ) {
      customAlert("必須項目をすべて入力してください。");
      return;
    }

    // API互換性のために固定値で送信
    const dataToSend = {
      ...formData,
      praise_ratio: "50",
      advice_ratio: "50",
    };

    setIsSubmitting(true);
    // onSubmitの非同期処理が完了したら、isSubmittingを解除
    onSubmit(() => setIsSubmitting(false), dataToSend);
  };

  // ====== 音声認識機能の追加 ======

  const startRecording = async () => {
    if (isRecording || isProcessingAudio) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // MediaRecorderの設定: audio/L16はPCM 16bitで、多くのAPIがサポートしています
      const options = { mimeType: "audio/webm;codecs=pcm" };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = []; // チャンクをリセット

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 録音データのストリームを閉じる
        stream.getTracks().forEach((track) => track.stop());

        setIsProcessingAudio(true);
        setFormData((prev) => ({
          ...prev,
          raw_text:
            "（音声処理中...）サーバーに送信し、AIでテキスト化しています。数秒お待ちください。",
        }));

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm;codecs=pcm",
        });

        // BlobからBase64文字列に変換
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(",")[1]; // 'data:audio/...' のヘッダーを削除

          const API_URL = "http://localhost:5000/api/process_audio";

          try {
            const response = await fetch(API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audio_data: base64Audio,
                mime_type: options.mimeType,
                booth_id: formData.booth_id || "UNKNOWN", // ブースIDも送信
              }),
            });

            const result = await response.json();

            if (response.ok) {
              setFormData((prev) => ({
                ...prev,
                raw_text: result.stt_text,
              }));
              customAlert(`音声処理成功: 要約: ${result.summary_text}`);
            } else {
              customAlert(
                `音声処理エラー: ${result.message || "不明なエラー"}`
              );
              setFormData((prev) => ({
                ...prev,
                raw_text:
                  "音声処理エラーが発生しました。手動で入力してください。",
              }));
            }
          } catch (error) {
            customAlert("ネットワークエラー: サーバーに接続できませんでした。");
            console.error("Fetch Error:", error);
            setFormData((prev) => ({
              ...prev,
              raw_text:
                "ネットワークエラーが発生しました。手動で入力してください。",
            }));
          } finally {
            setIsProcessingAudio(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      // 録音開始中はテキストエリアにメッセージを表示
      setFormData((prev) => ({
        ...prev,
        raw_text: "（録音中...）終了したら「ストップ」を押してください。",
      }));
    } catch (err) {
      customAlert(
        "マイクへのアクセスに失敗しました。ブラウザの設定を確認してください。"
      );
      console.error("マイクへのアクセスに失敗しました:", err);
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // SVGアイコン定義 (変更なし)
  const MicIcon = (props) => (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );

  const StopIcon = (props) => (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    </svg>
  );

  // Visitor Attributeのオプション (変更なし)
  const attributeOptions = [
    { value: "industry_professional", label: "業界関係者" },
    { value: "student", label: "学生" },
    { value: "general_visitor", label: "一般来場者" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-2">
      {/* Visitor Attribute (属性) */}
      <div>
        <label
          htmlFor="visitor_attribute"
          className="block text-xl font-bold text-gray-800 mb-2"
        >
          属性
        </label>
        <div className="relative">
          <select
            name="visitor_attribute"
            id="visitor_attribute"
            value={formData.visitor_attribute}
            onChange={handleChange}
            required
            className="block w-full pl-4 pr-10 py-3 text-lg border border-gray-300 rounded-xl shadow-inner focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
          >
            {attributeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* ドロップダウン矢印 */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Booth ID (ブース番号) */}
      <div>
        <label
          htmlFor="booth_id"
          className="block text-xl font-bold text-gray-800 mb-2"
        >
          ブース番号
        </label>
        <div className="relative">
          <input
            type="text"
            name="booth_id"
            id="booth_id"
            value={formData.booth_id}
            onChange={handleChange}
            required
            className="block w-full px-4 py-3 text-lg border border-gray-300 rounded-xl shadow-inner focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="例: A01"
          />
          {/* ドロップダウン矢印 (画像にドロップダウンのように見えたため、ダミーで配置) */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
        </div>
      </div>

      {/* 録音セクション */}
      <div className="pt-4">
        <label className="block text-xl font-bold text-gray-800 mb-3">
          録音
        </label>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={startRecording}
            // 録音中または音声処理中は無効
            disabled={isRecording || isProcessingAudio}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition duration-150 shadow-md flex items-center justify-center ${
              isRecording
                ? "bg-red-500 animate-pulse" // 録音中は赤く点滅
                : isProcessingAudio
                ? "bg-gray-500 cursor-not-allowed" // 処理中は灰色
                : "bg-green-600 hover:bg-green-700" // 通常は緑
            }`}
          >
            <MicIcon className="w-5 h-5 mr-2" />
            {isRecording ? "録音中..." : "スタート"}
          </button>
          <button
            type="button"
            onClick={stopRecording}
            // 録音中で、かつ音声処理中でない場合のみ有効
            disabled={!isRecording || isProcessingAudio}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition duration-150 shadow-md flex items-center justify-center ${
              !isRecording
                ? "bg-gray-400 cursor-not-allowed text-gray-700"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            <StopIcon className="w-5 h-5 mr-2" />
            ストップ
          </button>
        </div>
        {isProcessingAudio && (
          <div className="mt-2 text-center text-sm font-medium text-indigo-600">
            AIが音声をテキスト化中...
          </div>
        )}
      </div>

      {/* Raw Text Feedback (録音結果表示エリア) */}
      <div className="pt-2">
        <textarea
          name="raw_text"
          id="raw_text"
          rows="8"
          value={formData.raw_text}
          onChange={handleChange}
          required
          // 音声処理中はテキストエリアを無効化
          disabled={isProcessingAudio}
          className="block w-full px-4 py-3 text-lg border border-gray-300 rounded-xl shadow-inner focus:ring-indigo-500 focus:border-indigo-500 bg-white placeholder-gray-500"
          placeholder="録音されたフィードバックがテキスト化されてここに入ります。必要に応じて直接編集も可能です。"
        ></textarea>
      </div>

      {/* Submit Button (送信) */}
      <button
        type="submit"
        className={`w-full py-4 px-4 rounded-xl text-xl font-bold text-white transition duration-150 shadow-lg mt-8 ${
          isSubmitting || isProcessingAudio // 音声処理中も送信を無効化
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
        disabled={isSubmitting || isProcessingAudio}
      >
        {isSubmitting ? "送信中..." : "送信"}
      </button>
    </form>
  );
};

// =================================================================
// FormPage Component (変更なし)
// =================================================================

const FormPage = () => {
  const [activeScreen, setActiveScreen] = useState("form");

  // ダッシュボードデータの仮置き場（GET APIが完成したら置き換え）
  const dummyDashboardData = {
    student_email: "test-student@example.com",
    full_name: "テスト生徒",
    team_name: "AI開発チーム",
    score: 95,
    comments: [
      "チームは優秀です。",
      "Supabaseデータベースとの連携テスト成功です！",
    ],
  };

  const handleFormSubmit = (setSubmittingDone, formData) => {
    // フォームデータを受け取り、データベースに送信する処理
    console.log("フォームデータ:", formData);

    const API_URL = "http://localhost:5000/api/submit_feedback";

    const customAlert = (message) => {
      console.log("Custom Alert:", message);
      window.alert(message);
    };

    const submitData = async () => {
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (response.ok) {
          console.log(
            `評価送信成功: ${result.message} (ID: ${result.inserted_id})`
          );
          customAlert(
            `評価送信成功: ${result.message} (ID: ${result.inserted_id})`
          );
          // 成功後、ダッシュボード画面へ移行
          setActiveScreen("dashboard");
        } else {
          // サーバーから返されたエラーを表示
          console.error(
            `評価送信エラー: ${result.message}\n詳細: ${
              result.error_detail || ""
            }`
          );
          customAlert(
            `評価送信エラー: ${result.message}\n詳細: ${
              result.error_detail || ""
            }`
          );
        }
      } catch (error) {
        customAlert(
          "ネットワークエラーまたはサーバー接続エラーが発生しました。"
        );
        console.error("Fetch Error:", error);
      } finally {
        // 送信が完了したことをFeedbackFormに通知
        setSubmittingDone(false);
      }
    };

    submitData();
  };

  const renderScreen = () => {
    if (activeScreen === "form") {
      return (
        <div className="p-4 md:p-8 bg-white shadow-xl rounded-2xl w-full max-w-lg mx-auto">
          <FeedbackForm onSubmit={handleFormSubmit} />
        </div>
      );
    }

    if (activeScreen === "dashboard") {
      const data = dummyDashboardData;
      return (
        <div className="p-6 md:p-10 bg-white shadow-xl rounded-2xl w-full max-w-2xl">
          <h1 className="text-3xl font-extrabold text-green-700 mb-4">
            評価ダッシュボード (仮)
          </h1>
          <p className="text-gray-600 mb-6">データベース連携テスト成功</p>

          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm font-semibold text-indigo-700">
                生徒名 / チーム名
              </p>
              <p className="text-xl font-bold text-gray-800">
                {data.full_name} / {data.team_name}
              </p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm font-semibold text-yellow-700">
                獲得スコア
              </p>
              <p className="text-4xl font-extrabold text-yellow-800">
                {data.score}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                フィードバックコメント
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-800">
                {data.comments.map((comment, index) => (
                  <li key={index}>{comment}</li>
                ))}
              </ul>
            </div>
          </div>

          <button
            onClick={() => setActiveScreen("form")}
            className="mt-6 w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition duration-150 shadow-md"
          >
            別のブースを評価する
          </button>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {renderScreen()}
    </div>
  );
};

export default FormPage;
