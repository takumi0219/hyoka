import React, { useState } from "react";

// lucide-react の代わりにインラインSVGを使用します。

// =================================================================
// FeedbackForm コンポーネント (App.jsx内に統合)
// =================================================================
const FeedbackForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    booth_id: "",
    praise_ratio: "50", // 50% を初期値
    advice_ratio: "50",
    raw_text: "",
    visitor_attribute: "industry_professional", // 業界関係者を初期値
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (
      !formData.booth_id ||
      !formData.raw_text ||
      !formData.visitor_attribute
    ) {
      alert("必須項目をすべて入力してください。");
      return;
    }

    setIsSubmitting(true);
    // onSubmitの非同期処理が完了したら、App.jsx側でisSubmittingを解除する
    onSubmit(() => setIsSubmitting(false), formData);
  };

  // praise_ratioとadvice_ratioが連動するように調整
  const handlePraiseChange = (e) => {
    const praise = Number(e.target.value);
    const advice = 100 - praise;
    setFormData((prev) => ({
      ...prev,
      praise_ratio: String(praise),
      advice_ratio: String(advice),
    }));
  };

  // SVGアイコン定義
  const ThumbsUp = (props) => (
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
      <path d="M7 10v12h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l2-4H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2v-8h12"></path>
    </svg>
  );
  const ThumbsDown = (props) => (
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
      <path d="M17 14V2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3l-2 4h12a2 2 0 0 0 2-2v-10a2 2 0 0 0-2-2h-2v8h-7"></path>
    </svg>
  );
  const UserIcon = (props) => (
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
  const MonitorIcon = (props) => (
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
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
  const HashIcon = (props) => (
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
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );

  // Visitor Attributeのオプション
  const attributeOptions = [
    {
      value: "industry_professional",
      label: "業界関係者",
      icon: <UserIcon className="w-5 h-5" />,
    },
    {
      value: "student",
      label: "学生",
      icon: <MonitorIcon className="w-5 h-5" />,
    },
    {
      value: "general_visitor",
      label: "一般来場者",
      icon: <HashIcon className="w-5 h-5" />,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Booth ID */}
      <div>
        <label
          htmlFor="booth_id"
          className="block text-sm font-medium text-gray-700 flex items-center mb-1"
        >
          <HashIcon className="w-4 h-4 mr-2" />
          ブースID (例: A01)
        </label>
        <input
          type="text"
          name="booth_id"
          id="booth_id"
          value={formData.booth_id}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="例: A01"
        />
      </div>

      {/* Visitor Attribute */}
      <div>
        <label className="block text-sm font-medium text-gray-700 flex items-center mb-2">
          <UserIcon className="w-4 h-4 mr-2" />
          来場者の属性
        </label>
        <div className="mt-1 grid grid-cols-3 gap-3">
          {attributeOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="radio"
                name="visitor_attribute"
                value={option.value}
                checked={formData.visitor_attribute === option.value}
                onChange={handleChange}
                required
                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700 flex items-center">
                {option.icon}
                <span className="ml-1">{option.label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Praise / Advice Ratio Slider */}
      <div className="pt-2">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          フィードバックの比率
        </label>
        <div className="flex justify-between items-center text-sm font-semibold mb-2">
          <span className="text-green-600 flex items-center">
            <ThumbsUp className="w-4 h-4 mr-1" />
            褒める ({formData.praise_ratio}%)
          </span>
          <span className="text-red-600 flex items-center">
            アドバイス ({formData.advice_ratio}%)
            <ThumbsDown className="w-4 h-4 ml-1" />
          </span>
        </div>
        <input
          type="range"
          name="praise_ratio"
          min="0"
          max="100"
          step="5"
          value={formData.praise_ratio}
          onChange={handlePraiseChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
          style={{
            background: `linear-gradient(to right, #10B981 0%, #10B981 ${formData.praise_ratio}%, #EF4444 ${formData.praise_ratio}%, #EF4444 100%)`,
          }}
        />
      </div>

      {/* Raw Text Feedback */}
      <div>
        <label
          htmlFor="raw_text"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          詳細なフィードバック (AI解析用)
        </label>
        <textarea
          name="raw_text"
          id="raw_text"
          rows="4"
          value={formData.raw_text}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="良かった点や改善点などを詳しく記述してください。"
        ></textarea>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition duration-150 shadow-md ${
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
        disabled={isSubmitting}
      >
        {isSubmitting ? "送信中..." : "評価をデータベースに送信"}
      </button>
    </form>
  );
};
// =================================================================
// End of FeedbackForm
// =================================================================

const FormPage = () => {
  const [activeScreen, setActiveScreen] = useState("form"); // 'form' or 'dashboard'

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

    // 🚨 修正: API URLをFlaskサーバーへ戻す
    const API_URL = "http://localhost:5000/api/submit_feedback";

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
          alert(`評価送信成功: ${result.message} (ID: ${result.inserted_id})`);
          // 成功後、ダッシュボード画面へ移行
          setActiveScreen("dashboard");
        } else {
          // サーバーから返されたエラーを表示
          console.error(
            `評価送信エラー: ${result.message}\n詳細: ${
              result.error_detail || ""
            }`
          );
          alert(
            `評価送信エラー: ${result.message}\n詳細: ${
              result.error_detail || ""
            }`
          );
        }
      } catch (error) {
        alert("ネットワークエラーまたはサーバー接続エラーが発生しました。");
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
        <div className="p-4 md:p-8 bg-white shadow-xl rounded-2xl w-full max-w-2xl">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-2">
            ブース評価フォーム (Flaskテスト版)
          </h1>
          {/* 統合されたFeedbackFormコンポーネントを使用 */}
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
