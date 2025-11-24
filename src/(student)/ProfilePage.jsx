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

// App.jsxから user prop ({ email, id, ... }を含む) を受け取る
const ProfilePage = ({ user }) => {
  const [feedback, setFeedback] = useState(null);
  // user propの有無でログイン状態を判定するため、初期loadingはtrueのまま
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // App.jsxから渡された user オブジェクトからメールアドレスを直接取得。
  // ログインしていない場合（App.jsx側で null が渡された場合）は null になる。
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
          throw new Error(`HTTP Error! Status: ${response.status}`);
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

        if (data.message && data.message.includes("見つかりませんでした")) {
          setFeedback(null);
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

  // --- データ抽出ロジック (変更なし) ---
  const emailToDisplay = userEmail || "未ログイン";

  // 1. 個別評価のリストを決定
  const individualEvaluations =
    feedback?.evaluations || feedback?.comments || [];
  const hasEvaluations = individualEvaluations.length > 0;

  // 2. 平均スコアを決定
  const mainScore = feedback?.average_score ?? feedback?.score;
  const averageScore =
    mainScore !== undefined && mainScore !== null ? mainScore : null;

  // 3. チーム情報
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

    if (error) {
      return (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6 shadow-md"
          role="alert"
        >
          <strong className="font-bold">エラーが発生しました: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      );
    }

    if (!feedback) {
      return (
        <div
          className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-xl shadow-md"
          role="alert"
        >
          <p className="font-bold">情報</p>
          <p>
            現在、あなたのチームのフィードバックデータは見つかりませんでした。データが登録されるまでお待ちください。
          </p>
        </div>
      );
    }

    // データが存在する場合の表示 (変更なし)
    return (
      <div className="space-y-8">
        {/* 1. チーム情報 & 平均スコアサマリー */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 p-6 rounded-xl shadow-inner border-l-4 border-indigo-600">
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-indigo-600 mb-1">
              対象チーム
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo-800 break-words">
              {teamName}
            </h2>
            <p className="text-gray-600 mt-2">
              <span className="font-semibold">ブースID:</span>{" "}
              <span className="text-lg font-mono">{boothId}</span>
            </p>
          </div>
          <div className="md:col-span-1 flex flex-col justify-center items-center p-3 bg-white rounded-lg shadow-md">
            <p className="text-sm font-semibold text-gray-600">平均スコア</p>
            <div
              className={`text-4xl sm:text-5xl font-black ${
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

        {/* 2. 個別の評価リスト */}
        <h3 className="text-2xl font-bold mt-8 mb-4 text-gray-800 border-b pb-2">
          来場者からの個別評価 ({individualEvaluations.length}件)
        </h3>

        {hasEvaluations ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 個別評価配列をループして表示 */}
            {individualEvaluations.map((evaluation, index) => {
              // evaluationがオブジェクトか文字列かで判断
              const isObject =
                typeof evaluation === "object" &&
                evaluation !== null &&
                !Array.isArray(evaluation);

              // データがオブジェクト形式の場合 (スコア+コメント)
              const score = isObject ? evaluation.score : null;
              const comment = isObject ? evaluation.comment : evaluation; // 文字列の場合はそれがコメント
              const evaluatorId = isObject
                ? evaluation.evaluator_id || `来場者${index + 1}`
                : `来場者${index + 1}`;

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

              return (
                <div
                  key={index}
                  className="bg-white p-5 rounded-xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl hover:border-indigo-200"
                >
                  <div className="flex justify-between items-center mb-3 border-b pb-2">
                    <div className="flex items-center text-indigo-600 font-semibold">
                      <UserIcon className="w-5 h-5 mr-2" />
                      {evaluatorId}
                    </div>
                    <div className="flex items-center text-lg font-bold">
                      <StarIcon className={`w-5 h-5 mr-1 ${starColorClass}`} />
                      <span className={scoreColorClass}>{scoreDisplay}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    コメント:
                  </p>
                  <p className="text-gray-800 italic text-base">
                    "{comment || "コメントなし"}"
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-xl shadow-md"
            role="alert"
          >
            <p className="font-bold">情報</p>
            <p>このブースに対する個別の評価データはまだありません。</p>
          </div>
        )}
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
