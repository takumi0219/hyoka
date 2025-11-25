import React, { useState, useEffect, useCallback } from "react";

// Flask APIのエンドポイント。
const FLASK_API_BASE_URL = "http://localhost:5000/api/feedback";

// --- UIコンポーネント用のアイコン (変更なし) ---
const RefreshIcon = (props) => (
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
    <path d="M20 11A8.1 8.1 0 0 0 13 4v5H4" />
    <path d="M4 13a8.1 8.1 0 0 0 15 4v-5h-9" />
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

const UsersIcon = (props) => (
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
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const StarIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const LockIcon = (props) => (
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
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// Visitor Attributeを日本語に変換するヘルパー関数
const getAttributeLabel = (value) => {
  switch (value) {
    case "industry_professional":
      return "業界関係者";
    case "student":
      return "学生";
    case "general_visitor":
      return "一般来場者";
    default:
      return "その他/不明";
  }
};

// App.jsxから user prop ({ email, id, ... }を含む) を受け取る
const ProfilePage = ({ user }) => {
  const [feedback, setFeedback] = useState(null);
  // user propの有無でログイン状態を判定するため、初期loadingはtrueのまま
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // user propの有無でログイン状態を判定
  const userEmail = user?.email || null;

  // 指数バックオフ付きのフェッチ関数を定義 (API通信の安定性を向上)
  const fetchWithRetry = useCallback(async (url, maxRetries = 3) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);

        if (response.status === 404) {
          if (
            response.headers.get("content-type")?.includes("application/json")
          ) {
            // 404でもJSONレスポンス（データなしメッセージなど）を返す場合がある
            return await response.json();
          }
          throw new Error(
            `HTTP Error! Status: 404. Flask APIのルーティング設定（/api/feedback/<email>）を確認してください。`
          );
        }

        if (!response.ok) {
          // 400/500系エラーの場合、エラーメッセージをJSONから取得を試みる
          let errorMessage = `HTTP Error! Status: ${response.status}`;
          try {
            const errorJson = await response.json();
            if (errorJson.message) {
              errorMessage = errorJson.message;
            }
          } catch {
            // JSONパース失敗の場合は、デフォルトエラーを使用
          }
          throw new Error(errorMessage);
        }

        return await response.json();
      } catch (err) {
        lastError = err;
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000;
          console.warn(
            `API呼び出し失敗。${delay}ms後にリトライします...`,
            err.message
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }, []);

  const fetchFeedbackData = useCallback(
    async (email) => {
      setLoading(true);
      setFeedback(null);
      setError(null);
      let requestUrl = null;

      try {
        requestUrl = `${FLASK_API_BASE_URL}/${email}`;
        const data = await fetchWithRetry(requestUrl);

        // APIからの応答メッセージを確認し、データが存在しないことを判定
        if (data.message && data.total_count === 0) {
          setFeedback(data); // チーム情報（team_name, booth_id）のみを保持
          setError(data.message);
        } else {
          setFeedback(data);
        }
      } catch (err) {
        console.error("Flask通信エラー:", err);
        setError(
          `フィードバックデータの取得に失敗しました。詳細: ${err.message} (アクセスURL: ${requestUrl})`
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchWithRetry]
  );

  // userEmail（親コンポーネントからのログイン情報）が変更されたときに実行
  useEffect(() => {
    if (userEmail) {
      // ログイン状態であればデータをフェッチ
      fetchFeedbackData(userEmail);
    } else {
      // ログアウト状態（または初期状態）であれば、データをクリアし、ローディングを終了
      setLoading(false);
      setError(null);
      setFeedback(null);
    }
    // userEmailとfetchFeedbackDataが変更されたときのみ実行
  }, [userEmail, fetchFeedbackData]);

  // --- データ抽出ロジックの更新 ★★★ ---
  const emailToDisplay = userEmail || "未ログイン";

  // APIからのレスポンス構造の変更に対応
  const feedbackList = feedback?.feedbacks || [];
  const totalCount = feedback?.total_count || 0; // このチームのフィードバック総数
  const totalTeamsCount = feedback?.total_teams_count || 0; // 全チームの総数

  // チームメンバー情報
  const teamMembers = feedback?.team_members || []; // ★★★ チームメンバーのリスト ★★★
  const teamMemberCount = teamMembers.length; // チームメンバーの人数

  // 平均スコアを決定
  const averageScore = feedback?.average_score ?? null;

  // チーム情報
  const teamName = feedback?.team_name || "チーム名不明";
  const boothId = feedback?.booth_id || "不明";

  // --- 表示コンテンツの決定 ---
  const renderContent = () => {
    // userEmailがない = App.jsxから有効な user propが渡されていない（未ログイン）
    if (!userEmail) {
      return (
        <div
          className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-xl shadow-md flex flex-col items-center text-center space-y-3"
          role="alert"
        >
          <LockIcon className="w-10 h-10 text-red-500" />
          <p className="font-extrabold text-xl">アクセスが制限されています</p>
          <p className="text-lg">
            フィードバックを表示するには、Googleアカウントでログインし、メールアドレスを認証する必要があります。
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-2 text-indigo-600 p-8">
          <RefreshIcon className="animate-spin h-10 w-10" />
          <div className="text-lg font-medium">評価データを読み込み中...</div>
        </div>
      );
    }

    // エラーメッセージ（主にAPI接続エラーや学生情報なし）
    if (error && totalCount === 0) {
      return (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6 shadow-md"
          role="alert"
        >
          <strong className="font-bold">データ取得エラー: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      );
    }

    // データは取得できたが、フィードバックが0件の場合 (学生情報は取得済み)
    if (totalCount === 0) {
      return (
        <div className="space-y-8">
          {/* チーム情報と統計情報のみ表示 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 全チームの総数 */}
            <div className="col-span-1 p-4 bg-purple-100 rounded-xl shadow-md flex flex-col justify-center items-center border-l-4 border-purple-500">
              <p className="text-sm font-semibold text-purple-700">
                全参加チーム数
              </p>
              <p className="text-3xl font-extrabold text-purple-900 mt-1">
                {totalTeamsCount}
              </p>
              <p className="text-sm text-purple-600">チーム</p>
            </div>

            {/* チームのフィードバック総数 */}
            <div className="col-span-1 p-4 bg-blue-100 rounded-xl shadow-md flex flex-col justify-center items-center border-l-4 border-blue-500">
              <p className="text-sm font-semibold text-blue-700">
                チームの総フィードバック数
              </p>
              <p className="text-3xl font-extrabold text-blue-900 mt-1">0</p>
              <p className="text-sm text-blue-600">件</p>
            </div>

            {/* 平均スコア */}
            <div className="col-span-1 p-4 bg-white rounded-xl shadow-md flex flex-col justify-center items-center border-l-4 border-gray-300">
              <p className="text-sm font-semibold text-gray-600">
                チーム平均スコア
              </p>
              <div className="text-3xl font-black mt-1 text-gray-400">N/A</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-indigo-50 p-6 rounded-xl shadow-inner border-l-4 border-indigo-600">
            <div className="col-span-1">
              <p className="text-sm font-medium text-indigo-600 mb-1">
                あなたのチーム情報
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo-800 break-words">
                {teamName}
              </h2>
              <p className="text-gray-600 mt-2">
                <span className="font-semibold">ブースID:</span>{" "}
                <span className="text-lg font-mono">{boothId}</span>
              </p>
            </div>
          </div>

          {/* チームメンバーセクション (フィードバックなしでも表示) */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-xl font-bold text-gray-800 flex items-center mb-4 border-b pb-2">
              <UsersIcon className="w-6 h-6 mr-2 text-indigo-500" />
              チームメンバー ({teamMemberCount}人)
            </h3>
            <ul className="space-y-2">
              {teamMembers.map((member, idx) => (
                <li
                  key={idx}
                  className={`flex justify-between items-center p-3 rounded-lg transition duration-150 ${
                    member.is_current_user
                      ? "bg-green-50 border-l-4 border-green-500 font-bold"
                      : "bg-gray-50 border-l-4 border-gray-200"
                  }`}
                >
                  <span className="text-gray-800">
                    {member.name || "名前不明"}
                  </span>
                  <span
                    className={`text-sm font-mono ${
                      member.is_current_user
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    {member.email}
                    {member.is_current_user && " (あなた)"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-xl shadow-md"
            role="alert"
          >
            <p className="font-bold">情報</p>
            <p>
              このブースに対するフィードバックデータはまだありません。フィードバックを収集してください。
            </p>
          </div>
        </div>
      );
    }

    // データが存在する場合の表示 (UIを刷新)
    return (
      <div className="space-y-8">
        {/* 0. 統計サマリー (全チーム数、フィードバック総数、平均スコア) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 全チームの総数 */}
          <div className="col-span-1 p-4 bg-purple-100 rounded-xl shadow-md flex flex-col justify-center items-center border-l-4 border-purple-500">
            <p className="text-sm font-semibold text-purple-700">
              全参加チーム数
            </p>
            <p className="text-3xl font-extrabold text-purple-900 mt-1">
              {totalTeamsCount}
            </p>
            <p className="text-sm text-purple-600">チーム</p>
          </div>

          {/* チームのフィードバック総数 */}
          <div className="col-span-1 p-4 bg-blue-100 rounded-xl shadow-md flex flex-col justify-center items-center border-l-4 border-blue-500">
            <p className="text-sm font-semibold text-blue-700">
              チームの総フィードバック数
            </p>
            <p className="text-3xl font-extrabold text-blue-900 mt-1">
              {totalCount}
            </p>
            <p className="text-sm text-blue-600">件</p>
          </div>

          {/* 平均スコア */}
          <div className="col-span-1 p-4 bg-white rounded-xl shadow-md flex flex-col justify-center items-center border-l-4 border-gray-300">
            <p className="text-sm font-semibold text-gray-600">
              チーム平均スコア
            </p>
            <div
              className={`text-3xl font-black mt-1 ${
                averageScore >= 80
                  ? "text-green-600"
                  : averageScore >= 60
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {averageScore !== null ? `${averageScore}点` : "N/A"}
            </div>
          </div>
        </div>

        {/* 1. チーム情報 (簡略化) */}
        <div className="grid grid-cols-1 gap-4 bg-indigo-50 p-6 rounded-xl shadow-inner border-l-4 border-indigo-600 mt-4">
          <div className="col-span-1">
            <p className="text-sm font-medium text-indigo-600 mb-1">
              あなたのチーム情報
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo-800 break-words">
              {teamName}
            </h2>
            <p className="text-gray-600 mt-2">
              <span className="font-semibold">ブースID:</span>{" "}
              <span className="text-lg font-mono">{boothId}</span>
            </p>
          </div>
        </div>

        {/* 1.5. チームメンバーセクション */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 flex items-center mb-4 border-b pb-2">
            <UsersIcon className="w-6 h-6 mr-2 text-indigo-500" />
            チームメンバー ({teamMemberCount}人)
          </h3>
          <ul className="space-y-2">
            {teamMembers.map((member, idx) => (
              <li
                key={idx}
                className={`flex justify-between items-center p-3 rounded-lg transition duration-150 ${
                  member.is_current_user
                    ? "bg-green-50 border-l-4 border-green-500 font-bold"
                    : "bg-gray-50 border-l-4 border-gray-200"
                }`}
              >
                <span className="text-gray-800">
                  {member.name || "名前不明"}
                </span>
                <span
                  className={`text-sm font-mono ${
                    member.is_current_user ? "text-green-600" : "text-gray-500"
                  }`}
                >
                  {member.email}
                  {member.is_current_user && " (あなた)"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. 個別の評価リスト */}
        <h3 className="text-2xl font-bold mt-8 mb-4 text-gray-800 border-b pb-2">
          来場者からの個別フィードバック ({totalCount}件)
        </h3>

        <div className="space-y-6">
          {feedbackList.map((feedbackItem, index) => {
            const attributeLabel = getAttributeLabel(
              feedbackItem.visitor_attribute
            ); // 属性ラベル
            const score = feedbackItem.score;
            const rawText = feedbackItem.raw_text;
            const summaryText = feedbackItem.summary_text;
            const isProcessed = feedbackItem.is_processed;

            // スコアに応じた色を決定
            const scoreDisplay = score !== null ? `${score}点` : "N/A";
            const scoreColorClass =
              score >= 80
                ? "text-green-700"
                : score >= 60
                ? "text-yellow-700"
                : score !== null
                ? "text-red-700"
                : "text-gray-500";
            const starColorClass =
              score >= 80 ? "text-yellow-500" : "text-gray-400";

            const cardBackgroundColor = isProcessed ? "bg-white" : "bg-red-50";

            return (
              <div
                key={index}
                className={`${cardBackgroundColor} p-6 rounded-xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl hover:border-indigo-200`}
              >
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  {/* 左側: 属性 */}
                  <div className="flex items-center text-indigo-600 font-semibold text-lg bg-indigo-100 px-3 py-1 rounded-full">
                    <UserIcon className="w-5 h-5 mr-2" />
                    {attributeLabel}
                  </div>
                  {/* 右側: スコア */}
                  <div className="flex items-center text-xl font-bold">
                    <StarIcon className={`w-6 h-6 mr-1 ${starColorClass}`} />
                    <span className={scoreColorClass}>{scoreDisplay}</span>
                  </div>
                </div>

                {/* 録音結果 (Raw Text) */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                  <p className="text-sm font-semibold text-gray-600 mb-1">
                    生のフィードバックテキスト (Raw Text)
                  </p>
                  <p className="text-gray-800 italic text-base whitespace-pre-wrap">
                    {rawText || "テキストなし"}
                  </p>
                </div>

                {/* AI要約結果 (Summary Text) */}
                <div
                  className={`p-3 rounded-lg border ${
                    isProcessed
                      ? "bg-green-50 border-green-200"
                      : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center">
                    AI要約 (Summary)
                    {!isProcessed && (
                      <span className="ml-2 text-xs font-bold text-red-600 bg-red-200 px-2 py-0.5 rounded-full">
                        未処理/エラー
                      </span>
                    )}
                  </p>
                  <p className="text-gray-800 font-bold text-base">
                    {summaryText || "要約テキストがありません。"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto bg-gray-50 shadow-2xl rounded-xl mt-4 sm:mt-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-800 border-b pb-2 text-center">
        チームフィードバックダッシュボード
      </h1>

      {/* ログイン情報表示 */}
      <div className="p-4 mb-6 bg-white rounded-xl shadow-lg border border-green-200">
        <p className="text-lg font-semibold text-gray-700 flex items-center">
          <UserIcon className="w-5 h-5 mr-2 text-green-500" />
          現在のメールアドレス:
          <span
            className={`ml-2 font-mono ${
              userEmail ? "text-green-600" : "text-gray-500"
            } break-all`}
          >
            {emailToDisplay}
          </span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          ※このメールアドレスが、APIからデータを取得するためのキーとして使用されます。
        </p>
      </div>

      {/* メインコンテンツのレンダリング */}
      {renderContent()}
    </div>
  );
};

export default ProfilePage;
